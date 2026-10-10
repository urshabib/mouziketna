// Test for bidirectional multi-session account sync (Installed App <-> Incognito)
import WebSocket from 'ws';

const BASE_URL = 'http://127.0.0.1:3000';
const WS_BASE_URL = 'ws://127.0.0.1:3000';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(msg);
  }
  console.log(`  ✓ ${msg}`);
}

async function run() {
  console.log('\n--- Testing Bidirectional Account Playback Sync (Installed App <-> Incognito) ---');

  const username = `habib_test_${Date.now()}`;
  const deviceAId = `dev_pwa_installed_${Date.now()}`;
  const deviceAName = 'Android Phone (Installed App)';
  const deviceBId = `dev_incognito_${Date.now()}`;
  const deviceBName = 'Chrome (Incognito Tab)';

  // 1. Log in Device A (Installed App)
  const loginARes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'admin', deviceId: deviceAId, deviceName: deviceAName }),
  });
  const loginA = await loginARes.json();
  assert(loginA.success === true, 'Device A logged into account');
  const tokenA = loginA.sessionToken;

  // Connect WebSocket A
  const wsA = new WebSocket(`${WS_BASE_URL}/ws/playback?token=${tokenA}&username=${username}&deviceId=${deviceAId}&deviceName=${encodeURIComponent(deviceAName)}`);
  const msgsA: any[] = [];
  wsA.on('message', (data) => msgsA.push(JSON.parse(data.toString())));
  await new Promise((resolve) => wsA.on('open', resolve));
  assert(wsA.readyState === WebSocket.OPEN, 'Device A WebSocket connected');

  // 2. Device A starts playing a track
  const claimARes = await fetch(`${BASE_URL}/api/session/claim-playback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      username,
      deviceId: deviceAId,
      deviceName: deviceAName,
      trackId: 'track_123',
      trackTitle: 'Nhebek Ya Oumi',
      trackArtist: 'Balti',
      currentTime: 15,
      seq: 1,
      nonce: `nonce_${Date.now()}`,
    }),
  });
  const claimA = await claimARes.json();
  assert(claimA.active === true, 'Device A claimed playback lease');

  // 3. User opens Incognito tab and logs in to the same account
  const loginBRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'admin', deviceId: deviceBId, deviceName: deviceBName }),
  });
  const loginB = await loginBRes.json();
  assert(loginB.success === true, 'Device B logged into the same account in incognito');
  const tokenB = loginB.sessionToken;

  // 4. Device B checks session status immediately upon login
  const statusBRes = await fetch(`${BASE_URL}/api/session/status?username=${username}&deviceId=${deviceBId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const statusB = await statusBRes.json();
  assert(statusB.hasActivePlayback === true, 'Device B immediately detects account has active playback');
  assert(statusB.isCurrentDeviceActive === false, 'Device B is NOT the active streamer (remote mirror)');
  assert(statusB.supersededBy === deviceAName, `Device B sees active device is "${deviceAName}"`);
  assert(statusB.lease?.track?.title === 'Nhebek Ya Oumi', 'Device B sees the exact song playing on Device A');
  assert(statusB.lease?.currentTime === 15, 'Device B sees the exact progress time of Device A');

  // Connect WebSocket B
  const msgsB: any[] = [];
  const wsB = new WebSocket(`${WS_BASE_URL}/ws/playback?token=${tokenB}&username=${username}&deviceId=${deviceBId}&deviceName=${encodeURIComponent(deviceBName)}`);
  wsB.on('message', (data) => msgsB.push(JSON.parse(data.toString())));
  await new Promise((resolve) => wsB.on('open', resolve));

  await new Promise((r) => setTimeout(r, 200));

  // Device B received INITIAL_SYNC with Device A's track
  const initSyncB = msgsB.find((m) => m.type === 'INITIAL_SYNC');
  assert(Boolean(initSyncB && initSyncB.track?.title === 'Nhebek Ya Oumi'), 'Device B WS received INITIAL_SYNC with Device A track');
  assert(initSyncB.activeDeviceId === deviceAId, 'INITIAL_SYNC identifies Device A as active streamer');

  // 5. Device B clicks Pause (remote pause)
  wsB.send(JSON.stringify({ type: 'REMOTE_PAUSE', deviceId: deviceBId }));
  await new Promise((r) => setTimeout(r, 300));

  // Device A must have received STATE_SYNC with paused state!
  const stateSyncA = msgsA.find((m) => m.type === 'STATE_SYNC' && m.state === 'paused');
  assert(Boolean(stateSyncA), 'Device A received STATE_SYNC with paused state (remote pause worked!)');

  // 6. Device B clicks Play / Play Here (claims playback)
  wsB.send(JSON.stringify({
    type: 'CLAIM_PLAYBACK',
    token: tokenB,
    deviceId: deviceBId,
    deviceName: deviceBName,
    trackId: 'track_456',
    trackTitle: 'Ya Lili',
    trackArtist: 'Balti ft. Hammouda',
    currentTime: 0,
  }));
  await new Promise((r) => setTimeout(r, 300));

  // Device A must have received SUPERSEDED notification!
  const supersededA = msgsA.find((m) => m.type === 'SUPERSEDED' || m.type === 'PLAYBACK_HANDOVER');
  assert(Boolean(supersededA), 'Device A received SUPERSEDED / PLAYBACK_HANDOVER notification (handover worked!)');

  // Device B must have received CLAIM_GRANTED
  const claimGrantedB = msgsB.find((m) => m.type === 'CLAIM_GRANTED');
  assert(Boolean(claimGrantedB && claimGrantedB.streamToken), 'Device B received CLAIM_GRANTED with unique streamToken');

  // 7. Verify status from Device A's perspective now
  const statusARes = await fetch(`${BASE_URL}/api/session/status?username=${username}&deviceId=${deviceAId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const statusA = await statusARes.json();
  assert(statusA.isCurrentDeviceActive === false, 'Device A is now in remote mirror mode');
  assert(statusA.supersededBy === deviceBName, `Device A reports music is now playing on "${deviceBName}"`);
  assert(statusA.lease?.track?.title === 'Ya Lili', 'Device A sees new track playing on Device B');

  wsA.close();
  wsB.close();
  console.log('\n🎉 ALL BIDIRECTIONAL SYNC TESTS PASSED!\n');
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
