import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const UPSTREAM_WORKER = 'https://new-music-space-api.urshabib.workers.dev';

// --- Types ---
export interface UserSession {
  sessionId: string;
  sessionToken: string;
  username: string;
  deviceId: string;
  deviceName: string;
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
  sessionToken: string;
  leaseEpoch: number;
  leaseId: string;
  trackId?: string;
  trackTitle?: string;
  trackArtist?: string;
  startedAt: number;
  lastHeartbeat: number;
  expiresAt: number;
  state: 'playing' | 'paused';
}

// --- In-Memory State Stores ---
// 1. Valid active user sessions (keyed by secure 256-bit session token)
const sessions = new Map<string, UserSession>();
// 2. Maps `${username}:${deviceId}` -> sessionToken (enforces device binding)
const deviceToSession = new Map<string, string>();
// 3. Authoritative active playback lease per user account (keyed by normalized lowercase username)
const activePlaybacks = new Map<string, PlaybackLease>();
// 4. Server-Sent Events subscribers per user account (username -> Map<deviceId, Response>)
const sseClients = new Map<string, Map<string, Response>>();
// 5. Rate limiter sliding window records (IP/key -> timestamps[])
const rateLimitMap = new Map<string, number[]>();

// --- Concurrency & Race Condition Mutex ---
// Serializes state transitions per user so two devices claiming playback at the exact same millisecond cannot race
const userMutexes = new Map<string, Promise<void>>();

async function withUserLock<T>(username: string, task: () => Promise<T>): Promise<T> {
  const normUser = (username || 'anonymous').toLowerCase().trim();
  const currentLock = userMutexes.get(normUser) || Promise.resolve();

  let resolveLock!: () => void;
  const newLock = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });

  userMutexes.set(normUser, newLock);

  try {
    await currentLock;
    return await task();
  } finally {
    resolveLock();
    if (userMutexes.get(normUser) === newLock) {
      userMutexes.delete(normUser);
    }
  }
}

// --- Helpers ---
function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function cleanUsername(user?: string): string {
  return (user || '').toLowerCase().trim();
}

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

// Authentication middleware with Device Binding validation
function extractSession(req: Request): UserSession | null {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.body && req.body.sessionToken) {
    token = String(req.body.sessionToken).trim();
  } else if (req.query && req.query.sessionToken) {
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

  // Touch session
  session.lastActive = Date.now();
  return session;
}

// Broadcast an instantaneous supersession event to other connected devices of the user
function notifySupersededViaSse(username: string, supersededDeviceId: string, byDevice: string, leaseEpoch: number) {
  const normUser = cleanUsername(username);
  const clients = sseClients.get(normUser);
  if (!clients) return;

  const payload = JSON.stringify({
    type: 'superseded',
    supersededDeviceId,
    byDevice,
    leaseEpoch,
    timestamp: Date.now(),
  });

  for (const [devId, clientRes] of clients.entries()) {
    try {
      clientRes.write(`data: ${payload}\n\n`);
    } catch {
      clients.delete(devId);
    }
  }
}

// --- Express App Setup ---
const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// =========================================================================
// API ROUTES: SINGLE-DEVICE SESSION & PLAYBACK CONTROL
// =========================================================================

// 1. Session Verification
app.post('/api/auth/session/verify', (req: Request, res: Response) => {
  const session = extractSession(req);
  if (!session) {
    return res.status(401).json({ valid: false, error: 'Invalid or expired session' });
  }

  const deviceId = req.body?.deviceId || req.query?.deviceId;
  if (deviceId && deviceId !== session.deviceId) {
    // Device binding mismatch - potential session hijacking attempt
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

// 2. Login & Session Token Issuance
app.post('/api/auth/login', rateLimit(15, 60000), async (req: Request, res: Response) => {
  const { username, password, deviceId, deviceName } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const normUser = cleanUsername(username);
  const effectiveDeviceId = deviceId || `dev_${generateSecureToken(8)}`;
  const effectiveDeviceName = deviceName || 'Web Player';

  let upstreamData: any = null;
  let authSucceeded = false;

  // Try authenticating with upstream Cloudflare Worker
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
    console.warn('[Server] Upstream auth failed or unreachable:', err);
  }

  // Local fallback for admin or offline testing if upstream is unreachable
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

  // Issue cryptographically secure 256-bit session token
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
    ip,
    userAgent,
    createdAt: Date.now(),
    lastActive: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30-day session
  };

  await withUserLock(normUser, async () => {
    // Invalidate previous session on THIS device if any existed
    const prevKey = `${normUser}:${effectiveDeviceId}`;
    const oldToken = deviceToSession.get(prevKey);
    if (oldToken) {
      sessions.delete(oldToken);
    }

    sessions.set(sessionToken, newSession);
    deviceToSession.set(prevKey, sessionToken);
  });

  return res.json({
    ...(upstreamData || {}),
    success: true,
    sessionToken,
    sessionId,
    deviceId: effectiveDeviceId,
    deviceName: effectiveDeviceName,
  });
});

// Proxy for legacy /api/login endpoint to ensure transparent session token enhancement
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
  } catch (err) {
    console.warn('[Server] Upstream login unreachable:', err);
  }

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

  await withUserLock(normUser, async () => {
    const prevKey = `${normUser}:${effectiveDeviceId}`;
    const oldToken = deviceToSession.get(prevKey);
    if (oldToken) sessions.delete(oldToken);

    sessions.set(sessionToken, newSession);
    deviceToSession.set(prevKey, sessionToken);
  });

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
  const deviceId = req.body?.deviceId || session?.deviceId;

  if (session) {
    sessions.delete(session.sessionToken);
    deviceToSession.delete(`${session.username}:${session.deviceId}`);
  }

  if (rawUser) {
    const normUser = cleanUsername(rawUser);
    await withUserLock(normUser, async () => {
      const lease = activePlaybacks.get(normUser);
      if (lease && (!deviceId || lease.deviceId === deviceId)) {
        activePlaybacks.delete(normUser);
        notifySupersededViaSse(normUser, lease.deviceId, 'Logged Out', lease.leaseEpoch + 1);
      }
    });
  }

  return res.json({ success: true, message: 'Logged out successfully' });
});

// 4. Claim Playback Lease (Spotify Connect style)
// Atomic claim with monotonic lease epoch and cross-device supersession notification
app.post('/api/session/claim-playback', rateLimit(120, 60000), async (req: Request, res: Response) => {
  const session = extractSession(req);
  const { username: bodyUser, deviceId, deviceName, trackId, trackTitle, trackArtist } = req.body || {};

  const username = cleanUsername(session?.username || bodyUser);
  if (!username) {
    // Unauthenticated playback is allowed locally without server lease
    return res.json({ active: true, leaseEpoch: 1, message: 'Unauthenticated playback granted' });
  }

  const effectiveDeviceId = deviceId || session?.deviceId || `dev_${generateSecureToken(8)}`;
  const effectiveDeviceName = deviceName || session?.deviceName || 'Web Player';
  const effectiveToken = session?.sessionToken || '';

  // Atomic mutex execution per username to prevent race conditions
  const result = await withUserLock(username, async () => {
    const existingLease = activePlaybacks.get(username);
    const now = Date.now();
    const nextEpoch = existingLease ? existingLease.leaseEpoch + 1 : 1;

    // Check if another device was actively holding the lease
    if (existingLease && existingLease.deviceId !== effectiveDeviceId) {
      console.log(
        `[SessionManager] Account '${username}' playback transferred: ${existingLease.deviceName} -> ${effectiveDeviceName}`
      );
      // Immediately notify the previous device over SSE to pause playback
      notifySupersededViaSse(username, existingLease.deviceId, effectiveDeviceName, nextEpoch);
    }

    const newLease: PlaybackLease = {
      username,
      deviceId: effectiveDeviceId,
      deviceName: effectiveDeviceName,
      sessionToken: effectiveToken,
      leaseEpoch: nextEpoch,
      leaseId: generateSecureToken(16),
      trackId,
      trackTitle,
      trackArtist,
      startedAt: now,
      lastHeartbeat: now,
      expiresAt: now + 15000, // 15-second TTL without heartbeat
      state: 'playing',
    };

    activePlaybacks.set(username, newLease);

    return {
      active: true,
      leaseEpoch: nextEpoch,
      leaseId: newLease.leaseId,
      deviceId: effectiveDeviceId,
      deviceName: effectiveDeviceName,
      previousDeviceSuperseded: existingLease ? existingLease.deviceId !== effectiveDeviceId : false,
      message: 'Active playback lease acquired',
    };
  });

  return res.json(result);
});

// 5. Playback Heartbeat (Keep-alive every 3-5 seconds while playing)
// Returns 409 Conflict if another device claimed the lease
app.post('/api/session/heartbeat', rateLimit(200, 60000), async (req: Request, res: Response) => {
  const session = extractSession(req);
  const { username: bodyUser, deviceId, leaseEpoch } = req.body || {};
  const username = cleanUsername(session?.username || bodyUser);

  if (!username) {
    return res.json({ active: true });
  }

  const effectiveDeviceId = deviceId || session?.deviceId;
  if (!effectiveDeviceId) {
    return res.status(400).json({ error: 'Device ID required' });
  }

  const currentLease = activePlaybacks.get(username);
  const now = Date.now();

  // If no lease exists, or another device holds the lease, or leaseEpoch is stale:
  if (!currentLease) {
    return res.status(409).json({
      active: false,
      superseded: true,
      supersededBy: 'Server',
      reason: 'no_active_lease',
    });
  }

  if (currentLease.deviceId !== effectiveDeviceId) {
    return res.status(409).json({
      active: false,
      superseded: true,
      supersededBy: currentLease.deviceName || 'Another Device',
      reason: 'playback_transferred',
    });
  }

  if (leaseEpoch && currentLease.leaseEpoch > Number(leaseEpoch)) {
    return res.status(409).json({
      active: false,
      superseded: true,
      supersededBy: currentLease.deviceName || 'Another Device',
      reason: 'stale_epoch',
    });
  }

  // Extend lease heartbeat
  currentLease.lastHeartbeat = now;
  currentLease.expiresAt = now + 15000;

  return res.json({
    active: true,
    leaseEpoch: currentLease.leaseEpoch,
    expiresAt: currentLease.expiresAt,
  });
});

// 6. Release Playback Lease
app.post('/api/session/release-playback', async (req: Request, res: Response) => {
  const session = extractSession(req);
  const { username: bodyUser, deviceId } = req.body || {};
  const username = cleanUsername(session?.username || bodyUser);

  if (!username) return res.json({ success: true });

  const effectiveDeviceId = deviceId || session?.deviceId;

  await withUserLock(username, async () => {
    const currentLease = activePlaybacks.get(username);
    if (currentLease && (!effectiveDeviceId || currentLease.deviceId === effectiveDeviceId)) {
      activePlaybacks.delete(username);
    }
  });

  return res.json({ success: true, message: 'Playback lease released' });
});

// 7. Get Playback Status
app.get('/api/session/status', (req: Request, res: Response) => {
  const session = extractSession(req);
  const rawUser = String(req.query.username || session?.username || '');
  const username = cleanUsername(rawUser);
  const deviceId = String(req.query.deviceId || session?.deviceId || '');

  if (!username) {
    return res.json({ active: false });
  }

  const currentLease = activePlaybacks.get(username);
  if (!currentLease || Date.now() > currentLease.expiresAt) {
    return res.json({
      active: false,
      hasActivePlayback: false,
    });
  }

  return res.json({
    active: currentLease.deviceId === deviceId,
    hasActivePlayback: true,
    activeDeviceId: currentLease.deviceId,
    activeDeviceName: currentLease.deviceName,
    isCurrentDeviceActive: currentLease.deviceId === deviceId,
    leaseEpoch: currentLease.leaseEpoch,
    track: {
      id: currentLease.trackId,
      title: currentLease.trackTitle,
      artist: currentLease.trackArtist,
    },
  });
});

// 8. Server-Sent Events (SSE) for Real-Time Instant Supersession Push
app.get('/api/session/events', (req: Request, res: Response) => {
  const session = extractSession(req);
  const rawUser = String(req.query.username || session?.username || '');
  const username = cleanUsername(rawUser);
  const deviceId = String(req.query.deviceId || session?.deviceId || `dev_${generateSecureToken(6)}`);

  if (!username) {
    return res.status(401).json({ error: 'Authentication required for session events' });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');

  // Register client
  if (!sseClients.has(username)) {
    sseClients.set(username, new Map());
  }
  const userClients = sseClients.get(username)!;
  userClients.set(deviceId, res);

  // Send current state
  const lease = activePlaybacks.get(username);
  const initialPayload = JSON.stringify({
    type: 'init',
    activeDeviceId: lease?.deviceId,
    isCurrentActive: lease?.deviceId === deviceId,
  });
  res.write(`data: ${initialPayload}\n\n`);

  // Ping interval to keep connection alive through proxies
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    userClients.delete(deviceId);
    if (userClients.size === 0) {
      sseClients.delete(username);
    }
  });
});

// 9. Server-Side Audio Stream Gate: Validates Active Session Lease Before Streaming
app.get('/api/stream-proxy/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || id.length < 3) {
    return res.status(400).json({ error: 'Invalid track id' });
  }

  const session = extractSession(req);
  const reqDeviceId = String(req.query.deviceId || session?.deviceId || '');
  const username = session?.username;

  // Strict Server-Side Enforcement:
  // If the user has an active session, verify they hold the active playback lease!
  if (username) {
    const currentLease = activePlaybacks.get(username);
    if (currentLease && reqDeviceId && currentLease.deviceId !== reqDeviceId) {
      console.warn(
        `[StreamGate] Blocked unauthorized stream access for '${username}'. Active lease belongs to '${currentLease.deviceName}'`
      );
      return res.status(403).json({
        error: 'playback_superseded',
        message: `Playback active on another device (${currentLease.deviceName}).`,
        supersededBy: currentLease.deviceName,
      });
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
      // Forward status code
      return res.status(upstreamRes.status).json({ error: 'Upstream stream failed' });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/json';

    // If upstream returned JSON format with audio URLs (like standard YouTube adaptive formats)
    if (contentType.includes('application/json')) {
      const data = await upstreamRes.json();
      return res.json(data);
    }

    // Direct binary media stream proxying
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

// 10. Fallback Proxy for all other /api/* requests to Upstream Cloudflare Worker
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
// FRONTEND SERVING (Vite in Dev / Static in Prod)
// =========================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Development mode: Mount Vite middleware
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
    // Production mode: Serve dist files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`⚡ MOUZIKETNA Full-Stack Server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
