// Secure Single-Device Playback & Session Manager
// Coordinates device identification, playback lease claims, heartbeat keep-alive,
// Server-Sent Events (SSE) supersession notifications, and cross-tab BroadcastChannel sync.

export interface PlaybackSessionInfo {
  sessionToken: string;
  deviceId: string;
  deviceName: string;
  username: string;
  leaseEpoch: number;
}

export interface SupersededEvent {
  byDevice: string;
  at: number;
  reason?: string;
}

class SessionManager {
  private deviceId: string;
  private deviceName: string;
  private sessionToken: string | null = null;
  private username: string | null = null;
  private currentLeaseEpoch: number = 0;
  private isHoldingLease: boolean = false;
  private heartbeatTimer: any = null;
  private eventSource: EventSource | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private supersededCallbacks: Set<(event: SupersededEvent) => void> = new Set();
  private isReconnectingSse: boolean = false;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceName = this.detectDeviceName();
    this.initBroadcastChannel();
  }

  // Generate or retrieve a persistent, cryptographic unique device identifier
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

  // Detect human-friendly device name for UI display ("Chrome on macOS", "Safari on iPhone", etc.)
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

  // Initialize cross-tab synchronization so multiple tabs in the same browser cannot play simultaneously
  private initBroadcastChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('mouzika_playback_channel');
        this.broadcastChannel.onmessage = (event) => {
          const data = event.data;
          if (!data) return;

          // If another tab started playing for this same user, supersede this tab immediately
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
    this.connectSse();
  }

  public clearSession() {
    this.releasePlaybackLease();
    this.sessionToken = null;
    this.username = null;
    try {
      localStorage.removeItem('mouzika_session_token');
      localStorage.removeItem('mouzika_session_user');
    } catch {}
    this.disconnectSse();
  }

  public onSuperseded(callback: (event: SupersededEvent) => void): () => void {
    this.supersededCallbacks.add(callback);
    return () => this.supersededCallbacks.delete(callback);
  }

  private handleSuperseded(event: SupersededEvent) {
    this.isHoldingLease = false;
    this.stopHeartbeat();
    for (const cb of this.supersededCallbacks) {
      try {
        cb(event);
      } catch (e) {
        console.error('[SessionManager] Error in superseded callback:', e);
      }
    }
  }

  // Connect Server-Sent Events to receive immediate, zero-latency push notification when another device takes over
  public connectSse() {
    const token = this.getSessionToken();
    if (!token || typeof EventSource === 'undefined') return;

    this.disconnectSse();

    try {
      const sseUrl = `/api/session/events?sessionToken=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(this.deviceId)}`;
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'superseded') {
            // Another device took playback ownership!
            if (payload.supersededDeviceId === this.deviceId || payload.byDevice !== this.deviceName) {
              this.handleSuperseded({
                byDevice: payload.byDevice || 'Another device',
                at: payload.timestamp || Date.now(),
                reason: 'superseded_by_remote_device',
              });
            }
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Auto-reconnect with exponential backoff if user is still logged in
        if (!this.isReconnectingSse && this.sessionToken) {
          this.isReconnectingSse = true;
          setTimeout(() => {
            this.isReconnectingSse = false;
            if (this.sessionToken) this.connectSse();
          }, 5000);
        }
      };
    } catch (e) {
      console.warn('[SessionManager] Failed to establish SSE connection:', e);
    }
  }

  public disconnectSse() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // Claim active playback lease on the server (Allows multi-device simultaneous playback)
  public async claimPlaybackLease(track?: { id?: string; title?: string; artist?: string }): Promise<{
    success: boolean;
    active: boolean;
    leaseEpoch?: number;
    error?: string;
  }> {
    this.isHoldingLease = true;
    try {
      await fetch('/api/session/claim-playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.deviceId,
          deviceName: this.deviceName,
          trackId: track?.id,
          trackTitle: track?.title,
          trackArtist: track?.artist,
        }),
      }).catch(() => {});
    } catch {}
    return { success: true, active: true, leaseEpoch: 1 };
  }

  // Periodic heartbeat keep-alive while audio is actively playing
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 4000);
  }

  public stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async sendHeartbeat() {
    if (!this.isHoldingLease) {
      this.stopHeartbeat();
      return;
    }

    const token = this.getSessionToken();
    const user = this.username || (typeof localStorage !== 'undefined' ? localStorage.getItem('hub_active_user') : null);
    if (!token && !user) return;

    try {
      const res = await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sessionToken: token,
          username: user,
          deviceId: this.deviceId,
          leaseEpoch: this.currentLeaseEpoch,
        }),
      });

      if (res.status === 409) {
        // HTTP 409 Conflict: Server detected that another device has taken over the lease!
        const data = await res.json().catch(() => null);
        this.handleSuperseded({
          byDevice: data?.supersededBy || 'Another device',
          at: Date.now(),
          reason: 'heartbeat_conflict_superseded',
        });
      } else if (!res.ok && res.status === 401) {
        // Session expired or invalidated
        this.handleSuperseded({
          byDevice: 'Server',
          at: Date.now(),
          reason: 'session_expired',
        });
      }
    } catch {}
  }

  // Release playback lease when user pauses or stops playback intentionally
  public async releasePlaybackLease() {
    this.isHoldingLease = false;
    this.stopHeartbeat();

    const token = this.getSessionToken();
    const user = this.username || (typeof localStorage !== 'undefined' ? localStorage.getItem('hub_active_user') : null);
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
    const user = this.username || (typeof localStorage !== 'undefined' ? localStorage.getItem('hub_active_user') : null);
    if (!token && !user) return { active: false };

    try {
      const res = await fetch(`/api/session/status?deviceId=${encodeURIComponent(this.deviceId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { active: false };
  }
}

export const sessionManager = new SessionManager();
