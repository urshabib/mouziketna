import { useState, useCallback } from 'react';
import { Track } from '../types';
import { sessionManager, SupersededEvent } from '../services/sessionManager';

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

export function usePlaybackSync(): UsePlaybackSyncReturn {
  const currentDeviceId = sessionManager.getDeviceId();
  const currentDeviceName = sessionManager.getDeviceName();

  const claimPlayback = useCallback(async (): Promise<boolean> => {
    return true;
  }, []);

  const releasePlayback = useCallback(async () => {}, []);

  const broadcastSync = useCallback(() => {}, []);

  const dismissSupersededNotice = useCallback(() => {}, []);

  return {
    isRemotePlaybackActive: false,
    remoteDeviceName: null,
    remoteTrack: null,
    remoteCurrentTime: 0,
    remoteDuration: 0,
    remoteIsPlaying: false,
    activeDeviceId: currentDeviceId,
    isCurrentDeviceActive: true,
    currentDeviceName,
    currentDeviceId,
    streamToken: 'unrestricted_multi_device_stream',
    leaseEpoch: 1,
    claimPlayback,
    releasePlayback,
    broadcastSync,
    connectionState: 'connected',
    supersededNotice: null,
    dismissSupersededNotice,
  };
}

