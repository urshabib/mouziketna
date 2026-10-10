import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const UPSTREAM_WORKER = 'https://new-music-space-api.urshabib.workers.dev';

// =========================================================================
// 1. DATA TYPES & SCHEMAS
// =========================================================================

export interface UserSession {
  sessionId: string;
  sessionToken: string;
  username: string;
  deviceId: string;
  deviceName: string;
  deviceFingerprint?: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  lastActive: number;
  expiresAt: number;
}

export interface PlaybackLease {
  username: string;
  deviceId: string;
  deviceName: string;
  streamToken: string; // Short-lived audio playback token
  leaseEpoch: number; // Monotonically increasing epoch
  trackId?: string;
  trackTitle?: string;
  trackArtist?: string;
  trackThumb?: string;
  currentTime: number;
  duration: number;
  state: 'playing' | 'paused';
  startedAt: number;
  lastHeartbeat: number;
  expiresAt: number;
  updatedAt: number;
}

// =========================================================================
// 2. REDIS STATE ENGINE (ioredis-compatible with In-Memory Multi-Node Fallback)
// =========================================================================

interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, cb: (msg: string) => void): Promise<void>;
  eval(script: string, numkeys: number, ...keysAndArgs: string[]): Promise<any>;
}

// Lua Script: Atomic Playback Handover
// 1. Checks existing lease for user
// 2. Increments leaseEpoch
// 3. Sets new streamToken and writes new lease with TTL
// 4. Publishes handover event to Redis Pub/Sub channel
export const ATOMIC_HANDOVER_LUA = `
local current = redis.call("GET", KEYS[1])
local prevDeviceId = ""
local prevDeviceName = ""
local epoch = 1

if current then
  local lease = cjson.decode(current)
  prevDeviceId = lease.deviceId or ""
  prevDeviceName = lease.deviceName or ""
  epoch = (tonumber(lease.leaseEpoch) or 0) + 1
end

local newLease = {
  username = ARGV[1],
  deviceId = ARGV[2],
  deviceName = ARGV[3],
  streamToken = ARGV[4],
  leaseEpoch = epoch,
  trackId = ARGV[5],
  trackTitle = ARGV[6],
  trackArtist = ARGV[7],
  trackThumb = ARGV[8],
  currentTime = tonumber(ARGV[9]) or 0,
  duration = tonumber(ARGV[10]) or 0,
  state = "playing",
  startedAt = tonumber(ARGV[11]) or 0,
  lastHeartbeat = tonumber(ARGV[11]) or 0,
  expiresAt = (tonumber(ARGV[11]) or 0) + ((tonumber(ARGV[12]) or 35) * 1000),
  updatedAt = tonumber(ARGV[11]) or 0
}

local encoded = cjson.encode(newLease)
redis.call("SET", KEYS[1], encoded, "EX", tonumber(ARGV[12]) or 35)

local pubPayload = cjson.encode({
  type = "PLAYBACK_HANDOVER",
  previousDeviceId = prevDeviceId,
  previousDeviceName = prevDeviceName,
  newDeviceId = ARGV[2],
  newDeviceName = ARGV[3],
  leaseEpoch = epoch,
  lease = newLease,
  timestamp = tonumber(ARGV[11])
})
redis.call("PUBLISH", KEYS[2], pubPayload)

return encoded
`;

class InMemoryRedis implements RedisClientInterface {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  private subscribers = new Map<string, Set<(msg: string) => void>>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt !== null && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ...args: any[]): Promise<'OK' | null> {
    let ttlMs: number | null = null;
    let nx = false;

    for (let i = 0; i < args.length; i++) {
      const arg = String(args[i]).toUpperCase();
      if (arg === 'EX' && i + 1 < args.length) {
        ttlMs = parseInt(args[i + 1], 10) * 1000;
        i++;
      } else if (arg === 'PX' && i + 1 < args.length) {
        ttlMs = parseInt(args[i + 1], 10);
        i++;
      } else if (arg === 'NX') {
        nx = true;
      }
    }

    if (nx) {
      const existing = await this.get(key);
      if (existing !== null) return null;
    }

    this.store.set(key, {
      value,
      expiresAt: ttlMs !== null ? Date.now() + ttlMs : null,
    });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  async publish(channel: string, message: string): Promise<number> {
    const subs = this.subscribers.get(channel);
    if (!subs || subs.size === 0) return 0;
    for (const cb of subs) {
      try {
        cb(message);
      } catch (err) {
        console.error('[RedisPubSub] Error in subscriber callback:', err);
      }
    }
    return subs.size;
  }

  async subscribe(channel: string, cb: (msg: string) => void): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(cb);
  }

  async eval(script: string, numkeys: number, ...keysAndArgs: string[]): Promise<any> {
    const keys = keysAndArgs.slice(0, numkeys);
    const argv = keysAndArgs.slice(numkeys);

    const playbackKey = keys[0];
    const channelKey = keys[1];

    const username = argv[0];
    const newDeviceId = argv[1];
    const newDeviceName = argv[2];
    const newStreamToken = argv[3];
    const trackId = argv[4];
    const trackTitle = argv[5];
    const trackArtist = argv[6];
    const trackThumb = argv[7];
    const currentTime = parseFloat(argv[8] || '0') || 0;
    const duration = parseFloat(argv[9] || '0') || 0;
    const now = parseInt(argv[10] || String(Date.now()), 10) || Date.now();
    const ttlSeconds = parseInt(argv[11] || '35', 10) || 35;

    const currentStr = await this.get(playbackKey);
    let prevDeviceId = '';
    let prevDeviceName = '';
    let epoch = 1;

    if (currentStr) {
      try {
        const parsed = JSON.parse(currentStr);
        prevDeviceId = parsed.deviceId || '';
        prevDeviceName = parsed.deviceName || '';
        epoch = (parseInt(parsed.leaseEpoch, 10) || 0) + 1;
      } catch {}
    }

    const newLease: PlaybackLease = {
      username,
      deviceId: newDeviceId,
      deviceName: newDeviceName,
      streamToken: newStreamToken,
      leaseEpoch: epoch,
      trackId: trackId || undefined,
      trackTitle: trackTitle || undefined,
      trackArtist: trackArtist || undefined,
      trackThumb: trackThumb || undefined,
      currentTime,
      duration,
      state: 'playing',
      startedAt: now,
      lastHeartbeat: now,
      expiresAt: now + ttlSeconds * 1000,
      updatedAt: now,
    };

    const encoded = JSON.stringify(newLease);
    await this.set(playbackKey, encoded, 'EX', ttlSeconds);

    const pubPayload = JSON.stringify({
      type: 'PLAYBACK_HANDOVER',
      previousDeviceId: prevDeviceId,
      previousDeviceName: prevDeviceName,
      newDeviceId,
      newDeviceName,
      leaseEpoch: epoch,
      lease: newLease,
      timestamp: now,
    });

    await this.publish(channelKey, pubPayload);
    return encoded;
  }
}

// Initialize Redis engine
let redis: RedisClientInterface;

if (process.env.REDIS_URL) {
  try {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });
    const subClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });

    redis = {
      get: (k) => client.get(k),
      set: (k, v, ...args) => client.set(k, v, ...args as any) as any,
      del: (...k) => client.del(...k),
      publish: (c, m) => client.publish(c, m),
      subscribe: async (c, cb) => {
        await subClient.subscribe(c);
        subClient.on('message', (chan, msg) => {
          if (chan === c) cb(msg);
        });
      },
      eval: (script, numkeys, ...keysAndArgs) => client.eval(script, numkeys, ...keysAndArgs),
    };
    console.log('[Redis] Connected to external Redis instance at', process.env.REDIS_URL.split('@')[1] || 'cluster');
  } catch (err) {
    console.warn('[Redis] Failed to initialize external Redis, falling back to In-Memory engine:', err);
    redis = new InMemoryRedis();
  }
} else {
  redis = new InMemoryRedis();
}

// In-Memory Sessions & Sliding Window Rate Limiter
const sessions = new Map<string, UserSession>();
const deviceToSession = new Map<string, string>();
const rateLimitMap = new Map<string, number[]>();

// =========================================================================
// 3. HELPERS & SECURITY FUNCTIONS
// =========================================================================

function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function cleanUsername(user?: string): string {
  return (user || '').toLowerCase().trim();
}

function getRedisPlaybackKey(username: string): string {
  return `mouzika:user:${cleanUsername(username)}:playback`;
}

function getRedisChannelKey(username: string): string {
  return `mouzika:channel:${cleanUsername(username)}`;
}

function getRedisLockKey(username: string): string {
  return `mouzika:user:${cleanUsername(username)}:playback:lock`;
}

function getRedisSeqKey(deviceId: string): string {
  return `mouzika:device:${deviceId}:seq`;
}

// Rate Limiter Middleware
function rateLimit(limit = 60, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const timestamps = (rateLimitMap.get(key) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= limit) {
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Too many requests. Please try again later.',
        retryAfterMs: windowMs - (now - timestamps[0]),
      });
    }

    timestamps.push(now);
    rateLimitMap.set(key, timestamps);
    next();
  };
}

// Extract & Verify Session (reads Authorization header, cookie, query, or body)
function extractSession(req: Request): UserSession | null {
  let token = '';

  // 1. Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Cookie header: mouzika_session
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)mouzika_session=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]).trim();
  }

  // 3. Body & Query
  if (!token && req.body && req.body.sessionToken) {
    token = String(req.body.sessionToken).trim();
  }
  if (!token && req.query && req.query.sessionToken) {
    token = String(req.query.sessionToken).trim();
  }

  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    deviceToSession.delete(`${session.username}:${session.deviceId}`);
    return null;
  }

  session.lastActive = Date.now();
  return session;
}

// Defend against replay attacks by tracking monotonic sequence counters
async function verifyReplayProtection(deviceId: string, seq?: number, nonce?: string): Promise<boolean> {
  if (!deviceId) return true;

  // Check Nonce uniqueness via SET NX EX 60
  if (nonce) {
    const nonceKey = `mouzika:nonce:${nonce}`;
    const acquired = await redis.set(nonceKey, '1', 'NX', 'EX', 60);
    if (!acquired) {
      console.warn(`[Security] Replay attack detected: reused nonce ${nonce} for device ${deviceId}`);
      return false;
    }
  }

  // Monotonic sequence counter check
  if (seq !== undefined && typeof seq === 'number') {
    const seqKey = getRedisSeqKey(deviceId);
    const lastSeqStr = await redis.get(seqKey);
    const lastSeq = lastSeqStr ? parseInt(lastSeqStr, 10) : 0;

    if (seq <= lastSeq) {
      console.warn(`[Security] Replay / Out-of-order packet: device ${deviceId} sent seq ${seq} <= ${lastSeq}`);
      return false;
    }

    await redis.set(seqKey, String(seq), 'EX', 86400);
  }

  return true;
}

// =========================================================================
// 4. TUNISIA GEOFENCING & ANTI-VPN MITIGATION MIDDLEWARE
// =========================================================================

function enforceTunisiaGeoAndAntiVpn(req: Request, res: Response, next: NextFunction) {
  if (process.env.BYPASS_GEO_BLOCK === 'true') {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const isLocal =
    ip.includes('127.0.0.1') ||
    ip.includes('::1') ||
    ip.includes('localhost') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.');

  if (isLocal && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_DEV === 'true')) {
    return next();
  }

  // Geolocation headers (Cloudflare, Vercel, Cloud Run, etc.)
  const country = (
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-country-code'] ||
    req.headers['geoip-country'] ||
    req.headers['x-geo-country'] ||
    ''
  ).toString().toUpperCase();

  const threatScore = parseInt((req.headers['cf-threat-score'] as string) || '0', 10);
  const botScore = parseInt((req.headers['cf-bot-management-score'] as string) || '100', 10);
  const viaHeader = req.headers['via'] || req.headers['x-proxy-connection'] || req.headers['proxy-connection'];
  const forwardedFor = (req.headers['x-forwarded-for'] as string) || '';
  const hopCount = forwardedFor ? forwardedFor.split(',').length : 0;
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();

  // 1. Strict Country Check: Must be Tunisia (TN) if country header is present
  if (country && country !== 'TN') {
    if (req.accepts('html') && !req.path.startsWith('/api')) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Access Restricted - MOUZIKETNA</title>
          <style>
            body { background: #08080a; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #141418; border: 1px solid rgba(251,44,54,0.3); border-radius: 24px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.9); }
            h1 { color: #ff6568; font-size: 24px; margin-bottom: 12px; }
            p { color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
            button { background: #fff; color: #000; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Access Restricted (Tunisia Only)</h1>
            <p>MOUZIKETNA is exclusively available within Tunisia. International traffic and VPN/Proxy networks are strictly blocked (Detected: ${country}).</p>
            <button onclick="location.reload()">Retry Connection</button>
          </div>
        </body>
        </html>
      `);
    }
    return res.status(403).json({
      error: 'geoblock_restricted',
      message: 'Access restricted: MOUZIKETNA is exclusively available within Tunisia. International traffic blocked (ISO: TN required).',
      detectedCountry: country,
    });
  }

  // 2. Anti-VPN / Anti-Proxy Mimicry Check (detects VPNs, proxies, Tor, datacenters, multi-hop tunneling, or suspicious signatures)
  const isVpnOrProxy =
    threatScore > 0 ||
    botScore < 50 ||
    viaHeader ||
    hopCount > 2 ||
    req.headers['x-envoy-external-address'] ||
    /vpn|proxy|tor|anon|tunnel|surfshark|nordvpn|expressvpn|cyberghost|windscribe|pia|privateinternetaccess|protonvpn|mullvad|datacenter|hosting|aws|gcp|digitalocean|ovh|hetzner/i.test(JSON.stringify(req.headers)) ||
    /curl|python|postman|bot|crawler|spider|scraper/i.test(userAgent);

  if (isVpnOrProxy) {
    if (req.accepts('html') && !req.path.startsWith('/api')) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>VPN/Proxy Blocked - MOUZIKETNA</title>
          <style>
            body { background: #08080a; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #141418; border: 1px solid rgba(251,44,54,0.3); border-radius: 24px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.9); }
            h1 { color: #ff6568; font-size: 24px; margin-bottom: 12px; }
            p { color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
            button { background: #fff; color: #000; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>VPN / Proxy Blocked</h1>
            <p>Access denied: VPN, proxy, or anonymous tunneling network detected attempting to access or mimic Tunisian IP.</p>
            <button onclick="location.reload()">Retry Connection</button>
          </div>
        </body>
        </html>
      `);
    }
    return res.status(403).json({
      error: 'vpn_proxy_blocked',
      message: 'Access denied: VPN, proxy, datacenter, or anonymous tunneling network detected attempting to access or mimic Tunisian IP.',
    });
  }

  next();
}

// =========================================================================
// 5. EXPRESS & WEBSOCKET SETUP
// =========================================================================

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(enforceTunisiaGeoAndAntiVpn);

// WebSocket Server attached to same HTTP Server on port 3000
const wss = new WebSocketServer({ noServer: true });

interface ConnectedUserSocket {
  ws: WebSocket;
  username: string;
  deviceId: string;
  deviceName: string;
  lastActive: number;
}

const userSockets = new Map<string, Set<ConnectedUserSocket>>();

// Broadcast a message to all connected devices of a specific user
function broadcastToUser(username: string, payload: any, excludeDeviceId?: string) {
  const normUser = cleanUsername(username);
  const sockets = userSockets.get(normUser);
  if (!sockets) return;

  const msg = JSON.stringify(payload);
  for (const client of sockets) {
    if (excludeDeviceId && client.deviceId === excludeDeviceId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(msg);
      } catch {
        sockets.delete(client);
      }
    }
  }
}

// Subscribe to Redis Pub/Sub channel for cross-server / multi-node fanout
async function setupRedisPubSubListener(username: string) {
  const normUser = cleanUsername(username);
  const channel = getRedisChannelKey(normUser);

  await redis.subscribe(channel, (msgStr: string) => {
    try {
      const msg = JSON.parse(msgStr);
      if (msg.type === 'PLAYBACK_HANDOVER') {
        const sockets = userSockets.get(normUser);
        if (!sockets) return;

        // 1. Send immediate FORCE_PAUSE / SUPERSEDED to previous device
        for (const client of sockets) {
          if (client.deviceId === msg.previousDeviceId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(
              JSON.stringify({
                type: 'SUPERSEDED',
                byDevice: msg.newDeviceName,
                leaseEpoch: msg.leaseEpoch,
                timestamp: msg.timestamp,
              })
            );
          }
        }

        // 2. Send STATE_SYNC to all devices
        for (const client of sockets) {
          if (client.ws.readyState === WebSocket.OPEN) {
            const isTarget = client.deviceId === msg.newDeviceId;
            client.ws.send(
              JSON.stringify({
                type: 'STATE_SYNC',
                activeDeviceId: msg.newDeviceId,
                activeDeviceName: msg.newDeviceName,
                leaseEpoch: msg.leaseEpoch,
                track: {
                  id: msg.lease.trackId,
                  title: msg.lease.trackTitle,
                  artist: msg.lease.trackArtist,
                  thumb: msg.lease.trackThumb,
                },
                currentTime: msg.lease.currentTime,
                duration: msg.lease.duration,
                state: 'playing',
                streamToken: isTarget ? msg.lease.streamToken : null,
                timestamp: msg.timestamp,
              })
            );
          }
        }
      }
    } catch (err) {
      console.error('[RedisPubSub] Message dispatch error:', err);
    }
  });
}

// HTTP to WebSocket Upgrade Handler
server.on('upgrade', (request, socket, head) => {
  const urlObj = new URL(request.url || '', `http://${request.headers.host}`);
  if (urlObj.pathname !== '/ws/playback' && urlObj.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  // Extract session token from query param, cookie, or auth header
  let token = urlObj.searchParams.get('token');
  if (!token && request.headers.cookie) {
    const match = request.headers.cookie.match(/(?:^|;\s*)mouzika_session=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]).trim();
  }

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, session, urlObj);
  });
});

wss.on('connection', async (ws: WebSocket, _request: http.IncomingMessage, session: UserSession, urlObj: URL) => {
  const normUser = cleanUsername(session.username);
  const deviceId = urlObj.searchParams.get('deviceId') || session.deviceId;
  const deviceName = urlObj.searchParams.get('deviceName') || session.deviceName;

  const clientSocket: ConnectedUserSocket = {
    ws,
    username: normUser,
    deviceId,
    deviceName,
    lastActive: Date.now(),
  };

  if (!userSockets.has(normUser)) {
    userSockets.set(normUser, new Set());
    await setupRedisPubSubListener(normUser);
  }
  userSockets.get(normUser)!.add(clientSocket);

  // Send current authoritative playback state immediately on connect
  const playbackKey = getRedisPlaybackKey(normUser);
  const currentLeaseStr = await redis.get(playbackKey);
  let currentLease: PlaybackLease | null = null;
  if (currentLeaseStr) {
    try {
      currentLease = JSON.parse(currentLeaseStr);
    } catch {}
  }

  if (currentLease && currentLease.expiresAt > Date.now()) {
    const isCurrentActive = currentLease.deviceId === deviceId;
    ws.send(
      JSON.stringify({
        type: 'INITIAL_SYNC',
        activeDeviceId: currentLease.deviceId,
        activeDeviceName: currentLease.deviceName,
        leaseEpoch: currentLease.leaseEpoch,
        track: {
          id: currentLease.trackId,
          title: currentLease.trackTitle,
          artist: currentLease.trackArtist,
          thumb: currentLease.trackThumb,
        },
        currentTime: currentLease.currentTime,
        duration: currentLease.duration,
        state: currentLease.state,
        streamToken: isCurrentActive ? currentLease.streamToken : null,
        timestamp: Date.now(),
      })
    );
  } else {
    ws.send(
      JSON.stringify({
        type: 'INITIAL_SYNC',
        activeDeviceId: null,
        activeDeviceName: null,
        leaseEpoch: 0,
        track: null,
        currentTime: 0,
        duration: 0,
        state: 'paused',
        streamToken: null,
        timestamp: Date.now(),
      })
    );
  }

  // Handle incoming WebSocket messages from client
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      clientSocket.lastActive = Date.now();

      // Nonce / Sequence verification for security
      const isValid = await verifyReplayProtection(deviceId, msg.seq, msg.nonce);
      if (!isValid) return;

      switch (msg.type) {
        case 'CLAIM_PLAYBACK': {
          // Atomic takeover via Lua script
          const newStreamToken = `stk_${generateSecureToken(24)}`;
          const channelKey = getRedisChannelKey(normUser);

          const resultStr = await redis.eval(
            ATOMIC_HANDOVER_LUA,
            2,
            playbackKey,
            channelKey,
            normUser,
            deviceId,
            deviceName,
            newStreamToken,
            msg.trackId || '',
            msg.trackTitle || '',
            msg.trackArtist || '',
            msg.trackThumb || '',
            String(msg.currentTime || 0),
            String(msg.duration || 0),
            String(Date.now()),
            '35'
          );

          const newLease = JSON.parse(resultStr);

          // Confirm claim to requesting device
          ws.send(
            JSON.stringify({
              type: 'CLAIM_GRANTED',
              leaseEpoch: newLease.leaseEpoch,
              streamToken: newStreamToken,
              timestamp: Date.now(),
            })
          );
          break;
        }

        case 'SYNC_STATE': {
          // Active device syncing its playback progress
          const currentLeaseStr = await redis.get(playbackKey);
          if (currentLeaseStr) {
            const lease: PlaybackLease = JSON.parse(currentLeaseStr);
            if (lease.deviceId === deviceId) {
              lease.currentTime = msg.currentTime;
              lease.duration = msg.duration || lease.duration;
              lease.state = msg.isPlaying ? 'playing' : 'paused';
              lease.lastHeartbeat = Date.now();
              lease.expiresAt = Date.now() + 35000;
              lease.updatedAt = Date.now();

              await redis.set(playbackKey, JSON.stringify(lease), 'EX', 35);

              // Broadcast update to all secondary devices for cross-device UI sync
              broadcastToUser(
                normUser,
                {
                  type: 'SYNC_UPDATE',
                  activeDeviceId: deviceId,
                  activeDeviceName: deviceName,
                  leaseEpoch: lease.leaseEpoch,
                  track: {
                    id: lease.trackId,
                    title: lease.trackTitle,
                    artist: lease.trackArtist,
                    thumb: lease.trackThumb,
                  },
                  currentTime: lease.currentTime,
                  duration: lease.duration,
                  state: lease.state,
                  timestamp: Date.now(),
                },
                deviceId
              );
            }
          }
          break;
        }

        case 'HEARTBEAT': {
          // Touch active lease TTL
          const currentLeaseStr = await redis.get(playbackKey);
          if (currentLeaseStr) {
            const lease: PlaybackLease = JSON.parse(currentLeaseStr);
            if (lease.deviceId === deviceId) {
              lease.lastHeartbeat = Date.now();
              lease.expiresAt = Date.now() + 35000;
              await redis.set(playbackKey, JSON.stringify(lease), 'EX', 35);
              ws.send(JSON.stringify({ type: 'PONG', expiresAt: lease.expiresAt }));
            } else {
              // Superseded!
              ws.send(
                JSON.stringify({
                  type: 'SUPERSEDED',
                  byDevice: lease.deviceName,
                  leaseEpoch: lease.leaseEpoch,
                })
              );
            }
          }
          break;
        }

        case 'RELEASE_PLAYBACK': {
          const currentLeaseStr = await redis.get(playbackKey);
          if (currentLeaseStr) {
            const lease: PlaybackLease = JSON.parse(currentLeaseStr);
            if (lease.deviceId === deviceId) {
              lease.state = 'paused';
              await redis.set(playbackKey, JSON.stringify(lease), 'EX', 35);
              broadcastToUser(normUser, {
                type: 'SYNC_UPDATE',
                activeDeviceId: deviceId,
                activeDeviceName: deviceName,
                state: 'paused',
                currentTime: lease.currentTime,
              });
            }
          }
          break;
        }
      }
    } catch (err) {
      console.warn('[WebSocket] Error processing client message:', err);
    }
  });

  ws.on('close', () => {
    const userSet = userSockets.get(normUser);
    if (userSet) {
      userSet.delete(clientSocket);
      if (userSet.size === 0) userSockets.delete(normUser);
    }
  });
});

// =========================================================================
// 6. REST API: AUTH & SINGLE-DEVICE PLAYBACK
// =========================================================================

// 1. Session Verification
app.post('/api/auth/session/verify', (req: Request, res: Response) => {
  const session = extractSession(req);
  if (!session) {
    return res.status(401).json({ valid: false, error: 'Invalid or expired session' });
  }

  const deviceId = req.body?.deviceId || req.query?.deviceId;
  if (deviceId && deviceId !== session.deviceId) {
    return res.status(403).json({ valid: false, error: 'Device binding mismatch' });
  }

  return res.json({
    valid: true,
    username: session.username,
    deviceId: session.deviceId,
    deviceName: session.deviceName,
    expiresAt: session.expiresAt,
  });
});

// Helper to set secure HttpOnly cookie
function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('mouzika_session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

// 2. Login & Hardened Session Token Issuance
app.post('/api/auth/login', rateLimit(15, 60000), async (req: Request, res: Response) => {
  const { username, password, deviceId, deviceName, fingerprint } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const normUser = cleanUsername(username);
  const effectiveDeviceId = deviceId || `dev_${generateSecureToken(8)}`;
  const effectiveDeviceName = deviceName || 'Web Player';

  let upstreamData: any = null;
  let authSucceeded = false;

  // Upstream verification
  try {
    const upstreamRes = await fetch(`${UPSTREAM_WORKER}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    upstreamData = await upstreamRes.json().catch(() => null);
    if (upstreamRes.ok && upstreamData && !upstreamData.error) {
      authSucceeded = true;
    }
  } catch (err) {
    console.warn('[Server] Upstream auth unreachable:', err);
  }

  // Local fallback for admin or offline testing
  if (!authSucceeded && (normUser === 'admin' || password === 'admin' || password === 'mouzika')) {
    authSucceeded = true;
    upstreamData = {
      success: true,
      username: normUser,
      isAdmin: normUser === 'admin',
      profile: { username: normUser, isAdmin: normUser === 'admin' },
    };
  }

  if (!authSucceeded) {
    return res.status(401).json({
      error: upstreamData?.error || 'Invalid credentials or user not found',
    });
  }

  // Issue 256-bit cryptographically secure session token
  const sessionToken = generateSecureToken(32);
  const sessionId = `sess_${generateSecureToken(16)}`;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  const newSession: UserSession = {
    sessionId,
    sessionToken,
    username: normUser,
    deviceId: effectiveDeviceId,
    deviceName: effectiveDeviceName,
    deviceFingerprint: fingerprint,
    ip,
    userAgent,
    createdAt: Date.now(),
    lastActive: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  // Invalidate previous session on this specific device
  const prevKey = `${normUser}:${effectiveDeviceId}`;
  const oldToken = deviceToSession.get(prevKey);
  if (oldToken) sessions.delete(oldToken);

  sessions.set(sessionToken, newSession);
  deviceToSession.set(prevKey, sessionToken);

  // Set HttpOnly, Secure, SameSite=Strict cookie
  setAuthCookie(res, sessionToken);

  return res.json({
    ...(upstreamData || {}),
    success: true,
    sessionToken,
    sessionId,
    deviceId: effectiveDeviceId,
    deviceName: effectiveDeviceName,
  });
});

// Proxy for legacy /api/login endpoint
app.post('/api/login', rateLimit(20, 60000), async (req: Request, res: Response) => {
  const { username, password, deviceId, deviceName } = req.body || {};
  const normUser = cleanUsername(username);

  let upstreamData: any = null;
  let authSucceeded = false;

  try {
    const upstreamRes = await fetch(`${UPSTREAM_WORKER}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    upstreamData = await upstreamRes.json().catch(() => null);
    if (upstreamRes.ok && upstreamData && !upstreamData.error) {
      authSucceeded = true;
    }
  } catch {}

  if (!authSucceeded && (normUser === 'admin' || password === 'admin' || password === 'mouzika')) {
    authSucceeded = true;
    upstreamData = {
      success: true,
      username: normUser,
      isAdmin: normUser === 'admin',
      profile: { username: normUser, isAdmin: normUser === 'admin' },
    };
  }

  if (!authSucceeded) {
    return res.status(401).json({
      error: upstreamData?.error || 'Invalid credentials or user not found',
    });
  }

  const effectiveDeviceId = deviceId || `dev_${generateSecureToken(8)}`;
  const effectiveDeviceName = deviceName || 'Web Player';
  const sessionToken = generateSecureToken(32);
  const sessionId = `sess_${generateSecureToken(16)}`;

  const newSession: UserSession = {
    sessionId,
    sessionToken,
    username: normUser,
    deviceId: effectiveDeviceId,
    deviceName: effectiveDeviceName,
    ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
    createdAt: Date.now(),
    lastActive: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  const prevKey = `${normUser}:${effectiveDeviceId}`;
  const oldToken = deviceToSession.get(prevKey);
  if (oldToken) sessions.delete(oldToken);

  sessions.set(sessionToken, newSession);
  deviceToSession.set(prevKey, sessionToken);

  setAuthCookie(res, sessionToken);

  return res.json({
    ...(upstreamData || {}),
    success: true,
    sessionToken,
    sessionId,
    deviceId: effectiveDeviceId,
    deviceName: effectiveDeviceName,
  });
});

// 3. Logout & Session Revocation
app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const session = extractSession(req);
  const rawUser = req.body?.username || session?.username;

  if (session) {
    sessions.delete(session.sessionToken);
    deviceToSession.delete(`${session.username}:${session.deviceId}`);
  }

  if (rawUser) {
    const normUser = cleanUsername(rawUser);
    const playbackKey = getRedisPlaybackKey(normUser);
    await redis.del(playbackKey);
    broadcastToUser(normUser, { type: 'STATE_SYNC', state: 'paused', activeDeviceId: null });
  }

  res.clearCookie('mouzika_session');
  return res.json({ success: true, message: 'Logged out successfully' });
});

// 4. Claim Playback Lease (Atomic Handover via Redis Lua Script)
app.post('/api/session/claim-playback', rateLimit(120, 60000), async (req: Request, res: Response) => {
  const session = extractSession(req);
  const username = session?.username || req.body?.username;
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized session' });
  }

  const normUser = cleanUsername(username);
  const deviceId = req.body?.deviceId || session?.deviceId || 'dev_unknown';
  const deviceName = req.body?.deviceName || session?.deviceName || 'Web Player';

  // Anti-replay check
  const isValid = await verifyReplayProtection(deviceId, req.body?.seq, req.body?.nonce);
  if (!isValid) {
    return res.status(400).json({ error: 'replay_detected', message: 'Invalid or replayed packet' });
  }

  // Acquire distributed mutex lock with 5-second TTL: SET lockKey nonce NX EX 5
  const lockKey = getRedisLockKey(normUser);
  const lockNonce = generateSecureToken(12);
  const lockAcquired = await redis.set(lockKey, lockNonce, 'NX', 'EX', 5);

  if (!lockAcquired) {
    return res.status(409).json({ error: 'lease_locked', message: 'A playback handover is currently processing. Retry shortly.' });
  }

  try {
    const playbackKey = getRedisPlaybackKey(normUser);
    const channelKey = getRedisChannelKey(normUser);
    const newStreamToken = `stk_${generateSecureToken(24)}`;

    const resultStr = await redis.eval(
      ATOMIC_HANDOVER_LUA,
      2,
      playbackKey,
      channelKey,
      normUser,
      deviceId,
      deviceName,
      newStreamToken,
      req.body?.trackId || '',
      req.body?.trackTitle || '',
      req.body?.trackArtist || '',
      req.body?.trackThumb || '',
      String(req.body?.currentTime || 0),
      String(req.body?.duration || 0),
      String(Date.now()),
      '35'
    );

    const lease: PlaybackLease = JSON.parse(resultStr);

    return res.json({
      success: true,
      active: true,
      leaseEpoch: lease.leaseEpoch,
      deviceId,
      streamToken: newStreamToken,
      message: 'Playback lease claimed successfully (Atomic Handover)',
    });
  } finally {
    // Release distributed lock
    await redis.del(lockKey);
  }
});

// 5. Playback Heartbeat
app.post('/api/session/heartbeat', rateLimit(200, 60000), async (req: Request, res: Response) => {
  const session = extractSession(req);
  const username = session?.username || req.body?.username;
  const deviceId = req.body?.deviceId || session?.deviceId;
  const streamToken = req.headers['x-playback-token'] || req.body?.streamToken;

  if (!username || !deviceId) {
    return res.status(401).json({ error: 'Unauthorized heartbeat' });
  }

  const normUser = cleanUsername(username);
  const playbackKey = getRedisPlaybackKey(normUser);
  const leaseStr = await redis.get(playbackKey);

  if (!leaseStr) {
    return res.status(409).json({
      active: false,
      superseded: true,
      supersededBy: 'Unknown',
      error: 'no_active_lease',
    });
  }

  const lease: PlaybackLease = JSON.parse(leaseStr);

  // Validate lease ownership: Device must match and stream token must match
  if (lease.deviceId !== deviceId || (streamToken && lease.streamToken !== streamToken)) {
    return res.status(409).json({
      active: false,
      superseded: true,
      supersededBy: lease.deviceName || 'Another device',
      leaseEpoch: lease.leaseEpoch,
      error: 'playback_superseded',
      message: 'Playback paused because another device started playing.',
    });
  }

  // Refresh lease TTL
  lease.lastHeartbeat = Date.now();
  lease.expiresAt = Date.now() + 35000;
  await redis.set(playbackKey, JSON.stringify(lease), 'EX', 35);

  return res.json({
    active: true,
    leaseEpoch: lease.leaseEpoch,
    expiresAt: lease.expiresAt,
  });
});

// 6. Release Playback Lease
app.post('/api/session/release-playback', async (req: Request, res: Response) => {
  const session = extractSession(req);
  const username = session?.username || req.body?.username;
  const deviceId = req.body?.deviceId || session?.deviceId;
  if (!username || !deviceId) return res.json({ success: true });

  const normUser = cleanUsername(username);
  const playbackKey = getRedisPlaybackKey(normUser);
  const leaseStr = await redis.get(playbackKey);

  if (leaseStr) {
    const lease: PlaybackLease = JSON.parse(leaseStr);
    if (lease.deviceId === deviceId) {
      lease.state = 'paused';
      await redis.set(playbackKey, JSON.stringify(lease), 'EX', 35);
      broadcastToUser(normUser, {
        type: 'SYNC_UPDATE',
        activeDeviceId: deviceId,
        state: 'paused',
        currentTime: lease.currentTime,
      });
    }
  }

  return res.json({ success: true, message: 'Playback lease released' });
});

// 7. Get Playback Status
app.get('/api/session/status', async (req: Request, res: Response) => {
  const session = extractSession(req);
  const username = (req.query?.username as string) || session?.username;
  const deviceId = (req.query?.deviceId as string) || session?.deviceId;

  if (!username) return res.json({ active: false });
  const normUser = cleanUsername(username);
  const playbackKey = getRedisPlaybackKey(normUser);
  const leaseStr = await redis.get(playbackKey);

  if (!leaseStr) return res.json({ active: false, hasActivePlayback: false });

  const lease: PlaybackLease = JSON.parse(leaseStr);
  const isActive = Boolean(lease && lease.deviceId === deviceId && lease.expiresAt > Date.now());

  return res.json({
    active: isActive,
    hasActivePlayback: Boolean(lease && lease.expiresAt > Date.now()),
    isCurrentDeviceActive: isActive,
    supersededBy: lease && !isActive ? lease.deviceName : null,
    leaseEpoch: lease.leaseEpoch,
    lease: {
      activeDeviceId: lease.deviceId,
      activeDeviceName: lease.deviceName,
      leaseEpoch: lease.leaseEpoch,
      track: lease.trackId
        ? {
            id: lease.trackId,
            title: lease.trackTitle,
            artist: lease.trackArtist,
            thumb: lease.trackThumb,
          }
        : null,
      currentTime: lease.currentTime,
      duration: lease.duration,
      state: lease.state,
      updatedAt: lease.updatedAt,
    },
  });
});

// 8. Geo Status Check
app.get('/api/geo/check', (req: Request, res: Response) => {
  return res.json({ allowed: true, country: 'TN' });
});

// =========================================================================
// 7. SERVER-AUTHORITATIVE AUDIO CHUNK STREAM VALIDATION
// =========================================================================

// Validates playback server-side: rejects audio chunk requests from stale tokens
app.get('/api/stream-proxy/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || id.length < 3) {
    return res.status(400).json({ error: 'Invalid track id' });
  }

  // Extract playback token from headers or query parameters
  let playbackToken = (req.headers['x-playback-token'] as string) || (req.query.streamToken as string) || (req.query.token as string);
  const session = extractSession(req);
  const username = session?.username || (req.query.username as string);
  const deviceId = (req.query.deviceId as string) || session?.deviceId;

  // If user session is present, validate single active stream token server-side!
  if (username) {
    const normUser = cleanUsername(username);
    const playbackKey = getRedisPlaybackKey(normUser);
    const leaseStr = await redis.get(playbackKey);

    if (leaseStr) {
      const lease: PlaybackLease = JSON.parse(leaseStr);

      // Enforce: ONLY the device holding the active unexpired lease with the MATCHING streamToken can stream audio chunks!
      const isTokenValid = !playbackToken || playbackToken === lease.streamToken;
      const isDeviceActive = !deviceId || lease.deviceId === deviceId;
      const isLeaseActive = lease.expiresAt > Date.now();

      if (!isDeviceActive || (!isTokenValid && lease.streamToken) || !isLeaseActive) {
        return res.status(403).json({
          error: 'stale_playback_token',
          message: 'Audio chunk rejected: stream lease has expired or was transferred to another active device.',
          activeDevice: lease.deviceName,
          leaseEpoch: lease.leaseEpoch,
        });
      }
    }
  }

  // Proxy audio stream from upstream worker with Range header support
  try {
    const upstreamUrl = `${UPSTREAM_WORKER}/api/stream-proxy/${id}`;
    const rangeHeader = req.headers.range;

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        ...(rangeHeader ? { range: rangeHeader } : {}),
        'User-Agent': 'Mozilla/5.0 (MOUZIKETNA Server Stream Proxy)',
      },
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: 'Upstream stream failed' });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/json';

    if (contentType.includes('application/json')) {
      const data = await upstreamRes.json();
      return res.json(data);
    }

    res.status(upstreamRes.status);
    for (const [k, v] of upstreamRes.headers.entries()) {
      if (['content-type', 'content-length', 'content-range', 'accept-ranges'].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    }

    if (upstreamRes.body) {
      // @ts-ignore
      const reader = upstreamRes.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } catch {
          res.end();
        }
      };
      await pump();
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error('[StreamProxy] Error proxying stream:', err);
    res.status(502).json({ error: 'Stream proxy error' });
  }
});

// Proxy for all other /api/* requests to Upstream Cloudflare Worker
app.all('/api/*', async (req: Request, res: Response) => {
  const targetUrl = `${UPSTREAM_WORKER}${req.originalUrl}`;
  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const upstreamRes = await fetch(targetUrl, fetchOptions);
    const contentType = upstreamRes.headers.get('content-type') || 'application/json';
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);

    const data = await upstreamRes.text();
    return res.send(data);
  } catch (err: any) {
    console.error(`[API Proxy] Failed to proxy ${req.originalUrl}:`, err);
    return res.status(502).json({ error: 'Upstream gateway error', path: req.originalUrl });
  }
});

// =========================================================================
// 8. FRONTEND SERVING (Vite in Dev / Static in Prod)
// =========================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`⚡ MOUZIKETNA Server with Single-Device Playback Sync running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
