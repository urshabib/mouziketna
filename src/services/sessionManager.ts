// Secure Server-Authoritative Playback & Session Manager
// Coordinates WebSocket real-time synchronization, Redis Pub/Sub backed handover,
// short-lived stream tokens, atomic takeover, device fingerprinting, and replay prevention.

import { Track } from '../types';

export interface PlaybackSessionInfo {
  sessionToken: string;
  streamToken?: string;
  deviceId: string;
  deviceName: string;
  username: string;
  leaseEpoch: number;
}

export interface SupersededEvent {
  byDevice: string;
  at: number;
  reason?: string;
  leaseEpoch?: number;
}

export interface RemoteSyncState {
  activeDeviceId: string;
  activeDeviceName: string;
  leaseEpoch: number;
  track: Track | null;
  currentTime: number;
  duration: number;
  state: 'playing' | 'paused';
  streamToken?: string | null;
  updatedAt: number;
}

class SessionManager {
  private deviceId: string;
  private deviceName: string;
  private sessionToken: string | null = null;
  private streamToken: string | null = null;
  private username: string | null = null;
  private currentLeaseEpoch: number = 0;
  private isHoldingLease: boolean = false;
  private heartbeatTimer: any = null;
  private syncThrottlerTimer: any = null;
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private supersededCallbacks: Set<(event: SupersededEvent) => void> = new Set();
  private syncCallbacks: Set<(state: RemoteSyncState) => void> = new Set();
  private connectionStatusCallbacks: Set<(status: 'connected' | 'connecting' | 'disconnected') => void> = new Set();
  
  // Security & Replay Prevention
  private sequenceCounter: number = 0;
  private deviceFingerprint: string = '';
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: any = null;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceName = this.detectDeviceName();
    this.deviceFingerprint = this.generateDeviceFingerprint();
    this.initBroadcastChannel();
    this.restoreStoredSession();
  }

  // Generate or retrieve persistent cryptographic device identifier
  private getOrCreateDeviceId(): string {
    const KEY = 'mouzika_device_id_v2';
    try {
      let id = localStorage.getItem(KEY);
      if (!id || id.length < 16) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          id = `dev_${crypto.randomUUID()}`;
        } else {
          id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        }
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch {
      return `dev_fallback_${Date.now()}`;
    }
  }

  // Detect human-friendly device name for UI display
  private detectDeviceName(): string {
    try {
      const storedCustom = localStorage.getItem('mouzika_custom_device_name');
      if (storedCustom && storedCustom.trim()) return storedCustom.trim();

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      let os = 'Unknown OS';
      if (/iPhone/.test(ua)) os = 'iPhone';
      else if (/iPad/.test(ua)) os = 'iPad';
      else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
      else if (/Windows/.test(ua)) os = 'Windows';
      else if (/Android/.test(ua)) os = 'Android';
      else if (/Linux/.test(ua)) os = 'Linux';

      let browser = 'Browser';
      if (/Edg\//.test(ua)) browser = 'Edge';
      else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
      else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
      else if (/Firefox\//.test(ua)) browser = 'Firefox';

      return `${browser} (${os})`;
    } catch {
      return 'Web Player';
    }
  }

  // Device fingerprint generation to bind playback requests to physical client environment
  private generateDeviceFingerprint(): string {
    try {
      const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
      const scr = typeof window !== 'undefined' && window.screen ? window.screen : ({} as any);
      const raw = [
        this.deviceId,
        nav.userAgent || '',
        nav.language || '',
        nav.hardwareConcurrency || 4,
        `${scr.width || 0}x${scr.height || 0}x${scr.colorDepth || 24}`,
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      ].join('###');

      // Simple deterministic hash
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return `fp_${Math.abs(hash).toString(16)}`;
    } catch {
      return `fp_${Date.now()}`;
    }
  }

  // Cryptographic single-use nonce for replay defense
  private generateNonce(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private nextSequence(): number {
    this.sequenceCounter += 1;
    return this.sequenceCounter;
  }

  // Restore stored session and initialize real-time transport
  private restoreStoredSession() {
    try {
      this.sessionToken = localStorage.getItem('mouzika_session_token');
      this.username = localStorage.getItem('mouzika_session_user');
      if (this.sessionToken) {
        this.connectWebSocket();
      }
    } catch {}
  }

  // Multi-tab coordination in the same browser
  private initBroadcastChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('mouzika_playback_channel');
        this.broadcastChannel.onmessage = (event) => {
          const data = event.data;
          if (!data) return;

          if (data.type === 'PLAYBACK_CLAIMED' && data.tabId !== this.tabId) {
            if (this.isHoldingLease) {
              this.handleSuperseded({
                byDevice: `${this.deviceName} (Another Tab)`,
                at: Date.now(),
                reason: 'another_tab_started',
              });
            }
          }
        };
      }
    } catch (e) {
      console.warn('[SessionManager] BroadcastChannel unavailable:', e);
    }
  }

  private tabId = Math.random().toString(36).substring(2, 10);

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }

  public getStreamToken(): string | null {
    return this.streamToken;
  }

  public getLeaseEpoch(): number {
    return this.currentLeaseEpoch;
  }

  public isCurrentDeviceHoldingLease(): boolean {
    return this.isHoldingLease;
  }

  public setCustomDeviceName(name: string) {
    if (!name || !name.trim()) return;
    this.deviceName = name.trim();
    try {
      localStorage.setItem('mouzika_custom_device_name', this.deviceName);
    } catch {}
  }

  public getSessionToken(): string | null {
    if (this.sessionToken) return this.sessionToken;
    try {
      this.sessionToken = localStorage.getItem('mouzika_session_token');
    } catch {}
    return this.sessionToken;
  }

  public setSession(token: string, username: string) {
    this.sessionToken = token;
    this.username = username;
    try {
      localStorage.setItem('mouzika_session_token', token);
      localStorage.setItem('mouzika_session_user', username);
    } catch {}
    this.connectWebSocket();
  }

  public clearSession() {
    this.releasePlaybackLease();
    this.sessionToken = null;
    this.streamToken = null;
    this.username = null;
    this.isHoldingLease = false;
    try {
      localStorage.removeItem('mouzika_session_token');
      localStorage.removeItem('mouzika_session_user');
      localStorage.removeItem('mouzika_stream_token');
    } catch {}
    this.disconnectWebSocket();
  }

  // --- Real-Time WebSocket Architecture (with Redis Pub/Sub backend) ---
  public connectWebSocket() {
    const token = this.getSessionToken();
    if (!token || typeof window === 'undefined') return;

    this.disconnectWebSocket();
    this.setConnectionStatus('connecting');

    try {
      const isSecure = window.location.protocol === 'https:';
      const wsProtocol = isSecure ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${wsProtocol}//${host}/ws/playback?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(this.deviceId)}&deviceName=${encodeURIComponent(this.deviceName)}&fp=${encodeURIComponent(this.deviceFingerprint)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setConnectionStatus('connected');
        this.reconnectAttempts = 0;
        // Request initial authoritative sync
        this.sendWsMessage({
          type: 'REQUEST_INITIAL_SYNC',
          deviceId: this.deviceId,
          seq: this.nextSequence(),
          nonce: this.generateNonce(),
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingWsMessage(msg);
        } catch (e) {
          console.warn('[SessionManager] WS parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.setConnectionStatus('disconnected');
        this.scheduleWsReconnect();
      };

      this.ws.onerror = () => {
        this.setConnectionStatus('disconnected');
      };
    } catch (err) {
      console.warn('[SessionManager] WebSocket connection failed:', err);
      this.setConnectionStatus('disconnected');
      this.scheduleWsReconnect();
    }
  }

  private handleIncomingWsMessage(msg: any) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'INITIAL_SYNC':
      case 'STATE_SYNC':
      case 'SYNC_UPDATE': {
        const lease = msg.lease || msg;
        const activeDeviceId = lease.activeDeviceId || lease.deviceId;
        const isCurrent = activeDeviceId === this.deviceId;
        
        this.currentLeaseEpoch = lease.leaseEpoch || this.currentLeaseEpoch;

        if (isCurrent) {
          this.isHoldingLease = true;
          if (lease.streamToken) {
            this.streamToken = lease.streamToken;
            try {
              localStorage.setItem('mouzika_stream_token', lease.streamToken);
            } catch {}
          }
        } else {
          // Playback is active on another device!
          if (this.isHoldingLease) {
            // We were superseded!
            this.handleSuperseded({
              byDevice: lease.activeDeviceName || lease.deviceName || 'Another Device',
              at: msg.timestamp || Date.now(),
              reason: 'remote_takeover',
              leaseEpoch: this.currentLeaseEpoch,
            });
          }
        }

        const syncState: RemoteSyncState = {
          activeDeviceId: activeDeviceId || '',
          activeDeviceName: lease.activeDeviceName || lease.deviceName || 'Web Player',
          leaseEpoch: lease.leaseEpoch || 1,
          track: lease.track || (lease.trackId ? {
            id: lease.trackId,
            title: lease.trackTitle || 'Track',
            artist: lease.trackArtist || 'Artist',
            thumb: lease.trackThumb || null,
          } : null),
          currentTime: Number(lease.currentTime) || 0,
          duration: Number(lease.duration) || 0,
          state: lease.state || (lease.isPlaying ? 'playing' : 'paused'),
          streamToken: isCurrent ? this.streamToken : null,
          updatedAt: lease.updatedAt || Date.now(),
        };

        this.notifySyncUpdate(syncState);
        break;
      }

      case 'SUPERSEDED':
      case 'PLAYBACK_PAUSED_BY_HANDOVER': {
        this.handleSuperseded({
          byDevice: msg.byDevice || msg.newDeviceName || 'Another device',
          at: msg.timestamp || Date.now(),
          reason: 'superseded_by_handover',
          leaseEpoch: msg.leaseEpoch,
        });
        break;
      }

      case 'CLAIM_GRANTED': {
        this.isHoldingLease = true;
        this.currentLeaseEpoch = msg.leaseEpoch || this.currentLeaseEpoch + 1;
        this.streamToken = msg.streamToken || null;
        if (this.streamToken) {
          try {
            localStorage.setItem('mouzika_stream_token', this.streamToken);
          } catch {}
        }
        this.startHeartbeat();
        break;
      }

      case 'PONG': {
        // Keep-alive received
        break;
      }
    }
  }

  private sendWsMessage(payload: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private scheduleWsReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.sessionToken) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts += 1;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
      this.reconnectTimer = setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    }
  }

  public disconnectWebSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionStatus('disconnected');
  }

  private setConnectionStatus(status: 'connected' | 'connecting' | 'disconnected') {
    this.connectionStatus = status;
    for (const cb of this.connectionStatusCallbacks) {
      try {
        cb(status);
      } catch {}
    }
  }

  public onConnectionStatusChange(cb: (status: 'connected' | 'connecting' | 'disconnected') => void): () => void {
    this.connectionStatusCallbacks.add(cb);
    cb(this.connectionStatus);
    return () => this.connectionStatusCallbacks.delete(cb);
  }

  public onSyncUpdate(cb: (state: RemoteSyncState) => void): () => void {
    this.syncCallbacks.add(cb);
    return () => this.syncCallbacks.delete(cb);
  }

  private notifySyncUpdate(state: RemoteSyncState) {
    for (const cb of this.syncCallbacks) {
      try {
        cb(state);
      } catch (err) {
        console.error('[SessionManager] Error in sync update callback:', err);
      }
    }
  }

  public onSuperseded(callback: (event: SupersededEvent) => void): () => void {
    this.supersededCallbacks.add(callback);
    return () => this.supersededCallbacks.delete(callback);
  }

  private handleSuperseded(event: SupersededEvent) {
    this.isHoldingLease = false;
    this.streamToken = null;
    try {
      localStorage.removeItem('mouzika_stream_token');
    } catch {}
    this.stopHeartbeat();

    for (const cb of this.supersededCallbacks) {
      try {
        cb(event);
      } catch (e) {
        console.error('[SessionManager] Error in superseded callback:', e);
      }
    }
  }

  // --- Playback Handover & Claims (Redis Lua Script / Server-Authoritative) ---
  public async claimPlaybackLease(
    track?: { id?: string; title?: string; artist?: string; thumb?: string | null },
    startPosition = 0
  ): Promise<{
    success: boolean;
    active: boolean;
    leaseEpoch?: number;
    streamToken?: string;
    error?: string;
  }> {
    const token = this.getSessionToken();
    const nonce = this.generateNonce();
    const seq = this.nextSequence();

    // Broadcast across tabs to suppress local tab conflicts immediately
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'PLAYBACK_CLAIMED',
          tabId: this.tabId,
          deviceId: this.deviceId,
          deviceName: this.deviceName,
        });
      } catch {}
    }

    // Try WebSocket claim first for fastest roundtrip
    const wsClaimSent = this.sendWsMessage({
      type: 'CLAIM_PLAYBACK',
      token,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      trackId: track?.id,
      trackTitle: track?.title,
      trackArtist: track?.artist,
      trackThumb: track?.thumb,
      currentTime: startPosition,
      seq,
      nonce,
      fingerprint: this.deviceFingerprint,
    });

    // Also execute HTTP atomic takeover endpoint to guarantee atomic Lua lease reservation
    try {
      const res = await fetch('/api/session/claim-playback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Device-Fingerprint': this.deviceFingerprint,
          'X-Request-Nonce': nonce,
          'X-Request-Seq': String(seq),
        },
        body: JSON.stringify({
          sessionToken: token,
          username: this.username,
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          trackId: track?.id,
          trackTitle: track?.title,
          trackArtist: track?.artist,
          trackThumb: track?.thumb,
          currentTime: startPosition,
          seq,
          nonce,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.active) {
          this.isHoldingLease = true;
          this.currentLeaseEpoch = data.leaseEpoch || this.currentLeaseEpoch + 1;
          this.streamToken = data.streamToken || null;
          if (this.streamToken) {
            try {
              localStorage.setItem('mouzika_stream_token', this.streamToken);
            } catch {}
          }
          this.startHeartbeat();
          return {
            success: true,
            active: true,
            leaseEpoch: this.currentLeaseEpoch,
            streamToken: this.streamToken || undefined,
          };
        }
      }
    } catch (e) {
      console.warn('[SessionManager] HTTP claim-playback fallback error:', e);
    }

    if (wsClaimSent) {
      this.isHoldingLease = true;
      this.startHeartbeat();
      return { success: true, active: true, leaseEpoch: this.currentLeaseEpoch };
    }

    return { success: false, active: false, error: 'Failed to claim playback lease' };
  }

  // Active Device Throttled State Sync (Broadcasts position & play state to secondary devices)
  public sendStateSync(state: {
    trackId?: string;
    trackTitle?: string;
    trackArtist?: string;
    trackThumb?: string | null;
    currentTime: number;
    duration?: number;
    isPlaying: boolean;
  }) {
    if (!this.isHoldingLease) return;

    if (this.syncThrottlerTimer) return;
    this.syncThrottlerTimer = setTimeout(() => {
      this.syncThrottlerTimer = null;
    }, 1500);

    const payload = {
      type: 'SYNC_STATE',
      deviceId: this.deviceId,
      leaseEpoch: this.currentLeaseEpoch,
      trackId: state.trackId,
      trackTitle: state.trackTitle,
      trackArtist: state.trackArtist,
      trackThumb: state.trackThumb,
      currentTime: Math.floor(state.currentTime * 10) / 10,
      duration: state.duration,
      isPlaying: state.isPlaying,
      seq: this.nextSequence(),
      nonce: this.generateNonce(),
    };

    this.sendWsMessage(payload);
  }

  // Periodic heartbeat keep-alive while audio is actively streaming
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 5000);
  }

  public stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public async sendHeartbeat() {
    if (!this.isHoldingLease) {
      this.stopHeartbeat();
      return;
    }

    // Try WS ping first
    this.sendWsMessage({
      type: 'HEARTBEAT',
      deviceId: this.deviceId,
      leaseEpoch: this.currentLeaseEpoch,
      streamToken: this.streamToken,
    });

    const token = this.getSessionToken();
    const user = this.username;
    if (!token && !user) return;

    try {
      const res = await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(this.streamToken ? { 'X-Playback-Token': this.streamToken } : {}),
        },
        body: JSON.stringify({
          sessionToken: token,
          username: user,
          deviceId: this.deviceId,
          streamToken: this.streamToken,
          leaseEpoch: this.currentLeaseEpoch,
          seq: this.nextSequence(),
          nonce: this.generateNonce(),
        }),
      });

      if (res.status === 409) {
        // HTTP 409 Conflict: another device has taken over the lease!
        const data = await res.json().catch(() => null);
        this.handleSuperseded({
          byDevice: data?.supersededBy || 'Another device',
          at: Date.now(),
          reason: 'heartbeat_conflict_superseded',
          leaseEpoch: data?.leaseEpoch,
        });
      } else if (res.status === 401 || res.status === 403) {
        this.handleSuperseded({
          byDevice: 'Server',
          at: Date.now(),
          reason: 'session_expired_or_invalid_stream_token',
        });
      }
    } catch {}
  }

  // Release playback lease when user pauses or intentionally stops
  public async releasePlaybackLease() {
    this.isHoldingLease = false;
    this.stopHeartbeat();

    this.sendWsMessage({
      type: 'RELEASE_PLAYBACK',
      deviceId: this.deviceId,
      leaseEpoch: this.currentLeaseEpoch,
    });

    const token = this.getSessionToken();
    const user = this.username;
    if (!token && !user) return;

    try {
      await fetch('/api/session/release-playback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sessionToken: token,
          username: user,
          deviceId: this.deviceId,
        }),
      });
    } catch {}
  }

  public async getSessionStatus(): Promise<any> {
    const token = this.getSessionToken();
    if (!token) return { active: false };

    try {
      const res = await fetch(`/api/session/status?deviceId=${encodeURIComponent(this.deviceId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { active: false };
  }
}

export const sessionManager = new SessionManager();
