import { useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../types';
import { sessionManager, SupersededEvent, RemoteSyncState } from '../services/sessionManager';

export interface UsePlaybackSyncReturn {
  // Remote state
  isRemotePlaybackActive: boolean;
  remoteDeviceName: string | null;
  remoteTrack: Track | null;
  remoteCurrentTime: number;
  remoteDuration: number;
  remoteIsPlaying: boolean;
  activeDeviceId: string | null;
  
  // Local state
  isCurrentDeviceActive: boolean;
  currentDeviceName: string;
  currentDeviceId: string;
  streamToken: string | null;
  leaseEpoch: number;
  
  // Handover & control actions
  claimPlayback: (track?: Track, startPos?: number) => Promise<boolean>;
  releasePlayback: () => Promise<void>;
  broadcastSync: (track: Track | null, currentTime: number, isPlaying: boolean) => void;
  
  // Connection status
  connectionState: 'connected' | 'connecting' | 'disconnected';
  supersededNotice: SupersededEvent | null;
  dismissSupersededNotice: () => void;
}

/**
 * Client-Side State Hook: Server-Authoritative Playback Sync & Handover
 * Coordinates between active audio streaming on this device vs. remote display
 * synchronization when playback is active on a secondary device/tab.
 */
export function usePlaybackSync(): UsePlaybackSyncReturn {
  const [remoteSync, setRemoteSync] = useState<RemoteSyncState | null>(null);
  const [supersededNotice, setSupersededNotice] = useState<SupersededEvent | null>(null);
  const [connectionState, setConnectionState] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [streamToken, setStreamToken] = useState<string | null>(sessionManager.getStreamToken());
  const [leaseEpoch, setLeaseEpoch] = useState<number>(sessionManager.getLeaseEpoch());

  const currentDeviceId = sessionManager.getDeviceId();
  const currentDeviceName = sessionManager.getDeviceName();

  // Determine if another device is currently holding the active playback lease
  const isCurrentDeviceActive = sessionManager.isCurrentDeviceHoldingLease();
  const isRemotePlaybackActive = Boolean(
    remoteSync &&
    remoteSync.activeDeviceId &&
    remoteSync.activeDeviceId !== currentDeviceId &&
    remoteSync.state === 'playing'
  );

  useEffect(() => {
    // 1. Subscribe to WebSocket / SSE synchronization updates
    const unsubscribeSync = sessionManager.onSyncUpdate((state: RemoteSyncState) => {
      setRemoteSync(state);
      setLeaseEpoch(state.leaseEpoch);
      
      // If server revoked our lease, reset stream token
      if (state.activeDeviceId !== currentDeviceId) {
        setStreamToken(null);
      } else if (state.streamToken) {
        setStreamToken(state.streamToken);
      }
    });

    // 2. Subscribe to supersession notifications
    const unsubscribeSuperseded = sessionManager.onSuperseded((evt: SupersededEvent) => {
      setSupersededNotice(evt);
      setStreamToken(null);
    });

    // 3. Monitor connection status
    const unsubscribeConn = sessionManager.onConnectionStatusChange((status) => {
      setConnectionState(status);
    });

    // 4. Initial status check
    sessionManager.getSessionStatus().then((status) => {
      if (status && status.lease) {
        setRemoteSync(status.lease);
        setLeaseEpoch(status.lease.leaseEpoch || 1);
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribeSuperseded();
      unsubscribeConn();
    };
  }, [currentDeviceId]);

  // Request atomic handover to this device
  const claimPlayback = useCallback(async (track?: Track, startPos?: number): Promise<boolean> => {
    setSupersededNotice(null);
    const result = await sessionManager.claimPlaybackLease(
      track ? { id: track.id, title: track.title, artist: track.artist, thumb: track.thumb } : undefined,
      startPos
    );

    if (result.success && result.active) {
      setStreamToken(result.streamToken || null);
      if (result.leaseEpoch) setLeaseEpoch(result.leaseEpoch);
      return true;
    }
    return false;
  }, []);

  // Voluntarily release playback lease
  const releasePlayback = useCallback(async () => {
    await sessionManager.releasePlaybackLease();
    setStreamToken(null);
  }, []);

  // Broadcast throttled local time/state updates to secondary devices
  const broadcastSync = useCallback((track: Track | null, currentTime: number, isPlaying: boolean) => {
    if (sessionManager.isCurrentDeviceHoldingLease()) {
      sessionManager.sendStateSync({
        trackId: track?.id,
        trackTitle: track?.title,
        trackArtist: track?.artist,
        trackThumb: track?.thumb,
        currentTime,
        isPlaying,
      });
    }
  }, []);

  const dismissSupersededNotice = useCallback(() => {
    setSupersededNotice(null);
  }, []);

  return {
    isRemotePlaybackActive,
    remoteDeviceName: remoteSync?.activeDeviceName || null,
    remoteTrack: remoteSync?.track || null,
    remoteCurrentTime: remoteSync?.currentTime || 0,
    remoteDuration: remoteSync?.duration || 0,
    remoteIsPlaying: remoteSync?.state === 'playing',
    activeDeviceId: remoteSync?.activeDeviceId || null,
    isCurrentDeviceActive,
    currentDeviceName,
    currentDeviceId,
    streamToken,
    leaseEpoch,
    claimPlayback,
    releasePlayback,
    broadcastSync,
    connectionState,
    supersededNotice,
    dismissSupersededNotice,
  };
}
