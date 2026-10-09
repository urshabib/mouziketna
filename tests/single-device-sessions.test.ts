// Automated Test Suite: Secure Single-Device Session & Playback Supersession Verification
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
  console.log('🧪 Starting Secure Single-Device Session Test Suite');
  console.log('======================================================\n');

  const username = `testuser_${Date.now()}`;
  const deviceAId = `dev_iphone_${Date.now()}`;
  const deviceAName = 'iPhone 15 Pro';
  const deviceBId = `dev_chrome_${Date.now()}`;
  const deviceBName = 'MacBook Pro (Chrome)';

  // 1. Login on Device A & B
  const loginA = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password: 'admin', deviceId: deviceAId, deviceName: deviceAName },
  });
  assert(loginA.status === 200, 'Device A login succeeded');
  const tokenA = loginA.data.sessionToken;

  const loginB = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password: 'admin', deviceId: deviceBId, deviceName: deviceBName },
  });
  assert(loginB.status === 200, 'Device B login succeeded');
  const tokenB = loginB.data.sessionToken;

  // 2. Device A claims playback
  const claimA = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { username, deviceId: deviceAId, deviceName: deviceAName, trackId: 'song_123' },
  });
  assert(claimA.status === 200 && claimA.data.active === true, 'Device A playback claim active');

  // 3. Device A heartbeat succeeds
  const hbA1 = await request('/api/session/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { username, deviceId: deviceAId },
  });
  assert(hbA1.status === 200 && hbA1.data.active === true, 'Device A initial heartbeat confirmed active');

  // 4. Device B claims playback (Takes over active lease from Device A)
  const claimB = await request('/api/session/claim-playback', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { username, deviceId: deviceBId, deviceName: deviceBName, trackId: 'song_456' },
  });
  assert(claimB.status === 200 && claimB.data.active === true, 'Device B playback claim superseded Device A');

  // 5. Device A heartbeat now receives 409 Conflict (Superseded)
  const hbA2 = await request('/api/session/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { username, deviceId: deviceAId },
  });
  assert(hbA2.status === 409 && hbA2.data.superseded === true, 'Device A heartbeat correctly received 409 Conflict supersession notice');

  console.log('\n======================================================');
  console.log('🎉 ALL SECURE SINGLE-DEVICE SESSION TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
