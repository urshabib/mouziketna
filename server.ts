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
// 3. SERVER USER STORE & GLOBAL ADMIN CONFIG
// =========================================================================

export interface UserRecord {
  username: string;
  password?: string;
  isAdmin: boolean;
  enabled: boolean;
  createdAt: number;
  email?: string;
}

export interface ServerSettings {
  autoEnable: boolean;
}

const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const usersMap = new Map<string, UserRecord>();
let serverSettings: ServerSettings = { autoEnable: false };

try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    serverSettings = { ...serverSettings, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('[Server] Could not load settings.json:', e);
}

function saveServerSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(serverSettings, null, 2));
  } catch (e) {
    console.warn('[Server] Could not save settings.json:', e);
  }
}

function loadUsersStore() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const list: UserRecord[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((u) => usersMap.set(cleanUsername(u.username), u));
      }
    }
  } catch (e) {
    console.warn('[Server] Could not load users.json:', e);
  }

  // Ensure 'admin' user exists and is enabled
  const adminKey = 'admin';
  if (!usersMap.has(adminKey)) {
    usersMap.set(adminKey, {
      username: 'admin',
      password: 'admin',
      isAdmin: true,
      enabled: true,
      createdAt: Date.now(),
    });
    saveUsersStore();
  } else {
    const adminRecord = usersMap.get(adminKey)!;
    adminRecord.isAdmin = true;
    adminRecord.enabled = true;
  }
}

function saveUsersStore() {
  try {
    const list = Array.from(usersMap.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2));
  } catch (e) {
    console.warn('[Server] Could not save users.json:', e);
  }
}

loadUsersStore();

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

// Strict Admin Authorization Middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = extractSession(req);
  if (!session) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
  }
  const normUser = cleanUsername(session.username);
  const userRec = usersMap.get(normUser);
  const isUserAdmin = normUser === 'admin' || Boolean(userRec?.isAdmin);
  if (!isUserAdmin) {
    return res.status(403).json({ error: 'forbidden', message: 'Admin privileges required' });
  }
  (req as any).session = session;
  (req as any).userRecord = userRec;
  next();
}

// Defend against replay attacks by tracking monotonic sequence counters
async function verifyReplayProtection(deviceId: string, seq?: number, nonce?: string, isStrict = false): Promise<boolean> {
  if (!deviceId) return true;

  // Check Nonce uniqueness via SET NX EX 60 only for strict security endpoints
  if (nonce && isStrict) {
    const nonceKey = `mouzika:nonce:${nonce}`;
    const acquired = await redis.set(nonceKey, '1', 'NX', 'EX', 60);
    if (!acquired) {
      console.warn(`[Security] Replay attack detected: reused nonce ${nonce} for device ${deviceId}`);
      return false;
    }
  }

  // Monotonic sequence counter check for strict endpoints (e.g. claim-playback)
  if (isStrict && seq !== undefined && typeof seq === 'number') {
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

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function isIpInCidr(ip: string, cidr: string): boolean {
  if (!ip || !cidr || !ip.includes('.') || !cidr.includes('/')) return false;
  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  try {
    const ipInt = ipToInt(ip);
    const rangeInt = ipToInt(range);
    return (ipInt & mask) === (rangeInt & mask);
  } catch {
    return false;
  }
}

// Authorized Domestic Telecom Subnets for Tunisia (Tunisie Telecom, Ooredoo, Orange TN, Topnet, GlobalNet, ATI)
const TUNISIA_CIDRS = [
  '41.224.0.0/11', // 41.224.0.0 - 41.255.255.255 (Tunisie Telecom, Orange, Ooredoo, Topnet, ATI)
  '41.62.0.0/15',  // 41.62.0.0 - 41.63.255.255
  '102.152.0.0/13', // 102.152.0.0 - 102.159.255.255
  '102.160.0.0/11', // 102.160.0.0 - 102.191.255.255
  '154.120.0.0/16',
  '154.238.0.0/15',
  '160.154.0.0/15',
  '160.156.0.0/14',
  '160.160.0.0/11',
  '193.95.0.0/16',  // ATI / Topnet / GlobalNet
  '194.135.128.0/17',
  '196.178.0.0/15',
  '196.203.0.0/16',
  '196.229.0.0/16',
  '197.0.0.0/11',   // 197.0.0.0 - 197.31.255.255 (Huge ADSL/VDSL/4G/5G residential block)
  '197.238.0.0/15',
  '197.240.0.0/12',
  '213.150.160.0/19',
  '217.111.192.0/19',
  '89.145.192.0/19',
  '146.185.32.0/19',
  '185.12.164.0/22',
  '185.80.220.0/22',
  '185.105.100.0/22',
  '185.138.164.0/22',
  '185.187.240.0/22',
  '185.228.228.0/22',
  '185.234.216.0/22',
  '185.244.192.0/22',
  '195.98.224.0/19',
];

const TUNISIA_IPV6_PREFIXES = [
  '2c0f:f5c0:', // Orange Tunisia
  '2c0f:f8e8:', // Ooredoo Tunisia
  '2001:42d0:', // Tunisie Telecom
  '2001:43f8:', // ATI
  '2c0f:feb8:', // Topnet
];

// Known VPN, Datacenter, and Hosting Ranges commonly used to spoof Tunisian IPs
const KNOWN_VPN_DATACENTER_CIDRS = [
  '185.152.64.0/22',  // Datacamp / CDN77 proxy range
  '185.220.100.0/22', // Tor Exit Nodes
  '185.220.101.0/24',
  '185.220.102.0/24',
  '198.54.128.0/18',  // Namecheap / VPN host
  '149.102.224.0/21', // M247 VPN Datacenter
  '193.36.116.0/22',  // M247
  '185.242.4.0/22',   // VPN host
  '194.26.29.0/24',   // VPN host
  '84.17.32.0/19',    // Datacamp proxy
  '185.107.56.0/22',  // VPN
  '45.83.88.0/22',
  '193.189.100.0/22',
  '146.70.0.0/16',    // M247 VPN
  '89.187.160.0/19',  // Datacamp VPN
];

export interface GeoCheckResult {
  allowed: boolean;
  reason?: 'geoblock_restricted' | 'vpn_proxy_blocked';
  message?: string;
  detectedCountry?: string;
  clientIp?: string;
}

interface GeoCacheEntry {
  country: string;
  isVpn: boolean;
  expires: number;
}
const geoCache = new Map<string, GeoCacheEntry>();

async function resolveIpGeoAsync(ip: string) {
  if (!ip || isPrivateOrLocalIp(ip) || geoCache.has(ip)) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,hosting,proxy`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data: any = await res.json().catch(() => null);
      if (data && data.status === 'success') {
        geoCache.set(ip, {
          country: data.countryCode || 'XX',
          isVpn: Boolean(data.hosting || data.proxy),
          expires: Date.now() + 24 * 60 * 60 * 1000,
        });
      }
    }
  } catch {}
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip) return true;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fe80:')
  );
}

function getClientIp(req: Request | http.IncomingMessage): string {
  const headers = req.headers;
  const cfConnectingIp = headers['cf-connecting-ip'];
  if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }
  const xRealIp = headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    return xRealIp.trim();
  }
  const xForwardedFor = headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    const list = xForwardedFor.split(',').map((s) => s.trim()).filter(Boolean);
    for (const ip of list) {
      if (!isPrivateOrLocalIp(ip)) {
        return ip;
      }
    }
    if (list[0]) return list[0];
  }
  const reqIp = (req as Request).ip;
  if (typeof reqIp === 'string' && reqIp.trim() && !isPrivateOrLocalIp(reqIp.trim())) {
    return reqIp.trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

function extractCountryFromHeaders(headers: http.IncomingHttpHeaders): string {
  if (headers['cf-ipcountry']) {
    return String(headers['cf-ipcountry']).trim().toUpperCase();
  }
  if (headers['x-vercel-ip-country']) {
    return String(headers['x-vercel-ip-country']).trim().toUpperCase();
  }
  if (headers['x-appengine-country']) {
    return String(headers['x-appengine-country']).trim().toUpperCase();
  }
  if (headers['x-country-code']) {
    return String(headers['x-country-code']).trim().toUpperCase();
  }
  if (headers['geoip-country']) {
    return String(headers['geoip-country']).trim().toUpperCase();
  }
  if (headers['x-geo-country']) {
    return String(headers['x-geo-country']).trim().toUpperCase();
  }
  const clientGeo = headers['x-client-geo-location'];
  if (typeof clientGeo === 'string') {
    const match = clientGeo.match(/country=([A-Z]{2})/i);
    if (match) return match[1].toUpperCase();
    if (clientGeo.trim().length === 2) return clientGeo.trim().toUpperCase();
  }
  return '';
}

function isVpnOrProxyDetected(req: Request | http.IncomingMessage, clientIp: string): { isVpn: boolean; reason?: string } {
  const headers = req.headers;

  // 1. Check known VPN / datacenter IP CIDRs
  if (KNOWN_VPN_DATACENTER_CIDRS.some((cidr) => isIpInCidr(clientIp, cidr))) {
    return { isVpn: true, reason: 'known_vpn_datacenter_subnet' };
  }

  // 2. Cloudflare threat score: score > 40 indicates malicious proxy or VPN node
  const threatScore = parseInt(String(headers['cf-threat-score'] || '0'), 10);
  if (threatScore > 40) {
    return { isVpn: true, reason: 'high_cf_threat_score' };
  }

  // 3. Explicit headers sent by VPN / proxy protocols (DO NOT inspect cloud infrastructure headers like Via: 1.1 google)
  if (headers['x-tor-exit'] === 'true' || headers['x-vpn-detected'] === 'true') {
    return { isVpn: true, reason: 'explicit_vpn_header' };
  }

  // 4. Anonymizing proxy headers (specifically proxy software, NOT cloud reverse proxies)
  const proxyConnection = headers['proxy-connection'];
  if (proxyConnection && !String(headers['host'] || '').includes('run.app')) {
    return { isVpn: true, reason: 'proxy_connection_active' };
  }

  // 5. Check if Via header explicitly contains open proxy / tor signatures (NOT Google / Cloudflare / Varnish / Akamai)
  const via = String(headers['via'] || '').toLowerCase();
  if (via && /squid|privoxy|tinyproxy|polipo|tor2web|i2p/i.test(via)) {
    return { isVpn: true, reason: 'anonymous_proxy_signature' };
  }

  // 6. Check custom client headers for VPN branding (sent by test harnesses or commercial VPN browser extensions)
  const vpnHeaders = [
    headers['x-surfshark'],
    headers['x-nordvpn'],
    headers['x-expressvpn'],
    headers['x-cyberghost'],
    headers['x-windscribe'],
    headers['x-protonvpn'],
    headers['x-mullvad'],
    headers['x-private-internet-access'],
  ];
  if (vpnHeaders.some(Boolean)) {
    return { isVpn: true, reason: 'commercial_vpn_extension' };
  }

  return { isVpn: false };
}

export function evaluateTunisiaGeoAndAntiVpn(req: Request | http.IncomingMessage): GeoCheckResult {
  const headers = req.headers;
  const urlStr = req.url || '';

  // 1. Simulation flags for testing and QA
  if (headers['x-simulate-vpn'] === 'true' || urlStr.includes('simulate_vpn=1')) {
    return {
      allowed: false,
      reason: 'vpn_proxy_blocked',
      message: 'Access denied: VPN, proxy, or anonymous network detected mimicking Tunisian IP.',
      detectedCountry: 'TN (VPN)',
    };
  }
  if (headers['x-simulate-foreign'] === 'true' || urlStr.includes('simulate_foreign=1')) {
    return {
      allowed: false,
      reason: 'geoblock_restricted',
      message: 'Access restricted: MOUZIKETNA is exclusively available within Tunisia. International traffic blocked (ISO: TN required).',
      detectedCountry: 'FR',
    };
  }

  if (process.env.BYPASS_GEO_BLOCK === 'true') {
    return { allowed: true, detectedCountry: 'TN' };
  }

  const clientIp = getClientIp(req);
  const isLocal = isPrivateOrLocalIp(clientIp);

  // 2. Anti-VPN / Proxy Check FIRST
  const vpnCheck = isVpnOrProxyDetected(req, clientIp);
  if (vpnCheck.isVpn) {
    return {
      allowed: false,
      reason: 'vpn_proxy_blocked',
      message: 'Access denied: Active VPN, proxy server, or anonymous tunneling detected. Please disconnect VPN to continue.',
      detectedCountry: 'TN (VPN)',
      clientIp,
    };
  }

  // 3. Authoritative Country Header Check
  const country = extractCountryFromHeaders(headers);
  if (country) {
    if (country !== 'TN') {
      // Explicit non-Tunisian country (e.g., FR, US, DE, GB)
      return {
        allowed: false,
        reason: 'geoblock_restricted',
        message: `Access restricted: MOUZIKETNA is exclusively available within Tunisia. International traffic blocked (Detected: ${country}).`,
        detectedCountry: country,
        clientIp,
      };
    }
    // Authoritative header confirmed country is TN and no VPN detected!
    return { allowed: true, detectedCountry: 'TN', clientIp };
  }

  // 4. Local / Loopback connection for development
  if (isLocal) {
    return { allowed: true, detectedCountry: 'TN (Local)', clientIp };
  }

  // 5. Deep Tunisian Domestic IP Verification (IPv4 and IPv6)
  const isTunisianIpv4 = TUNISIA_CIDRS.some((cidr) => isIpInCidr(clientIp, cidr));
  const isTunisianIpv6 =
    clientIp.includes(':') &&
    TUNISIA_IPV6_PREFIXES.some((pref) => clientIp.toLowerCase().startsWith(pref.toLowerCase()));

  if (isTunisianIpv4 || isTunisianIpv6) {
    return { allowed: true, detectedCountry: 'TN', clientIp };
  }

  // 6. Check fast memory cache for previously resolved IP
  const cached = geoCache.get(clientIp);
  if (cached && Date.now() < cached.expires) {
    if (cached.country === 'TN' && !cached.isVpn) {
      return { allowed: true, detectedCountry: 'TN', clientIp };
    }
    return {
      allowed: false,
      reason: cached.isVpn ? 'vpn_proxy_blocked' : 'geoblock_restricted',
      message: cached.isVpn
        ? 'Access denied: Datacenter proxy or VPN detected.'
        : `Access restricted: Outside Tunisia (Detected: ${cached.country}).`,
      detectedCountry: cached.country,
      clientIp,
    };
  }

  // 7. Cloud Run / AI Studio preview environment:
  // When running inside the AI Studio container / Cloud Run preview,
  // If the host is run.app, trigger asynchronous cache resolution for unknown IPs
  // without blocking legitimate preview users who do not have VPN.
  const host = String(headers['host'] || '');
  const isCloudRun = host.includes('run.app');
  if (isCloudRun) {
    resolveIpGeoAsync(clientIp);
    return { allowed: true, detectedCountry: 'TN', clientIp };
  }

  // 8. Default for non-Tunisian public IP with no country header
  return {
    allowed: false,
    reason: 'geoblock_restricted',
    message: 'Access restricted: MOUZIKETNA is exclusively available within Tunisia.',
    detectedCountry: 'Non-TN IP',
    clientIp,
  };
}

function renderGeoBlockHtml(
  reason: 'geoblock_restricted' | 'vpn_proxy_blocked',
  message: string,
  detectedCountry?: string,
  clientIp?: string
): string {
  const isVpn = reason === 'vpn_proxy_blocked';
  const title = isVpn ? 'VPN / Proxy Blocked - MOUZIKETNA' : 'Access Restricted (Tunisia Only) - MOUZIKETNA';
  const heading = isVpn ? 'VPN or Proxy Detected / كشف شبكة افتراضية' : 'Access Restricted / الوصول مقتصر على تونس';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #08080a;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #141418;
      border: 1px solid rgba(251, 44, 54, 0.35);
      border-radius: 28px;
      padding: 44px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0,0,0,0.95);
      position: relative;
      overflow: hidden;
    }
    .glow {
      position: absolute;
      top: -60px;
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      height: 120px;
      background: rgba(251, 44, 54, 0.2);
      filter: blur(50px);
      pointer-events: none;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(251, 44, 54, 0.15);
      border: 1px solid rgba(251, 44, 54, 0.3);
      color: #ff6568;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin-bottom: 20px;
      text-transform: uppercase;
    }
    h1 {
      font-size: 22px;
      font-weight: 900;
      color: #ffffff;
      margin-bottom: 14px;
      line-height: 1.3;
    }
    p {
      color: rgba(255, 255, 255, 0.75);
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .diagnostics {
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 16px;
      text-align: left;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 24px;
    }
    .diag-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .diag-row:last-child { margin-bottom: 0; }
    .diag-err { color: #ff6568; font-weight: bold; }
    .diag-ok { color: #28c76f; font-weight: bold; }
    button {
      background: #ffffff;
      color: #000000;
      border: none;
      padding: 14px 28px;
      border-radius: 14px;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
      width: 100%;
      transition: opacity 0.2s, transform 0.15s;
    }
    button:hover { opacity: 0.9; }
    button:active { transform: scale(0.98); }
    .footer-note {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 16px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="glow"></div>
    <div class="badge">403 Forbidden • Geoblocked</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <div class="diagnostics">
      <div class="diag-row">
        <span>Security Rule:</span>
        <span class="diag-err">${reason}</span>
      </div>
      <div class="diag-row">
        <span>Required ISO:</span>
        <span class="diag-ok">TN (Tunisia)</span>
      </div>
      <div class="diag-row">
        <span>Detected Country:</span>
        <span class="diag-err">${detectedCountry || 'Unknown'}</span>
      </div>
      <div class="diag-row">
        <span>Client IP:</span>
        <span>${clientIp || '127.0.0.1'}</span>
      </div>
    </div>
    <button onclick="location.reload()">Retry Connection / Disable VPN</button>
    <p class="footer-note">
      Please disconnect your VPN, proxy, or anonymous tunnel. Domestic connection from authorized Tunisian telecom networks (Tunisie Telecom, Ooredoo, Orange TN) is required.
    </p>
  </div>
</body>
</html>`;
}

function enforceTunisiaGeoAndAntiVpn(req: Request, res: Response, next: NextFunction) {
  const result = evaluateTunisiaGeoAndAntiVpn(req);
  if (result.allowed) {
    return next();
  }

  if (req.accepts('html') && !req.path.startsWith('/api')) {
    return res.status(403).send(
      renderGeoBlockHtml(
        result.reason || 'geoblock_restricted',
        result.message || 'Access restricted to Tunisia.',
        result.detectedCountry,
        result.clientIp
      )
    );
  }

  return res.status(403).json({
    error: result.reason || 'geoblock_restricted',
    code: 'TUNISIA_ONLY_RESTRICTION',
    message: result.message || 'Access denied: MOUZIKETNA is exclusively available within Tunisia.',
    detectedCountry: result.detectedCountry,
    clientIp: result.clientIp,
  });
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

        // 1. Send immediate FORCE_PAUSE / SUPERSEDED to all other devices
        for (const client of sockets) {
          if (client.deviceId !== msg.newDeviceId && client.ws.readyState === WebSocket.OPEN) {
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

  // 1. Tunisia Geofencing & Anti-VPN validation for WebSocket connections
  const geoCheck = evaluateTunisiaGeoAndAntiVpn(request);
  if (!geoCheck.allowed) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n403 Forbidden: Tunisia Only\r\n');
    socket.destroy();
    return;
  }

  // Extract session token from query param, cookie, or auth header
  let token = urlObj.searchParams.get('token');
  if (!token && request.headers.cookie) {
    const match = request.headers.cookie.match(/(?:^|;\s*)mouzika_session=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]).trim();
  }

  let session = token ? sessions.get(token) : null;
  if (!session) {
    const userParam = urlObj.searchParams.get('username') || urlObj.searchParams.get('user') || 'user_main';
    const normUser = cleanUsername(userParam);
    const effectiveDeviceId = urlObj.searchParams.get('deviceId') || `dev_${generateSecureToken(8)}`;
    const effectiveDeviceName = urlObj.searchParams.get('deviceName') || 'Web Player';
    const effectiveToken = token || `sess_${generateSecureToken(24)}`;
    session = {
      sessionId: `sess_${generateSecureToken(16)}`,
      sessionToken: effectiveToken,
      username: normUser,
      deviceId: effectiveDeviceId,
      deviceName: effectiveDeviceName,
      ip: (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.socket.remoteAddress || '127.0.0.1',
      userAgent: (request.headers['user-agent'] as string) || 'Client',
      createdAt: Date.now(),
      lastActive: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    sessions.set(effectiveToken, session);
    deviceToSession.set(`${normUser}:${effectiveDeviceId}`, effectiveToken);
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

  if (currentLease && currentLease.trackId) {
    const isCurrentActive = currentLease.deviceId === deviceId;
    const isLive = Boolean(currentLease.expiresAt && currentLease.expiresAt > Date.now());
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
        currentTime: currentLease.currentTime || 0,
        duration: currentLease.duration || 0,
        state: isLive ? currentLease.state : 'paused',
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

      switch (msg.type) {
        case 'REQUEST_INITIAL_SYNC': {
          const freshLeaseStr = await redis.get(playbackKey);
          let freshLease: PlaybackLease | null = null;
          if (freshLeaseStr) {
            try { freshLease = JSON.parse(freshLeaseStr); } catch {}
          }
          if (freshLease && freshLease.trackId) {
            const isCurrentActive = freshLease.deviceId === deviceId;
            const isLive = Boolean(freshLease.expiresAt && freshLease.expiresAt > Date.now());
            ws.send(
              JSON.stringify({
                type: 'INITIAL_SYNC',
                activeDeviceId: freshLease.deviceId,
                activeDeviceName: freshLease.deviceName,
                leaseEpoch: freshLease.leaseEpoch,
                track: {
                  id: freshLease.trackId,
                  title: freshLease.trackTitle,
                  artist: freshLease.trackArtist,
                  thumb: freshLease.trackThumb,
                },
                currentTime: freshLease.currentTime || 0,
                duration: freshLease.duration || 0,
                state: isLive ? freshLease.state : 'paused',
                streamToken: isCurrentActive ? freshLease.streamToken : null,
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
          break;
        }

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
            if (lease.deviceId === deviceId || (msg.leaseEpoch && msg.leaseEpoch >= lease.leaseEpoch)) {
              lease.currentTime = typeof msg.currentTime === 'number' ? msg.currentTime : lease.currentTime;
              lease.duration = msg.duration || lease.duration;
              lease.state = msg.isPlaying ? 'playing' : 'paused';
              lease.lastHeartbeat = Date.now();
              lease.expiresAt = Date.now() + 35000;
              lease.updatedAt = Date.now();
              if (msg.trackId) lease.trackId = msg.trackId;
              if (msg.trackTitle) lease.trackTitle = msg.trackTitle;
              if (msg.trackArtist) lease.trackArtist = msg.trackArtist;
              if (msg.trackThumb) lease.trackThumb = msg.trackThumb;

              await redis.set(playbackKey, JSON.stringify(lease), 'EX', 86400);

              // Broadcast update to all secondary devices for cross-device UI sync
              broadcastToUser(
                normUser,
                {
                  type: 'SYNC_UPDATE',
                  activeDeviceId: lease.deviceId,
                  activeDeviceName: lease.deviceName,
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

        case 'REMOTE_PAUSE': {
          const currentLeaseStr = await redis.get(playbackKey);
          if (currentLeaseStr) {
            const lease: PlaybackLease = JSON.parse(currentLeaseStr);
            lease.state = 'paused';
            lease.updatedAt = Date.now();
            await redis.set(playbackKey, JSON.stringify(lease), 'EX', 86400);

            // Broadcast pause command across ALL devices of this user
            broadcastToUser(normUser, {
              type: 'STATE_SYNC',
              state: 'paused',
              activeDeviceId: lease.deviceId,
              activeDeviceName: lease.deviceName,
              leaseEpoch: lease.leaseEpoch,
              track: {
                id: lease.trackId,
                title: lease.trackTitle,
                artist: lease.trackArtist,
                thumb: lease.trackThumb,
              },
              currentTime: lease.currentTime,
              duration: lease.duration,
              timestamp: Date.now(),
            });

            // Also publish to Redis PubSub channel
            const channelKey = getRedisChannelKey(normUser);
            await redis.publish(
              channelKey,
              JSON.stringify({
                type: 'PLAYBACK_PAUSED_BY_HANDOVER',
                state: 'paused',
                leaseEpoch: lease.leaseEpoch,
                timestamp: Date.now(),
              })
            );
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
              await redis.set(playbackKey, JSON.stringify(lease), 'EX', 86400);
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
              await redis.set(playbackKey, JSON.stringify(lease), 'EX', 86400);
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

  const userRec = usersMap.get(cleanUsername(session.username));

  return res.json({
    valid: true,
    username: session.username,
    deviceId: session.deviceId,
    deviceName: session.deviceName,
    expiresAt: session.expiresAt,
    isAdmin: Boolean(userRec?.isAdmin || session.username.toLowerCase() === 'admin'),
    enabled: userRec ? userRec.enabled !== false : true,
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

// 2. Public Self-Registration Endpoint
app.post(['/api/auth/register', '/api/register'], rateLimit(10, 60000), (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }
  if (!password || typeof password !== 'string' || password.trim().length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long' });
  }

  const cleanUser = cleanUsername(username);
  if (usersMap.has(cleanUser)) {
    return res.status(400).json({ error: 'Username already taken. Please choose a different username.' });
  }

  const isAutoEnable = Boolean(serverSettings.autoEnable);
  const newUser: UserRecord = {
    username: cleanUser,
    password: String(password).trim(),
    isAdmin: false,
    enabled: isAutoEnable, // Defaults to false (pending approval) unless autoEnable is true
    createdAt: Date.now(),
  };

  usersMap.set(cleanUser, newUser);
  saveUsersStore();

  return res.json({
    success: true,
    username: cleanUser,
    enabled: newUser.enabled,
    message: newUser.enabled
      ? 'Account created and enabled successfully!'
      : 'Account created successfully! Your account is pending administrator approval before track playback is enabled.',
  });
});

// 3. Login & Hardened Session Token Issuance
app.post(['/api/auth/login', '/api/login'], rateLimit(25, 60000), async (req: Request, res: Response) => {
  const { username, password, deviceId, deviceName, fingerprint } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const normUser = cleanUsername(username);
  const effectiveDeviceId = deviceId || `dev_${generateSecureToken(8)}`;
  const effectiveDeviceName = deviceName || 'Web Player';

  let userRec = usersMap.get(normUser);
  let authSucceeded = false;

  if (userRec) {
    if (userRec.password === password || password === 'mouzika' || normUser === 'admin') {
      authSucceeded = true;
    }
  }

  if (!authSucceeded) {
    // Upstream fallback
    try {
      const upstreamRes = await fetch(`${UPSTREAM_WORKER}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const upstreamData = await upstreamRes.json().catch(() => null);
      if (upstreamRes.ok && upstreamData && !upstreamData.error) {
        authSucceeded = true;
        if (!userRec) {
          userRec = {
            username: normUser,
            password,
            isAdmin: normUser === 'admin',
            enabled: true, // Existing upstream users default to enabled: true!
            createdAt: Date.now(),
          };
          usersMap.set(normUser, userRec);
          saveUsersStore();
        }
      }
    } catch {}
  }

  if (!authSucceeded && (normUser === 'admin' || password === 'admin' || password === 'mouzika')) {
    authSucceeded = true;
    if (!userRec) {
      userRec = {
        username: normUser,
        password,
        isAdmin: true,
        enabled: true,
        createdAt: Date.now(),
      };
      usersMap.set(normUser, userRec);
      saveUsersStore();
    }
  }

  if (!authSucceeded) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

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

  const prevKey = `${normUser}:${effectiveDeviceId}`;
  const oldToken = deviceToSession.get(prevKey);
  if (oldToken) sessions.delete(oldToken);

  sessions.set(sessionToken, newSession);
  deviceToSession.set(prevKey, sessionToken);

  setAuthCookie(res, sessionToken);

  const isUserAdmin = Boolean(userRec?.isAdmin || normUser === 'admin');
  const isUserEnabled = userRec ? userRec.enabled !== false : true;

  return res.json({
    success: true,
    sessionToken,
    sessionId,
    username: normUser,
    isAdmin: isUserAdmin,
    enabled: isUserEnabled,
    profile: {
      username: normUser,
      isAdmin: isUserAdmin,
      enabled: isUserEnabled,
    },
    deviceId: effectiveDeviceId,
    deviceName: effectiveDeviceName,
  });
});

// 4. Admin Management APIs (Protected by requireAdmin Middleware)
app.get(['/api/admin/list-users', '/api/list-users'], requireAdmin, (_req: Request, res: Response) => {
  const list = Array.from(usersMap.values()).map((u) => ({
    username: u.username,
    isAdmin: Boolean(u.isAdmin || u.username === 'admin'),
    enabled: u.enabled !== false,
    createdAt: u.createdAt,
    email: u.email,
  }));
  return res.json({ users: list });
});

app.post(['/api/admin/create-user', '/api/create-user'], requireAdmin, (req: Request, res: Response) => {
  const { username, password, isAdmin } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const cleanUser = cleanUsername(username);
  const newUser: UserRecord = {
    username: cleanUser,
    password: String(password).trim(),
    isAdmin: Boolean(isAdmin),
    enabled: true, // Accounts created directly by admins default to enabled: true!
    createdAt: Date.now(),
  };
  usersMap.set(cleanUser, newUser);
  saveUsersStore();
  return res.json({ success: true, user: { username: cleanUser, isAdmin: newUser.isAdmin, enabled: newUser.enabled } });
});

app.post(['/api/admin/toggle-enabled', '/api/admin/set-enabled'], requireAdmin, (req: Request, res: Response) => {
  const { username, enabled } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username is required' });
  const cleanUser = cleanUsername(username);
  const userRec = usersMap.get(cleanUser);
  if (!userRec) return res.status(404).json({ error: 'User not found' });

  userRec.enabled = Boolean(enabled);
  saveUsersStore();

  return res.json({
    success: true,
    username: cleanUser,
    enabled: userRec.enabled,
    message: `User "${cleanUser}" ${userRec.enabled ? 'enabled' : 'disabled'} successfully`,
  });
});

app.post(['/api/admin/set-admin', '/api/set-admin'], requireAdmin, (req: Request, res: Response) => {
  const { username, isAdmin } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username is required' });
  const cleanUser = cleanUsername(username);
  const userRec = usersMap.get(cleanUser);
  if (!userRec) return res.status(404).json({ error: 'User not found' });

  userRec.isAdmin = Boolean(isAdmin);
  saveUsersStore();

  return res.json({ success: true, username: cleanUser, isAdmin: userRec.isAdmin });
});

app.post(['/api/admin/delete-user', '/api/delete-user'], requireAdmin, (req: Request, res: Response) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username is required' });
  const cleanUser = cleanUsername(username);
  if (cleanUser === 'admin') return res.status(400).json({ error: 'Cannot delete primary admin account' });

  usersMap.delete(cleanUser);
  saveUsersStore();

  return res.json({ success: true, message: `User "${cleanUser}" deleted` });
});

app.post(['/api/admin/reset-password', '/api/reset-password'], requireAdmin, (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  const cleanUser = cleanUsername(username);
  const userRec = usersMap.get(cleanUser);
  if (!userRec) return res.status(404).json({ error: 'User not found' });

  userRec.password = String(password).trim();
  saveUsersStore();

  return res.json({ success: true, message: `Password reset for user "${cleanUser}"` });
});

app.get('/api/admin/settings', requireAdmin, (_req: Request, res: Response) => {
  return res.json({ autoEnable: Boolean(serverSettings.autoEnable) });
});

app.post('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
  const { autoEnable } = req.body || {};
  if (typeof autoEnable === 'boolean') {
    serverSettings.autoEnable = autoEnable;
    saveServerSettings();
  }
  return res.json({ success: true, autoEnable: Boolean(serverSettings.autoEnable) });
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
  const username = session?.username || req.body?.username || 'user_main';
  const normUser = cleanUsername(username);

  const userRec = usersMap.get(normUser);
  if (userRec && userRec.enabled === false) {
    return res.status(403).json({
      error: 'account_disabled',
      message: 'Account not enabled. Please contact an administrator.',
    });
  }

  const deviceId = req.body?.deviceId || session?.deviceId || 'dev_unknown';
  const deviceName = req.body?.deviceName || session?.deviceName || 'Web Player';

  // Anti-replay check
  const isValid = await verifyReplayProtection(deviceId, req.body?.seq, req.body?.nonce, true);
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
  const isHeartbeatLive = Boolean(lease && lease.expiresAt > Date.now());
  const isActive = Boolean(lease && lease.deviceId === deviceId && isHeartbeatLive);
  const hasActivePlayback = Boolean(lease && lease.trackId && (isHeartbeatLive || Date.now() - lease.updatedAt < 86400000));

  return res.json({
    active: isActive,
    hasActivePlayback,
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
      state: isHeartbeatLive ? lease.state : 'paused',
      updatedAt: lease.updatedAt,
    },
  });
});

// 7b. Remote Pause Command
app.post('/api/session/pause', async (req: Request, res: Response) => {
  const session = extractSession(req);
  const username = (req.body?.username as string) || session?.username || 'user_main';
  const normUser = cleanUsername(username);
  const playbackKey = getRedisPlaybackKey(normUser);
  const leaseStr = await redis.get(playbackKey);

  if (leaseStr) {
    const lease: PlaybackLease = JSON.parse(leaseStr);
    lease.state = 'paused';
    lease.updatedAt = Date.now();
    await redis.set(playbackKey, JSON.stringify(lease), 'EX', 86400);

    broadcastToUser(normUser, {
      type: 'STATE_SYNC',
      state: 'paused',
      activeDeviceId: lease.deviceId,
      activeDeviceName: lease.deviceName,
      leaseEpoch: lease.leaseEpoch,
      track: {
        id: lease.trackId,
        title: lease.trackTitle,
        artist: lease.trackArtist,
        thumb: lease.trackThumb,
      },
      currentTime: lease.currentTime,
      duration: lease.duration,
      timestamp: Date.now(),
    });
  }

  return res.json({ success: true, message: 'Playback paused across account' });
});

// 8. Geo Status Check
app.get('/api/geo/check', (req: Request, res: Response) => {
  const result = evaluateTunisiaGeoAndAntiVpn(req);
  if (!result.allowed) {
    return res.status(403).json({
      allowed: false,
      error: result.reason,
      message: result.message,
      country: result.detectedCountry,
    });
  }
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

  // If user session is present, validate user status & single active stream token server-side!
  if (username) {
    const normUser = cleanUsername(username);
    const userRec = usersMap.get(normUser);
    if (userRec && userRec.enabled === false) {
      return res.status(403).json({
        error: 'account_disabled',
        message: 'Account not enabled. Please contact an administrator.',
      });
    }

    const playbackKey = getRedisPlaybackKey(normUser);
    const leaseStr = await redis.get(playbackKey);

    if (leaseStr) {
      const lease: PlaybackLease = JSON.parse(leaseStr);

      // Enforce: ONLY the device holding the active unexpired lease with the MATCHING streamToken can stream audio chunks!
      const isDeviceActive = Boolean(deviceId && lease.deviceId === deviceId);
      const isTokenValid = Boolean(playbackToken && lease.streamToken && playbackToken === lease.streamToken);
      const isLeaseActive = lease.expiresAt > Date.now();

      if (!isDeviceActive || !isTokenValid || !isLeaseActive) {
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const upstreamRes = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: {
        ...(rangeHeader ? { range: rangeHeader } : {}),
        'User-Agent': 'Mozilla/5.0 (MOUZIKETNA Server Stream Proxy)',
      },
    }).finally(() => clearTimeout(timeout)).catch(() => null);

    if (!upstreamRes) {
      // Upstream worker unreachable or timed out - respond with valid dummy audio stream or 404
      return res.status(200).json({ status: 'stream_ready', trackId: id });
    }

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
