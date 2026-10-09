// Automated Test Suite: Multi-Device Simultaneous Playback Verification
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
  console.log('🧪 Starting Multi-Device Simultaneous Playback Test Suite');
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

  // 2. Simultaneous Playback Claims on Both Devices (Multi-Device Allowed)
  const [claimA, claimB] = await Promise.all([
    request('/api/session/claim-playback', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { username, deviceId: deviceAId, deviceName: deviceAName, trackId: 'song_123' },
    }),
    request('/api/session/claim-playback', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { username, deviceId: deviceBId, deviceName: deviceBName, trackId: 'song_456' },
    }),
  ]);

  assert(claimA.status === 200 && claimA.data.active === true, 'Device A playback claim active');
  assert(claimB.status === 200 && claimB.data.active === true, 'Device B playback claim active simultaneously');

  // 3. Simultaneous Heartbeats on Both Devices
  const [hbA, hbB] = await Promise.all([
    request('/api/session/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { username, deviceId: deviceAId },
    }),
    request('/api/session/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { username, deviceId: deviceBId },
    }),
  ]);

  assert(hbA.status === 200 && hbA.data.active === true, 'Device A heartbeat confirmed active');
  assert(hbB.status === 200 && hbB.data.active === true, 'Device B heartbeat confirmed active simultaneously');

  console.log('\n======================================================');
  console.log('🎉 ALL MULTI-DEVICE SIMULTANEOUS PLAYBACK TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
