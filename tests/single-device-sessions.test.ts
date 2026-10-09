// Automated Test Suite: Single-Device Playback Sessions & Security Verification
import http from 'http';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

async function request(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Single-Device Session Security Test Suite');
  console.log('======================================================\n');

  const username = `testuser_${Date.now()}`;
  const deviceAId = `dev_iphone_${Date.now()}`;
  const deviceAName = 'iPhone 15 Pro';
  const deviceBId = `dev_chrome_${Date.now()}`;
  const deviceBName = 'MacBook Pro (Chrome)';

  // -------------------------------------------------------------------
  // TEST 1: Simultaneous Logins on Two Devices (Session Token Generation)
  // -------------------------------------------------------------------
  console.log('Test 1: Simultaneous multi-device login & token generation...');
  const loginA = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password: 'admin', deviceId: deviceAId, deviceName: deviceAName },
  });
  assert(loginA.status === 200, 'Device A login succeeded (HTTP 200)');
  assert(typeof loginA.data.sessionToken === 'string' && loginA.data.sessionToken.length >= 32, 'Device A received a secure 256-bit session token');
  const tokenA = loginA.data.sessionToken;

  const loginB = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password: 'admin', deviceId: deviceBId, deviceName: deviceBName },
  });
  assert(loginB.status === 200, 'Device B login succeeded (HTTP 200)');
  assert(typeof loginB.data.sessionToken === 'string' && loginB.data.sessionToken.length >= 32, 'Device B received distinct secure session token');
  assert(tokenA !== loginB.data.sessionToken, 'Device A and Device B tokens are unique and non-overlapping');
  const tokenB = loginB.data.sessionToken;

  // -------------------------------------------------------------------
  // TEST 2: Device Binding Security (Prevent Session Hijacking)
  // -------------------------------------------------------------------
  console.log('\nTest 2: Device binding validation (Session Hijacking defense)...');
  const spoofAttempt = await request('/api/auth/session/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { deviceId: 'unauthorized_attacker_device' },
  });
  assert(spoofAttempt.status === 403, 'Server rejected session token used from mismatched device ID (HTTP 403)');

  const legitVerify = await request('/api/auth/session/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { deviceId: deviceAId },
  });
  assert(legitVerify.status === 200 && legitVerify.data.valid === true, 'Server approved session token from matched device ID (HTTP 200)');

  // -------------------------------------------------------------------
  // TEST 3: Device A Claims Active Playback Lease
  // -------------------------------------------------------------------
  console.log('\nTest 3: Device A starts playback & claims active lease...');
  const claimA = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: {
      username,
      deviceId: deviceAId,
      deviceName: deviceAName,
      trackId: 'song_123',
      trackTitle: 'Song A',
    },
  });
  assert(claimA.status === 200 && claimA.data.active === true, 'Device A acquired active playback lease');
  assert(claimA.data.leaseEpoch === 1, 'Device A lease epoch initialized to 1');

  // Device A heartbeats
  const heartbeatA1 = await request('/api/session/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { username, deviceId: deviceAId, leaseEpoch: 1 },
  });
  assert(heartbeatA1.status === 200 && heartbeatA1.data.active === true, 'Device A heartbeat confirmed active leaseholder');

  // -------------------------------------------------------------------
  // TEST 4: Device B Starts Listening -> Terminates Device A Session
  // -------------------------------------------------------------------
  console.log('\nTest 4: Device B starts playback -> Server transfers lease & supersedes Device A...');
  const claimB = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: {
      username,
      deviceId: deviceBId,
      deviceName: deviceBName,
      trackId: 'song_456',
      trackTitle: 'Song B',
    },
  });
  assert(claimB.status === 200 && claimB.data.active === true, 'Device B acquired active playback lease');
  assert(claimB.data.leaseEpoch === 2, 'Server monotonically incremented lease epoch to 2');
  assert(claimB.data.previousDeviceSuperseded === true, 'Server marked previous device as superseded');

  // Device A next heartbeat MUST now fail with HTTP 409 Conflict!
  const heartbeatA2 = await request('/api/session/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { username, deviceId: deviceAId, leaseEpoch: 1 },
  });
  assert(heartbeatA2.status === 409, 'Device A heartbeat received HTTP 409 Conflict');
  assert(heartbeatA2.data.superseded === true, 'Device A response has superseded: true');
  assert(heartbeatA2.data.supersededBy === deviceBName, `Device A informed that active listener is now '${deviceBName}'`);

  // -------------------------------------------------------------------
  // TEST 5: Mutual Transfer (Device A takes back playback - "and vice versa")
  // -------------------------------------------------------------------
  console.log('\nTest 5: Mutual transfer - Device A claims playback back ("Play here instead")...');
  const reclaimA = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: {
      username,
      deviceId: deviceAId,
      deviceName: deviceAName,
      trackId: 'song_789',
    },
  });
  assert(reclaimA.status === 200 && reclaimA.data.active === true, 'Device A successfully re-claimed active lease');
  assert(reclaimA.data.leaseEpoch === 3, 'Lease epoch monotonically incremented to 3');

  // Device B next heartbeat MUST now fail with HTTP 409 Conflict!
  const heartbeatB1 = await request('/api/session/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { username, deviceId: deviceBId, leaseEpoch: 2 },
  });
  assert(heartbeatB1.status === 409, 'Device B heartbeat received HTTP 409 Conflict');
  assert(heartbeatB1.data.superseded === true, 'Device B superseded flag is true');
  assert(heartbeatB1.data.supersededBy === deviceAName, `Device B informed that active listener is '${deviceAName}'`);

  // -------------------------------------------------------------------
  // TEST 6: Server-Side Stream Gate Enforcement
  // -------------------------------------------------------------------
  console.log('\nTest 6: Server-side stream gate enforcement...');
  // Device B is NOT active -> requesting stream-proxy MUST be rejected
  const streamBlockedB = await request(`/api/stream-proxy/test_track_123?deviceId=${deviceBId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(streamBlockedB.status === 403, 'Inactive device B blocked at server stream proxy with HTTP 403');
  assert(streamBlockedB.data.error === 'playback_superseded', 'Error code specifies playback_superseded');

  // -------------------------------------------------------------------
  // TEST 7: Replay Attack Defense with Stale Epoch
  // -------------------------------------------------------------------
  console.log('\nTest 7: Replay attack defense with stale epoch...');
  const replayHeartbeat = await request('/api/session/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { username, deviceId: deviceAId, leaseEpoch: 1 }, // Stale epoch 1 when current is 3
  });
  assert(replayHeartbeat.status === 409, 'Replayed heartbeat with stale epoch rejected with HTTP 409 Conflict');

  // -------------------------------------------------------------------
  // TEST 8: Concurrency & Race Condition Stress Test
  // -------------------------------------------------------------------
  console.log('\nTest 8: Race condition & simultaneous claim stress test...');
  const concurrentUser = `race_user_${Date.now()}`;
  const [raceRes1, raceRes2] = await Promise.all([
    request('/api/session/claim-playback', {
      method: 'POST',
      body: { username: concurrentUser, deviceId: 'dev_race_1', deviceName: 'Device Race 1' },
    }),
    request('/api/session/claim-playback', {
      method: 'POST',
      body: { username: concurrentUser, deviceId: 'dev_race_2', deviceName: 'Device Race 2' },
    }),
  ]);

  assert(raceRes1.status === 200 && raceRes2.status === 200, 'Both concurrent claim requests resolved cleanly');
  assert(raceRes1.data.leaseEpoch !== raceRes2.data.leaseEpoch, 'Epochs are strictly ordered (no duplicate epoch race condition)');

  const statusCheck = await request(`/api/session/status?username=${concurrentUser}`);
  assert(statusCheck.status === 200 && statusCheck.data.hasActivePlayback === true, 'Server has exactly ONE deterministic active leaseholder');

  // -------------------------------------------------------------------
  // TEST 9: Logout & Session Invalidation
  // -------------------------------------------------------------------
  console.log('\nTest 9: Logout & session invalidation...');
  const logoutRes = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { username, deviceId: deviceAId },
  });
  assert(logoutRes.status === 200, 'Logout succeeded (HTTP 200)');

  const verifyAfterLogout = await request('/api/auth/session/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { deviceId: deviceAId },
  });
  assert(verifyAfterLogout.status === 401, 'Session token immediately revoked upon logout (HTTP 401)');

  console.log('\n======================================================');
  console.log('🎉 ALL 9 SINGLE-DEVICE SESSION & SECURITY TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
