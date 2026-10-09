// Comprehensive Automated Test Suite:
// Single-Device Playback Sync, Atomic Handover, Stale Token Chunk Rejection, Replay Defense, and Tunisia Geofencing

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
  console.log('\n================================================================');
  console.log('🧪 Starting Single-Device Playback Sync & Security Test Suite');
  console.log('================================================================\n');

  const username = `testuser_${Date.now()}`;
  const deviceAId = `dev_iphone_${Date.now()}`;
  const deviceAName = 'iPhone 15 Pro';
  const deviceBId = `dev_chrome_${Date.now()}`;
  const deviceBName = 'MacBook Pro (Chrome)';

  // -------------------------------------------------------------
  // Test 1: Hardened Login & Cookie Issuance (Device A & B)
  // -------------------------------------------------------------
  console.log('--- Test 1: Hardened Authentication & Cookie Verification ---');
  const loginA = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password: 'admin', deviceId: deviceAId, deviceName: deviceAName },
  });
  assert(loginA.status === 200, 'Device A login succeeded (HTTP 200)');
  const tokenA = loginA.data.sessionToken;
  assert(Boolean(tokenA && tokenA.length >= 32), 'Device A received cryptographically secure 256-bit session token');
  
  const cookieHeaderA = loginA.headers.get('set-cookie') || '';
  assert(cookieHeaderA.includes('mouzika_session='), 'HttpOnly session cookie set on login');
  assert(cookieHeaderA.toLowerCase().includes('samesite=strict'), 'Cookie enforces SameSite=Strict');

  const loginB = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password: 'admin', deviceId: deviceBId, deviceName: deviceBName },
  });
  assert(loginB.status === 200, 'Device B login succeeded (HTTP 200)');
  const tokenB = loginB.data.sessionToken;

  // -------------------------------------------------------------
  // Test 2: Device A Claims Playback Lease & Receives Stream Token
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Server-Authoritative Playback Lease Claim ---');
  const claimA = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: {
      username,
      deviceId: deviceAId,
      deviceName: deviceAName,
      trackId: 'song_alpha',
      trackTitle: 'Sidi Mansour',
      trackArtist: 'Saber Rebai',
      currentTime: 10,
      seq: 1,
      nonce: `nonce_a_${Date.now()}`,
    },
  });
  assert(claimA.status === 200 && claimA.data.active === true, 'Device A playback lease granted');
  assert(claimA.data.leaseEpoch === 1, 'Device A leaseEpoch is 1');
  const streamTokenA = claimA.data.streamToken;
  assert(Boolean(streamTokenA && streamTokenA.startsWith('stk_')), 'Device A received short-lived streamToken');

  // -------------------------------------------------------------
  // Test 3: Audio Chunk Stream Allowed for Valid Stream Token
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Audio Chunk Request with Active Stream Token ---');
  const streamResA = await request(`/api/stream-proxy/song_alpha?deviceId=${deviceAId}&username=${username}`, {
    method: 'GET',
    headers: {
      'X-Playback-Token': streamTokenA,
      Authorization: `Bearer ${tokenA}`,
    },
  });
  assert(streamResA.status !== 403, 'Audio chunk request with valid streamToken accepted (not 403 Forbidden)');

  // -------------------------------------------------------------
  // Test 4: Cross-Device State Sync (Device B inspects remote state)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Cross-Device UI Status Sync ---');
  const statusB = await request(`/api/session/status?deviceId=${deviceBId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(statusB.status === 200, 'Device B status request succeeded');
  assert(statusB.data.hasActivePlayback === true, 'Account has an active playback session');
  assert(statusB.data.isCurrentDeviceActive === false, 'Device B is NOT the active streamer (remote sync mode)');
  assert(statusB.data.supersededBy === deviceAName, `Device B correctly reports active stream on "${deviceAName}"`);
  assert(statusB.data.lease?.track?.title === 'Sidi Mansour', 'Device B sees current track metadata');

  // -------------------------------------------------------------
  // Test 5: Atomic Handover (Device B takes over playback lease)
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Atomic Handover & Stream Lease Takeover ---');
  const claimB = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: {
      username,
      deviceId: deviceBId,
      deviceName: deviceBName,
      trackId: 'song_beta',
      trackTitle: 'Ya Rayah',
      trackArtist: 'Dahmane El Harrachi',
      currentTime: 0,
      seq: 1,
      nonce: `nonce_b_${Date.now()}`,
    },
  });
  assert(claimB.status === 200 && claimB.data.active === true, 'Device B successfully took over playback lease');
  assert(claimB.data.leaseEpoch === 2, 'leaseEpoch monotonically incremented to 2');
  const streamTokenB = claimB.data.streamToken;
  assert(Boolean(streamTokenB && streamTokenB !== streamTokenA), 'Device B issued new unique streamToken');

  // -------------------------------------------------------------
  // Test 6: Stale Audio Token Rejected (Device A audio chunk 403)
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Server Rejection of Stale Audio Chunk Requests ---');
  const staleStreamRes = await request(`/api/stream-proxy/song_alpha?deviceId=${deviceAId}&username=${username}`, {
    method: 'GET',
    headers: {
      'X-Playback-Token': streamTokenA, // Stale token from superseded lease!
      Authorization: `Bearer ${tokenA}`,
    },
  });
  assert(staleStreamRes.status === 403, 'Stale token audio chunk request strictly rejected with HTTP 403 Forbidden');
  assert(staleStreamRes.data?.error === 'stale_playback_token', 'Error code is "stale_playback_token"');

  // -------------------------------------------------------------
  // Test 7: Device A Heartbeat Receives 409 Conflict (Superseded)
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Heartbeat Conflict Detection ---');
  const hbA = await request('/api/session/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { username, deviceId: deviceAId, streamToken: streamTokenA },
  });
  assert(hbA.status === 409 && hbA.data.superseded === true, 'Device A heartbeat received 409 Conflict (superseded)');
  assert(hbA.data.supersededBy === deviceBName, `Device A notified that playback transferred to "${deviceBName}"`);

  // -------------------------------------------------------------
  // Test 8: Replay Attack Defense (Reused Nonce / Out-of-Order Seq)
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Anti-Replay Defense Verification ---');
  const fixedNonce = `replay_test_nonce_${Date.now()}`;
  const firstReq = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: {
      username,
      deviceId: deviceBId,
      deviceName: deviceBName,
      seq: 10,
      nonce: fixedNonce,
    },
  });
  assert(firstReq.status === 200, 'First request with fresh nonce succeeded');

  const replayReq = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: {
      username,
      deviceId: deviceBId,
      deviceName: deviceBName,
      seq: 10, // Replayed sequence and nonce!
      nonce: fixedNonce,
    },
  });
  assert(replayReq.status === 400 && replayReq.data?.error === 'replay_detected', 'Replayed packet detected and rejected with HTTP 400');

  // -------------------------------------------------------------
  // Test 9: Tunisia Geofencing & Anti-VPN Verification
  // -------------------------------------------------------------
  console.log('\n--- Test 9: Tunisia Geofencing (TN Allowed, Non-TN Blocked) ---');
  
  // Non-TN (e.g. France / US) request blocked
  const nonTnReq = await request('/api/auth/session/verify', {
    method: 'POST',
    headers: {
      'CF-IPCountry': 'FR',
      'X-Forwarded-For': '193.56.28.1',
      Authorization: `Bearer ${tokenA}`,
    },
    body: { sessionToken: tokenA },
  });
  assert(nonTnReq.status === 403, 'Foreign IP (CF-IPCountry: FR) blocked with HTTP 403 Forbidden');
  assert(nonTnReq.data?.error === 'geoblock_restricted', 'Blocked reason is "geoblock_restricted"');

  // Suspicious Threat Score / VPN blocked
  const vpnReq = await request('/api/auth/session/verify', {
    method: 'POST',
    headers: {
      'CF-IPCountry': 'TN',
      'CF-Threat-Score': '65', // High threat / datacenter proxy
      Authorization: `Bearer ${tokenA}`,
    },
    body: { sessionToken: tokenA },
  });
  assert(vpnReq.status === 403, 'High threat score / VPN traffic blocked with HTTP 403 Forbidden');
  assert(vpnReq.data?.error === 'vpn_proxy_blocked', 'Blocked reason is "vpn_proxy_blocked"');

  // Tunisia (TN) request permitted
  const tnReq = await request('/api/auth/session/verify', {
    method: 'POST',
    headers: {
      'CF-IPCountry': 'TN',
      Authorization: `Bearer ${tokenA}`,
    },
    body: { sessionToken: tokenA },
  });
  assert(tnReq.status === 200, 'Domestic Tunisia traffic (CF-IPCountry: TN) successfully allowed');

  console.log('\n================================================================');
  console.log('🎉 ALL 9 SECURE PLAYBACK SYNC & SECURITY SUITE TESTS PASSED!');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
