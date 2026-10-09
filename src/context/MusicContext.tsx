import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { ArtistPlayStat, CustomPlaylist, DownloadRecord, LyricsData, NavigationPane, Track, UserProfile, UserStats } from '../types';
import { getTranslation, Language } from '../services/i18n';
import {
  NEW_HUB_BACKEND,
  cleanArtistName,
  cleanTitleForLyrics,
  deriveArtistForLyrics,
  fetchLyricsForTrack,
  fetchWithTimeout,
  getCachedStreamUrl,
  cacheStreamUrl,
  prefetchTrackStream,
  resolveMirrorStreams,
  resolveSaavnStream,
  resolveWorkerStream,
  canonicalThumbUrl,
  fetchArtworkBlob,
  FALLBACK_ART,
  fetchJsonRetry,
  normalizeTrack,
  searchTracks,
  getRelatedTracks,
  getTasteProfileRecommendations,
} from '../services/api';
import {
  cacheProfileLocally,
  deleteDownload,
  deleteAllDownloads,
  downloadedIds,
  downloadedQualityMap,
  getDownloadQuality,
  ensurePersistentStorageOnce,
  formatBytes,
  getDownload,
  getDownloadedLyrics,
  saveDownloadLyrics,
  initDownloadsRegistry,
  isDownloaded,
  listDownloads,
  loadDeviceSettings,
  loadProgressBarStyle,
  saveProgressBarStyle,
  loadTasteProfile,
  rememberListen,
  restoreProfileFromCache,
  saveDeviceSettings,
  saveDownload,
  tasteArtistKey,
  tasteArtistScore,
  tasteEvent,
  tasteSkippedArtists,
  tasteTopSeeds,
  addExplicitInterested,
  removeExplicitInterested,
  addExplicitNotInterested,
  removeExplicitNotInterested,
  isExplicitInterested,
  isExplicitNotInterested,
  getExplicitInterestedTracks,
  getExplicitNotInterestedTracks,
  getStoredCoverForTrack,
  getOfflineThumbUrlSync,
  downloadsRegistryReady,
} from '../services/storage';
import { ensureAudioGraph, setBaseAudioVolume, resumeAudioContext } from '../services/audioEnhancer';

interface Toast {
  id: string;
  message: string;
  isGray?: boolean;
}

interface MusicContextType {
  // Navigation
  activePane: NavigationPane;
  setActivePane: (pane: NavigationPane) => void;
  collectionTarget: { type: 'liked' | 'downloads' | 'custom-playlist' | 'artist' | 'playlist'; id?: string | null; title?: string; thumb?: string | null; initialTracks?: Track[] } | null;
  openCollection: (type: 'liked' | 'downloads' | 'custom-playlist' | 'artist' | 'playlist', id?: string | null, title?: string, thumb?: string | null, initialTracks?: Track[]) => void;
  goBack: () => void;

  // Profile & Auth
  globalUser: string | null;
  globalPass: string | null;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  login: (user: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  syncProfile: (updatedProfile?: UserProfile) => void;
  isAuthGateOpen: boolean;
  setIsAuthGateOpen: (open: boolean) => void;
  isAccountSettingsOpen: boolean;
  setIsAccountSettingsOpen: (open: boolean) => void;
  updateUserPassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  updateUserEmail: (newEmail: string) => Promise<{ success: boolean; error?: string }>;
  adminResetUserPassword: (targetUsername: string, newPass: string) => Promise<{ success: boolean; error?: string }>;

  // Playback
  activeTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;
  isShuffle: boolean;
  playbackQueue: Track[];
  queueIndex: number;
  playTrack: (track: Track, fromQueue?: boolean) => Promise<boolean>;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  seekBy: (delta: number) => void;
  setVolumeLevel: (vol: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  toggleShuffle: () => void;
  playNext: () => void;
  playPrevious: () => void;
  addToQueue: (track: Track, playNext?: boolean) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playQueueIndex: (index: number) => void;
  playWholeCollection: (tracks: Track[]) => void;
  playShuffledCollection: (tracks: Track[]) => void;
  playCollectionFromIndex: (tracks: Track[], index: number) => void;

  // Overlays & Sheets
  isFullScreenOpen: boolean;
  setIsFullScreenOpen: (open: boolean) => void;
  isMiniPlayerDismissed: boolean;
  setIsMiniPlayerDismissed: (dismissed: boolean) => void;
  dismissMiniPlayer: () => void;
  isLandscapeStageOpen: boolean;
  setIsLandscapeStageOpen: (open: boolean) => void;
  isLyricsOpen: boolean;
  setIsLyricsOpen: (open: boolean) => void;
  isQueueOpen: boolean;
  setIsQueueOpen: (open: boolean) => void;
  actionSheetTrack: Track | null;
  setActionSheetTrack: (track: Track | null) => void;
  actionSheetMeta: { collectionId?: string } | null;
  setActionSheetMeta: (meta: { collectionId?: string } | null) => void;

  // Modals
  modalCreatePlaylistOpen: boolean;
  setModalCreatePlaylistOpen: (open: boolean) => void;
  modalAddToPlaylistTrack: Track | null;
  setModalAddToPlaylistTrack: (track: Track | null) => void;
  modalImportPlaylistOpen: boolean;
  setModalImportPlaylistOpen: (open: boolean) => void;
  modalAddSongByLinkPlId: string | null;
  setModalAddSongByLinkPlId: (id: string | null) => void;
  modalAudioRecognitionOpen: boolean;
  setModalAudioRecognitionOpen: (open: boolean) => void;
  modalConfirm: { title: string; text: string; onConfirm: () => void } | null;
  setModalConfirm: (conf: { title: string; text: string; onConfirm: () => void } | null) => void;
  isInstallModalOpen: boolean;
  setIsInstallModalOpen: (open: boolean) => void;

  // Internationalization & Language
  t: (key: string, fallback?: string) => string;
  language: Language;
  setLanguage: (lang: Language) => void;

  // Music Taste Tuning
  tuneMusicTaste: (track: Track, direction: 'more' | 'less') => void;
  removeTrackFromTaste: (trackId: string) => void;
  isTuneInterested: (trackId: string) => boolean;
  isTuneDisliked: (trackId: string) => boolean;
  getInterestedTracks: () => Track[];
  getNotInterestedTracks: () => Track[];

  // Listening Stats & Hidden Songs
  hideSongFromStats: (songId: string) => void;
  unhideSongFromStats: (songId: string) => void;

  // Cloud Sync
  forceProfileServerSync: (forcedProfile?: UserProfile) => Promise<boolean>;
  clearListeningStats: () => Promise<boolean>;
  isSyncingToServer: boolean;
  lastServerSyncTime: number | null;

  // Downloads
  downloadedSet: Set<string>;
  downloadQualityMap: Map<string, string>;
  downloadTrack: (track: Track, silent?: boolean, isAutoCache?: boolean) => Promise<boolean>;
  removeDownload: (trackId: string) => Promise<void>;
  removeMultipleDownloads: (trackIds: string[]) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  downloadPlaylist: (tracks: Track[]) => Promise<void>;
  bulkDownloadState: { done: number; total: number; inProgress: boolean };

  // Lyrics
  currentLyrics: LyricsData;
  retryLyrics: () => void;

  // Sleep Timer
  sleepTimerRemaining: number | null; // seconds
  sleepTimerIsEndOfSong: boolean;
  setSleepTimerMinutes: (mins: number) => void;
  setSleepTimerEndOfSong: () => void;
  cancelSleepTimer: () => void;

  // Toast
  showToast: (msg: string, isGray?: boolean) => void;
  toasts: Toast[];

  // Likes & Playlists
  toggleLikeTrack: (track: Track) => void;
  createPlaylist: (name: string, firstTrack?: Track) => void;
  renamePlaylist: (plId: string, newName: string) => void;
  deletePlaylist: (plId: string) => void;
  removeTrackFromPlaylist: (plId: string, trackId: string) => void;
  addTrackToPlaylist: (plId: string, track: Track) => void;
  updatePlaylistTracks: (plId: string, newTracks: Track[]) => void;
  addMultipleTracksToPlaylist: (plId: string, tracks: Track[]) => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

const defaultProfile: UserProfile = {
  username: '',
  likedSongs: [],
  customPlaylists: [],
  favouriteArtists: [],
  favouriteAlbums: [],
  recentlyPlayed: [],
  dataSaver: false,
  dataSaverLevel: 'off',
  downloadQuality: 'stable',
  autoCacheQuality: 'stable',
  customAppName: 'MOUZIKETNA',
  appLogo: 'default',
  downloadLyricsOffline: true,
  downloadArtOffline: true,
  artQualityOffline: 'low',
  autoCachePlayed: false,
  liquidGlass: true,
  language: 'en',
  theme: 'dark',
  accentColor: 'orange',
  lyricsColor: 'white',
  lyricsGlow: 'default',
  keyPartsDisplay: 'dots',
  progressBarStyle: 'default',
  presetTint: 'none',
  uiScale: 'default',
  activePreset: 'glass',
  avatarUrl: null,
  displayName: '',
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePane, setActivePane] = useState<NavigationPane>(() => {
    try {
      if (sessionStorage.getItem('mouzika_restore_after_logo')) {
        return 'settings';
      }
    } catch {}
    return 'home';
  });
  const [navHistory, setNavHistory] = useState<NavigationPane[]>(['home']);
  const [collectionTarget, setCollectionTarget] = useState<MusicContextType['collectionTarget']>(null);

  const [globalUser, setGlobalUser] = useState<string | null>(() => {
    try {
      return localStorage.getItem('hub_active_user') || null;
    } catch {
      return null;
    }
  });
  const [globalPass, setGlobalPass] = useState<string | null>(() => {
    try {
      return localStorage.getItem('hub_active_pass') || null;
    } catch {
      return null;
    }
  });
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const dev = loadDeviceSettings();
    let savedUser = null;
    try {
      savedUser = localStorage.getItem('hub_active_user');
    } catch {}
    const cached = savedUser ? restoreProfileFromCache(savedUser) : null;
    return {
      ...defaultProfile,
      ...(cached || {}),
      ...(dev || {}),
      username: savedUser || (dev as any)?.username || '',
      displayName: cached?.displayName || (dev as any)?.displayName || savedUser || '',
      avatarUrl: (cached?.avatarUrl !== undefined ? cached.avatarUrl : (dev as any)?.avatarUrl) || null,
    };
  });
  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);

  // Playback state
  const [activeTrack, setActiveTrack] = useState<Track | null>(() => {
    try {
      const saved = localStorage.getItem('mouzika_last_played_track');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.title) {
          // If parsed.thumb is missing, empty, generic fallback, or an expired blob URL, recover the persistent cover
          if (
            !parsed.thumb ||
            parsed.thumb.startsWith('blob:') ||
            parsed.thumb.trim().length <= 5 ||
            parsed.thumb === FALLBACK_ART
          ) {
            const recovered = getStoredCoverForTrack(parsed.id);
            if (recovered && !recovered.startsWith('blob:') && recovered !== FALLBACK_ART) {
              parsed.thumb = recovered;
            } else if (parsed.id.length === 11) {
              parsed.thumb = `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg`;
            } else {
              parsed.thumb = canonicalThumbUrl(parsed.id);
            }
            try {
              localStorage.setItem('mouzika_last_played_track', JSON.stringify(parsed));
            } catch {}
          }
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => {
    try {
      const savedPos = localStorage.getItem('mouzika_last_played_pos');
      if (savedPos && !isNaN(Number(savedPos))) {
        return Math.max(0, Number(savedPos));
      }
    } catch {}
    return 0;
  });
  const [duration, setDuration] = useState(() => {
    try {
      const saved = localStorage.getItem('mouzika_last_played_track');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.duration) return parsed.duration;
      }
    } catch {}
    return 0;
  });
  const [isMiniPlayerDismissed, setIsMiniPlayerDismissed] = useState(false);
  const dismissMiniPlayer = useCallback(() => {
    setIsMiniPlayerDismissed(true);
  }, []);

  // Ensure activeTrack cover and metadata remain synchronized with recentlyPlayed and offline downloads
  useEffect(() => {
    if (!activeTrack || !activeTrack.id) return;
    const match = userProfile.recentlyPlayed?.find((t) => t.id === activeTrack.id) ||
                  userProfile.likedSongs?.find((t) => t.id === activeTrack.id);
    if (match?.thumb && !match.thumb.startsWith('blob:') && match.thumb.trim().length > 5 && match.thumb !== FALLBACK_ART) {
      if (match.thumb !== activeTrack.thumb || !activeTrack.thumb || activeTrack.thumb === FALLBACK_ART) {
        setActiveTrack((prev) => {
          if (!prev || prev.id !== activeTrack.id) return prev;
          const updated = { ...prev, thumb: match.thumb };
          try {
            localStorage.setItem('mouzika_last_played_track', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    }
  }, [userProfile.recentlyPlayed, userProfile.likedSongs, activeTrack?.id, activeTrack?.thumb]);

  useEffect(() => {
    downloadsRegistryReady.then(() => {
      if (!activeTrack || !activeTrack.id) return;
      const offThumb = getOfflineThumbUrlSync(activeTrack.id);
      if (offThumb && (!activeTrack.thumb || activeTrack.thumb.startsWith('blob:'))) {
        setActiveTrack((prev) => (prev ? { ...prev, thumb: offThumb } : prev));
      }
    });
  }, [activeTrack?.id]);
  const [volume, setVolume] = useState(() => {
    try {
      return Number(localStorage.getItem('hub_volume') ?? 50);
    } catch {
      return 50;
    }
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  // Audio elements & Synchronized Refs to avoid stale closures
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const playTokenRef = useRef(0);
  const hasPrefetchedNextRef = useRef(false);
  const playedHistoryRef = useRef<Track[]>([]);

  const playbackQueueRef = useRef<Track[]>([]);
  const queueIndexRef = useRef(-1);
  const activeTrackRef = useRef<Track | null>(null);
  const isShuffleRef = useRef(false);
  const isLoopingRef = useRef(false);
  const playTrackRef = useRef<((t: Track, isRetry?: boolean) => Promise<boolean>) | null>(null);
  const playNextRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const playPreviousRef = useRef<() => void>(() => {});
  const seekDebounceTimerRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);
  const lastSeekTimestampRef = useRef<number>(0);

  // Overlays
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [isLandscapeStageOpen, setIsLandscapeStageOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [actionSheetTrack, setActionSheetTrack] = useState<Track | null>(null);
  const [actionSheetMeta, setActionSheetMeta] = useState<{ collectionId?: string } | null>(null);

  // Modals
  const [modalCreatePlaylistOpen, setModalCreatePlaylistOpen] = useState(false);
  const [modalAddToPlaylistTrack, setModalAddToPlaylistTrack] = useState<Track | null>(null);
  const [modalImportPlaylistOpen, setModalImportPlaylistOpen] = useState(false);
  const [modalAddSongByLinkPlId, setModalAddSongByLinkPlId] = useState<string | null>(null);
  const [modalAudioRecognitionOpen, setModalAudioRecognitionOpen] = useState(false);
  const [modalConfirm, setModalConfirm] = useState<{ title: string; text: string; onConfirm: () => void } | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(() => {
    try {
      if (sessionStorage.getItem('mouzika_restore_install_modal')) {
        sessionStorage.removeItem('mouzika_restore_install_modal');
        return true;
      }
    } catch {}
    return false;
  });

  const language = (userProfile.language || 'en') as Language;
  const t = useCallback(
    (key: string, fallback?: string): string => {
      return getTranslation(userProfile.language || 'en', key, fallback);
    },
    [userProfile.language]
  );

  const setLanguage = useCallback(
    (lang: Language) => {
      setUserProfile((prev) => {
        const updated = { ...prev, language: lang };
        saveDeviceSettings({ language: lang });
        if (globalUser && globalUser !== 'admin') {
          cacheProfileLocally(globalUser, updated);
          pendingSyncProfRef.current = updated;
          isSyncDirtyRef.current = true;
        }
        return updated;
      });
    },
    [globalUser]
  );

  // Cloudflare Batch & Quota-Protected Server Syncing
  const [isSyncingToServer, setIsSyncingToServer] = useState(false);
  const [lastServerSyncTime, setLastServerSyncTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('mouzika_last_server_sync_time');
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  const pendingSyncProfRef = useRef<UserProfile | null>(null);
  const isSyncDirtyRef = useRef(false);
  const lastServerSyncTimestampRef = useRef<number>(0);

  const flushProfileToServer = useCallback(
    async (forcedProfile?: UserProfile): Promise<boolean> => {
      const profToSync = forcedProfile || pendingSyncProfRef.current || userProfile;
      if (!globalUser || globalUser === 'admin') return false;

      // Ensure local cache has the most recent changes immediately
      cacheProfileLocally(globalUser, profToSync);

      try {
        setIsSyncingToServer(true);
        const now = Date.now();
        lastServerSyncTimestampRef.current = now;
        setLastServerSyncTime(now);
        try {
          localStorage.setItem('mouzika_last_server_sync_time', String(now));
        } catch {}

        const activeStats = profToSync.stats || userProfile.stats || {
          totalMinutesListened: 0,
          totalTracksPlayed: 0,
          topSongs: [],
          topArtists: [],
          lastUpdated: now,
        };

        const explicitInterested = getExplicitInterestedTracks();
        const explicitNotInterested = getExplicitNotInterestedTracks();

        // System record embedded inside favouriteAlbums:
        // Cloudflare Worker whitelist preserves favouriteAlbums completely across devices!
        const cloudStatsRecord: any = {
          id: '__mouzika_cloud_stats_v1__',
          title: '__mouzika_cloud_stats__',
          type: 'system_stats',
          stats: activeStats,
          explicitInterested,
          explicitNotInterested,
          updatedAt: now,
        };

        const rawAlbums = (profToSync.favouriteAlbums || userProfile.favouriteAlbums || []).filter(
          (a: any) => a && a.id !== '__mouzika_cloud_stats_v1__'
        );

        // Full consolidated profile payload with listening stats and explicit music taste
        const payload = {
          ...profToSync,
          username: globalUser,
          displayName: profToSync.displayName || profToSync.username || globalUser,
          avatarUrl: profToSync.avatarUrl || null,
          stats: activeStats,
          favouriteAlbums: [...rawAlbums, cloudStatsRecord],
          explicitInterested,
          explicitNotInterested,
        };

        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/save-profile`, 8000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          isSyncDirtyRef.current = false;
          pendingSyncProfRef.current = null;
          return true;
        }
        return false;
      } catch (err) {
        // Retained safely in localStorage cache to retry later
        return false;
      } finally {
        setIsSyncingToServer(false);
      }
    },
    [globalUser, userProfile]
  );

  // Periodic Background Batch Sync:
  // Runs every 5 minutes, checking if local changes are dirty (Quota-efficient)
  useEffect(() => {
    const PERIODIC_SYNC_INTERVAL = 5 * 60 * 1000;
    const intervalId = setInterval(() => {
      if (isSyncDirtyRef.current && globalUser && globalUser !== 'admin') {
        flushProfileToServer();
      }
    }, PERIODIC_SYNC_INTERVAL);

    return () => clearInterval(intervalId);
  }, [globalUser, flushProfileToServer]);

  // Flush pending changes when user switches away, minimizes app, or closes window
  useEffect(() => {
    const handleFlushOnLeave = () => {
      if (audioRef.current && audioRef.current.currentTime >= 0) {
        try {
          localStorage.setItem('mouzika_last_played_pos', String(Math.floor(audioRef.current.currentTime)));
        } catch {}
      }
      if (activeTrack) {
        try {
          const safeThumb = (activeTrack.thumb && !activeTrack.thumb.startsWith('blob:') && activeTrack.thumb.trim().length > 5 && activeTrack.thumb !== FALLBACK_ART)
            ? activeTrack.thumb
            : (getStoredCoverForTrack(activeTrack.id) || (activeTrack.id.length === 11 ? `https://i.ytimg.com/vi/${activeTrack.id}/hqdefault.jpg` : canonicalThumbUrl(activeTrack.id)));
          const safePersistent = { ...activeTrack, thumb: safeThumb };
          localStorage.setItem('mouzika_last_played_track', JSON.stringify(safePersistent));
        } catch {}
      }
      if (isSyncDirtyRef.current && globalUser && globalUser !== 'admin') {
        flushProfileToServer();
      }
    };
    window.addEventListener('beforeunload', handleFlushOnLeave);
    const handleVis = () => {
      if (document.visibilityState === 'hidden') {
        handleFlushOnLeave();
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      window.removeEventListener('beforeunload', handleFlushOnLeave);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [globalUser, flushProfileToServer]);

  // Downloads
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  const [bulkDownloadState, setBulkDownloadState] = useState({ done: 0, total: 0, inProgress: false });

  // Lyrics
  const [currentLyrics, setCurrentLyrics] = useState<LyricsData>({ mode: 'none' });

  // Sleep Timer
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [sleepTimerIsEndOfSong, setSleepTimerIsEndOfSong] = useState(false);
  const sleepTimerIdRef = useRef<any>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, isGray = false) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, isGray }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1800);
  }, []);

  // Initialize audio elements
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    (audio as any).playsInline = true;
    (audio as any).webkitPlaysInline = true;
    audio.volume = volume / 100;
    audioRef.current = audio;
    ensureAudioGraph(audio);
    setBaseAudioVolume(volume);

    const prefetchAudio = new Audio();
    prefetchAudio.preload = 'auto';
    prefetchAudio.muted = true;
    (prefetchAudio as any).playsInline = true;
    (prefetchAudio as any).webkitPlaysInline = true;
    prefetchAudioRef.current = prefetchAudio;

    const onPlay = () => {
      setIsPlaying(true);
      ensureAudioGraph(audio);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      if (audio && audio.currentTime >= 0) {
        try {
          localStorage.setItem('mouzika_last_played_pos', String(Math.floor(audio.currentTime)));
        } catch {}
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    };
    const onWaiting = () => {
      // Do not flash the loading spinner on instantaneous seeks or right after user seeks
      if (!isSeekingRef.current && !audio.seeking && Date.now() - lastSeekTimestampRef.current > 3000) {
        setIsBuffering(true);
      }
    };
    const onSeeking = () => {
      isSeekingRef.current = true;
      setIsBuffering(false);
    };
    const onSeeked = () => {
      setIsBuffering(false);
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 600);
    };
    const onPlaying = () => {
      isSeekingRef.current = false;
      setIsBuffering(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    };
    const updatePositionState = () => {
      if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
        if (audio && isFinite(audio.duration) && audio.duration > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration: audio.duration,
              playbackRate: audio.playbackRate || 1,
              position: Math.max(0, Math.min(audio.currentTime, audio.duration)),
            });
          } catch {}
        }
      }
    };
    let lastTrackSec = 0;
    let lastSavedPosSec = 0;
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      updatePositionState();

      // Persist playback position strictly in localStorage
      const curSec = Math.floor(audio.currentTime);
      if (curSec > 0 && Math.abs(curSec - lastSavedPosSec) >= 1) {
        lastSavedPosSec = curSec;
        try {
          localStorage.setItem('mouzika_last_played_pos', String(curSec));
        } catch {}
      }

      // Accumulate listening seconds
      if (curSec !== lastTrackSec && curSec > 0) {
        lastTrackSec = curSec;
        listeningSecondsAccumRef.current += 1;
        if (listeningSecondsAccumRef.current >= 45) {
          listeningSecondsAccumRef.current = 0;
          recordListeningMinute(1);
        }
      }

      // Auto prefetch check: trigger at 25s left in song, or once track has played for 12s
      if (
        !hasPrefetchedNextRef.current &&
        ((audio.duration > 20 && audio.duration - audio.currentTime <= 25) || audio.currentTime >= 12)
      ) {
        hasPrefetchedNextRef.current = true;
        prefetchNextSong();
      }
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsBuffering(false);
      updatePositionState();
    };
    const onEnded = () => {
      try {
        localStorage.setItem('mouzika_last_played_pos', '0');
      } catch {}
      if (isLoopingRef.current || (audioRef.current && audioRef.current.loop)) {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } else {
        if (playNextRef.current) {
          playNextRef.current();
        }
      }
    };

    // Auto-reconnect & self-heal if audio stream encounters an unexpected network stall or disconnect
    const onAudioError = () => {
      // NEVER reconnect or reload track if user was actively seeking or sought recently!
      // When seeking, browser cancels previous stream range requests which dispatches transient error codes.
      // Reconnecting here would restart the track and make audio play twice!
      const timeSinceSeek = Date.now() - lastSeekTimestampRef.current;
      if (isSeekingRef.current || (audio && audio.seeking) || timeSinceSeek < 6000) {
        console.warn('Ignoring transient audio range abort during/after seek');
        return;
      }
      // If error is code 1 (MEDIA_ERR_ABORTED), it was intentionally aborted by the browser
      if (audio?.error?.code === 1) {
        console.warn('Ignoring MEDIA_ERR_ABORTED on audio element');
        return;
      }
      const active = activeTrackRef.current;
      if (active && audio && !audio.ended && audio.currentTime > 0) {
        const resumePos = audio.currentTime;
        console.warn('Audio stream drop detected, automatically reconnecting from:', resumePos);
        if (playTrackRef.current) {
          playTrackRef.current(active, true).then((ok) => {
            if (ok && audioRef.current && resumePos > 0) {
              audioRef.current.currentTime = resumePos;
            }
          });
        }
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('seeking', onSeeking);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onAudioError);

    // Keep background audio active when screen turns off or locks on iPhone / iOS
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && audioRef.current) {
        // If track was playing and screen is turned off, ensure playback stays active
        if (!audioRef.current.paused && audioRef.current.currentTime > 0) {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Init downloads registry
    initDownloadsRegistry().then(() => {
      setDownloadedSet(new Set(downloadedIds));
    });

    // Device settings initialization
    const devSettings = loadDeviceSettings();
    if (devSettings) {
      setUserProfile((prev) => ({ ...prev, ...devSettings }));
      applyTheme(
        devSettings.theme || 'dark',
        devSettings.accentColor || 'orange',
        devSettings.lyricsColor || 'white',
        devSettings.presetTint || 'none',
        devSettings.liquidGlass ?? true,
        devSettings.uiScale || 'default',
        devSettings.customAccentHex,
        devSettings.lyricsFont,
        devSettings.customLyricsHex,
        devSettings.lyricsGlow,
        devSettings.liquidGlassLevel
      );
    }

    const sanitizeTracks = (tracks?: Track[]): Track[] => {
      if (!tracks || !Array.isArray(tracks)) return [];
      return tracks.map((t) => {
        if (t && t.thumb && t.thumb.startsWith('blob:') && t.id) {
          return { ...t, thumb: canonicalThumbUrl(t.id) };
        }
        return t;
      });
    };

    // Auto-login on launch if saved or cached
    let savedUser: string | null = null;
    let savedPass: string | null = null;
    try {
      savedUser = localStorage.getItem('hub_active_user');
      savedPass = localStorage.getItem('hub_active_pass');
    } catch {}

    if (savedUser) {
      // User is already signed in! Keep them directly in their account without showing the welcome screen
      setGlobalUser(savedUser);
      setIsAuthGateOpen(false);

      if (savedUser !== 'admin') {
        const cached = restoreProfileFromCache(savedUser);
        if (cached) {
          if (cached.recentlyPlayed) {
            cached.recentlyPlayed = sanitizeTracks(cached.recentlyPlayed);
          }
          setUserProfile((prev) => ({ ...prev, ...cached }));
        }
      }

      if (savedPass) {
        // Silently sync profile in background
        login(savedUser, savedPass).catch(() => {});
      }
    } else {
      // New visitor or logged out: require sign in
      setIsAuthGateOpen(true);
    }

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const applyTheme = (
    theme: string,
    accent: string,
    lyricsColor: string,
    presetTint: string,
    liquidGlass: boolean,
    uiScale: string = 'default',
    customAccentHex?: string,
    lyricsFont?: string,
    customLyricsHex?: string,
    lyricsGlow?: string,
    liquidGlassLevel?: 'off' | 'medium' | 'ultra'
  ) => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
    document.documentElement.setAttribute('data-lyrics-color', lyricsColor);
    document.documentElement.setAttribute('data-preset-tint', presetTint);
    document.documentElement.setAttribute('data-ui-scale', uiScale || 'default');
    document.documentElement.setAttribute('data-lyrics-glow', lyricsGlow || 'default');
    if (lyricsFont) {
      document.documentElement.setAttribute('data-lyrics-font', lyricsFont);
    }
    if (customAccentHex || (accent && accent.startsWith('#'))) {
      const hex = customAccentHex || accent;
      document.documentElement.style.setProperty('--accent', hex);
      document.documentElement.style.setProperty('--accent-hover', hex);
      document.documentElement.style.setProperty('--accent-soft', `${hex}28`);
    } else {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-hover');
      document.documentElement.style.removeProperty('--accent-soft');
    }

    if (customLyricsHex || (lyricsColor && lyricsColor.startsWith('#'))) {
      const lyrHex = customLyricsHex || lyricsColor;
      document.documentElement.style.setProperty('--lyrics-color', lyrHex);
      const cleanHex = lyrHex.replace('#', '');
      if (cleanHex.length === 6) {
        const r = parseInt(cleanHex.slice(0, 2), 16);
        const g = parseInt(cleanHex.slice(2, 4), 16);
        const b = parseInt(cleanHex.slice(4, 6), 16);
        document.documentElement.style.setProperty('--lyrics-color-rgb', `${r}, ${g}, ${b}`);
      }
    } else {
      document.documentElement.style.removeProperty('--lyrics-color');
      document.documentElement.style.removeProperty('--lyrics-color-rgb');
    }

    const isGlassOff = liquidGlassLevel === 'off' || liquidGlass === false;
    const isUltra = liquidGlassLevel === 'ultra';
    const isMedium = !isGlassOff && !isUltra;
    document.body.classList.toggle('liquid-glass', isMedium);
    document.body.classList.toggle('liquid-glass-ultra', isUltra);
  };

  const syncProfile = useCallback((updated?: UserProfile) => {
    const prof = updated || userProfile;
    setUserProfile(prof);
    saveDeviceSettings(prof);
    if (prof.progressBarStyle) {
      saveProgressBarStyle(prof.progressBarStyle);
    }
    applyTheme(
      prof.theme,
      prof.accentColor,
      prof.lyricsColor,
      prof.presetTint,
      prof.liquidGlass,
      prof.uiScale,
      prof.customAccentHex,
      prof.lyricsFont,
      prof.customLyricsHex,
      prof.lyricsGlow,
      prof.liquidGlassLevel
    );
    if (!globalUser || globalUser === 'admin') return;
    cacheProfileLocally(globalUser, prof);
    pendingSyncProfRef.current = prof;
    isSyncDirtyRef.current = true;
  }, [userProfile, globalUser]);

  const login = async (user: string, pass: string) => {
    try {
      const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/login`, 9000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (data.error) {
        return { success: false, error: data.error };
      }
      setGlobalUser(user);
      setGlobalPass(pass);
      try {
        localStorage.setItem('hub_active_user', user);
        localStorage.setItem('hub_active_pass', pass);
      } catch {}
      setIsAuthGateOpen(false);

      if (data.isAdmin) {
        showToast('Logged in as Admin');
      } else if (data.profile) {
        const p = data.profile;
        const devSettings = loadDeviceSettings() || {};
        const sanitizeTracks = (tracks?: Track[]): Track[] => {
          if (!tracks || !Array.isArray(tracks)) return [];
          return tracks.map((t) => {
            if (t && t.thumb && t.thumb.startsWith('blob:') && t.id) {
              return { ...t, thumb: canonicalThumbUrl(t.id) };
            }
            return t;
          });
        };

        const localCached = restoreProfileFromCache(user);
        const localStats = localCached?.stats || userProfile.stats;
        let serverStats = p.stats;
        let cloudTasteInterested = p.explicitInterested;
        let cloudTasteNotInterested = p.explicitNotInterested;

        // Extract cloud stats preserved inside favouriteAlbums system record
        if (Array.isArray(p.favouriteAlbums)) {
          const cloudRecord = p.favouriteAlbums.find((a: any) => a && a.id === '__mouzika_cloud_stats_v1__');
          if (cloudRecord && cloudRecord.stats) {
            if (!serverStats || (cloudRecord.stats.totalMinutesListened || 0) >= (serverStats.totalMinutesListened || 0)) {
              serverStats = cloudRecord.stats;
            }
            if (!cloudTasteInterested && cloudRecord.explicitInterested) {
              cloudTasteInterested = cloudRecord.explicitInterested;
            }
            if (!cloudTasteNotInterested && cloudRecord.explicitNotInterested) {
              cloudTasteNotInterested = cloudRecord.explicitNotInterested;
            }
          }
        }

        // Intelligent stat merge: preserve all minutes listened and counts
        const mergedStats = {
          totalMinutesListened: Math.max(serverStats?.totalMinutesListened || 0, localStats?.totalMinutesListened || 0),
          totalTracksPlayed: Math.max(serverStats?.totalTracksPlayed || 0, localStats?.totalTracksPlayed || 0),
          topSongs: (serverStats?.topSongs && serverStats.topSongs.length > 0 && (serverStats.totalMinutesListened || 0) >= (localStats?.totalMinutesListened || 0))
            ? serverStats.topSongs
            : (localStats?.topSongs && localStats.topSongs.length > 0 ? localStats.topSongs : serverStats?.topSongs || []),
          topArtists: (serverStats?.topArtists && serverStats.topArtists.length > 0 && (serverStats.totalMinutesListened || 0) >= (localStats?.totalMinutesListened || 0))
            ? serverStats.topArtists
            : (localStats?.topArtists && localStats.topArtists.length > 0 ? localStats.topArtists : serverStats?.topArtists || []),
          lastUpdated: Math.max(serverStats?.lastUpdated || 0, localStats?.lastUpdated || 0, Date.now()),
        };

        // Restore explicit music taste preferences from cloud if present
        if (cloudTasteInterested && Array.isArray(cloudTasteInterested)) {
          try {
            localStorage.setItem('mouzika_taste_explicit_interested', JSON.stringify(cloudTasteInterested));
          } catch {}
        }
        if (cloudTasteNotInterested && Array.isArray(cloudTasteNotInterested)) {
          try {
            localStorage.setItem('mouzika_taste_explicit_not_interested', JSON.stringify(cloudTasteNotInterested));
          } catch {}
        }

        const cleanAlbums = (p.favouriteAlbums || []).filter((a: any) => a && a.id !== '__mouzika_cloud_stats_v1__');

        const merged: UserProfile = {
          ...userProfile,
          username: p.username || user,
          likedSongs: sanitizeTracks(p.likedSongs),
          customPlaylists: p.customPlaylists || [],
          favouriteArtists: p.favouriteArtists || [],
          favouriteAlbums: cleanAlbums,
          recentlyPlayed: sanitizeTracks(p.recentlyPlayed),
          dataSaver: devSettings.dataSaver !== undefined ? !!devSettings.dataSaver : !!p.dataSaver,
          dataSaverLevel: devSettings.dataSaverLevel || p.dataSaverLevel || 'off',
          downloadQuality: devSettings.downloadQuality || userProfile.downloadQuality || 'stable',
          downloadArtOffline: devSettings.downloadArtOffline !== undefined ? devSettings.downloadArtOffline : true,
          artQualityOffline: devSettings.artQualityOffline || userProfile.artQualityOffline || 'low',
          customAppName: devSettings.customAppName || userProfile.customAppName || 'MOUZIKETNA',
          appLogo: devSettings.appLogo || userProfile.appLogo || 'default',
          downloadLyricsOffline: devSettings.downloadLyricsOffline !== undefined ? !!devSettings.downloadLyricsOffline : !!p.downloadLyricsOffline,
          autoCachePlayed: devSettings.autoCachePlayed !== undefined ? !!devSettings.autoCachePlayed : false,
          autoCacheQuality: devSettings.autoCacheQuality || userProfile.autoCacheQuality || 'stable',
          liquidGlass: devSettings.liquidGlass !== undefined ? !!devSettings.liquidGlass : (p.liquidGlass !== undefined ? !!p.liquidGlass : true),
          theme: devSettings.theme || (p.theme === 'light' ? 'light' : 'dark'),
          accentColor: devSettings.accentColor || p.accentColor || 'orange',
          lyricsColor: devSettings.lyricsColor || p.lyricsColor || 'white',
          lyricsGlow: devSettings.lyricsGlow || p.lyricsGlow || 'default',
          presetTint: devSettings.presetTint || p.presetTint || 'none',
          uiScale: devSettings.uiScale || p.uiScale || 'default',
          activePreset: devSettings.activePreset || p.activePreset || 'glass',
          liquidGlassLevel: devSettings.liquidGlassLevel || p.liquidGlassLevel || userProfile.liquidGlassLevel || 'medium',
          customAccentHex: devSettings.customAccentHex || p.customAccentHex || userProfile.customAccentHex,
          lyricsFont: devSettings.lyricsFont || p.lyricsFont || userProfile.lyricsFont,
          customLyricsHex: devSettings.customLyricsHex || p.customLyricsHex || userProfile.customLyricsHex,
          progressBarStyle: devSettings.progressBarStyle || loadProgressBarStyle() || p.progressBarStyle || userProfile.progressBarStyle || 'default',
          progressBarColor: devSettings.progressBarColor || p.progressBarColor || userProfile.progressBarColor || '#ffffff',
          customProgressBarHex: devSettings.customProgressBarHex || p.customProgressBarHex || userProfile.customProgressBarHex,
          keyPartsDisplay: devSettings.keyPartsDisplay || p.keyPartsDisplay || userProfile.keyPartsDisplay || 'dots',
          displayName: p.displayName || localCached?.displayName || (devSettings as any)?.displayName || p.username || user,
          avatarUrl: p.avatarUrl || localCached?.avatarUrl || (devSettings as any)?.avatarUrl || null,
          stats: mergedStats,
        };
        setUserProfile(merged);
        saveDeviceSettings(merged);
        if (merged.progressBarStyle) {
          saveProgressBarStyle(merged.progressBarStyle);
        }
        applyTheme(
          merged.theme,
          merged.accentColor,
          merged.lyricsColor,
          merged.presetTint,
          merged.liquidGlass,
          merged.uiScale,
          merged.customAccentHex,
          merged.lyricsFont,
          merged.customLyricsHex,
          merged.lyricsGlow
        );
        cacheProfileLocally(user, merged);

        // If local had higher stats, push the merged numbers up to the server
        if (mergedStats.totalMinutesListened > (serverStats?.totalMinutesListened || 0)) {
          setTimeout(() => flushProfileToServer(merged), 800);
        }
      }
      return { success: true };
    } catch {
      return { success: false, error: "Can't reach server. Working in offline mode." };
    }
  };

  // Two-way synchronization: pull latest cloud state, then push consolidated updates
  const forceProfileServerSync = useCallback(async (forcedProfile?: UserProfile): Promise<boolean> => {
    if (!globalUser || globalUser === 'admin') return false;
    if (forcedProfile) {
      return flushProfileToServer(forcedProfile);
    }
    let savedPass = globalPass;
    if (!savedPass) {
      try {
        savedPass = localStorage.getItem('hub_active_pass');
      } catch {}
    }
    if (savedPass) {
      try {
        await login(globalUser, savedPass);
      } catch {}
    }
    return flushProfileToServer();
  }, [globalUser, globalPass, flushProfileToServer]);

  // Clear listening statistics: resets minutes, plays, top songs, and top artists
  // while keeping recently played, liked songs, and playlists completely untouched
  const clearListeningStats = useCallback(async (): Promise<boolean> => {
    const resetStats: UserStats = {
      totalMinutesListened: 0,
      totalTracksPlayed: 0,
      topSongs: [],
      topArtists: [],
      lastUpdated: Date.now(),
    };

    const targetUser = globalUser || userProfile.username;

    setUserProfile((prev) => {
      const cleanAlbums = (prev.favouriteAlbums || []).filter((a: any) => a && a.id !== '__mouzika_cloud_stats_v1__');
      const updated: UserProfile = {
        ...prev,
        stats: resetStats,
        favouriteAlbums: cleanAlbums,
      };
      saveDeviceSettings(updated);
      if (targetUser && targetUser !== 'admin') {
        cacheProfileLocally(targetUser, updated);
      }
      return updated;
    });

    if (targetUser && targetUser !== 'admin') {
      const cleanProf: UserProfile = {
        ...userProfile,
        stats: resetStats,
        favouriteAlbums: (userProfile.favouriteAlbums || []).filter((a: any) => a && a.id !== '__mouzika_cloud_stats_v1__'),
      };
      await flushProfileToServer(cleanProf);
    }

    return true;
  }, [globalUser, userProfile, flushProfileToServer]);

  // Hide song from listening stats (deducts time & plays, moves to hiddenStatsSongs)
  const hideSongFromStats = useCallback((songId: string) => {
    if (!songId) return;
    setUserProfile((prev) => {
      const stats = prev.stats || {
        totalMinutesListened: 0,
        totalTracksPlayed: 0,
        topSongs: [],
        topArtists: [],
      };
      const currentTop = stats.topSongs || [];
      const songToHide = currentTop.find((s) => s.id === songId);
      if (!songToHide) return prev;

      const newTop = currentTop.filter((s) => s.id !== songId);
      const existingHidden = prev.hiddenStatsSongs || [];
      const newHidden = [songToHide, ...existingHidden.filter((s) => s.id !== songId)];

      // Deduct song's minutes and play count from total statistics
      const deductedMins = Math.max(0, (stats.totalMinutesListened || 0) - (songToHide.minutesListened || 0));
      const deductedPlays = Math.max(0, (stats.totalTracksPlayed || 0) - (songToHide.playCount || 0));

      // Recompute topArtists based on visible newTop songs
      const artistMap = new Map<string, ArtistPlayStat>();
      newTop.forEach((s) => {
        const art = (s.artist || 'Unknown').trim();
        const key = art.toLowerCase();
        const ex = artistMap.get(key);
        if (ex) {
          ex.playCount = (ex.playCount || 0) + (s.playCount || 1);
          ex.minutesListened = (ex.minutesListened || 0) + (s.minutesListened || 0);
          if (!ex.thumb && s.thumb) ex.thumb = s.thumb;
        } else {
          artistMap.set(key, {
            name: art,
            playCount: s.playCount || 1,
            minutesListened: s.minutesListened || 0,
            thumb: s.thumb,
          });
        }
      });
      const newTopArtists = Array.from(artistMap.values()).sort(
        (a, b) => (b.minutesListened || 0) - (a.minutesListened || 0)
      );

      const updatedStats: UserStats = {
        ...stats,
        totalMinutesListened: deductedMins,
        totalTracksPlayed: deductedPlays,
        topSongs: newTop,
        topArtists: newTopArtists.slice(0, 20),
        lastUpdated: Date.now(),
      };

      const updated: UserProfile = {
        ...prev,
        stats: updatedStats,
        hiddenStatsSongs: newHidden,
      };

      saveDeviceSettings(updated);
      const targetUser = globalUser || prev.username;
      if (targetUser && targetUser !== 'admin') {
        cacheProfileLocally(targetUser, updated);
        pendingSyncProfRef.current = updated;
        isSyncDirtyRef.current = true;
      }
      return updated;
    });
  }, [globalUser]);

  // Restore hidden song back to listening stats (restores time & plays, moves back to topSongs)
  const unhideSongFromStats = useCallback((songId: string) => {
    if (!songId) return;
    setUserProfile((prev) => {
      const existingHidden = prev.hiddenStatsSongs || [];
      const songToRestore = existingHidden.find((s) => s.id === songId);
      if (!songToRestore) return prev;

      const newHidden = existingHidden.filter((s) => s.id !== songId);
      const stats = prev.stats || {
        totalMinutesListened: 0,
        totalTracksPlayed: 0,
        topSongs: [],
        topArtists: [],
      };

      const currentTop = [...(stats.topSongs || [])];
      if (!currentTop.some((s) => s.id === songId)) {
        currentTop.push(songToRestore);
      }
      currentTop.sort((a, b) => ((b.playCount || 0) * 3 + (b.minutesListened || 0)) - ((a.playCount || 0) * 3 + (a.minutesListened || 0)));

      const restoredMins = (stats.totalMinutesListened || 0) + (songToRestore.minutesListened || 0);
      const restoredPlays = (stats.totalTracksPlayed || 0) + (songToRestore.playCount || 0);

      // Recompute topArtists based on visible currentTop songs
      const artistMap = new Map<string, ArtistPlayStat>();
      currentTop.forEach((s) => {
        const art = (s.artist || 'Unknown').trim();
        const key = art.toLowerCase();
        const ex = artistMap.get(key);
        if (ex) {
          ex.playCount = (ex.playCount || 0) + (s.playCount || 1);
          ex.minutesListened = (ex.minutesListened || 0) + (s.minutesListened || 0);
          if (!ex.thumb && s.thumb) ex.thumb = s.thumb;
        } else {
          artistMap.set(key, {
            name: art,
            playCount: s.playCount || 1,
            minutesListened: s.minutesListened || 0,
            thumb: s.thumb,
          });
        }
      });
      const newTopArtists = Array.from(artistMap.values()).sort(
        (a, b) => (b.minutesListened || 0) - (a.minutesListened || 0)
      );

      const updatedStats: UserStats = {
        ...stats,
        totalMinutesListened: restoredMins,
        totalTracksPlayed: restoredPlays,
        topSongs: currentTop,
        topArtists: newTopArtists.slice(0, 20),
        lastUpdated: Date.now(),
      };

      const updated: UserProfile = {
        ...prev,
        stats: updatedStats,
        hiddenStatsSongs: newHidden,
      };

      saveDeviceSettings(updated);
      const targetUser = globalUser || prev.username;
      if (targetUser && targetUser !== 'admin') {
        cacheProfileLocally(targetUser, updated);
        pendingSyncProfRef.current = updated;
        isSyncDirtyRef.current = true;
      }
      return updated;
    });
  }, [globalUser]);

  const logout = () => {
    try {
      localStorage.removeItem('hub_active_user');
      localStorage.removeItem('hub_active_pass');
      localStorage.removeItem('hub_is_guest');
    } catch {}
    setGlobalUser(null);
    setGlobalPass(null);
    setUserProfile(defaultProfile);
    setIsAuthGateOpen(true);
    showToast('Logged out', true);
  };

  const updateUserEmail = useCallback(async (newEmail: string): Promise<{ success: boolean; error?: string }> => {
    if (!globalUser) {
      return { success: false, error: 'You must be logged in to update your email.' };
    }
    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const updated: UserProfile = {
      ...userProfile,
      email: cleanEmail,
    };
    syncProfile(updated);

    try {
      fetchWithTimeout(`${NEW_HUB_BACKEND}/api/update-email`, 8000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: globalUser,
          email: cleanEmail,
        }),
      }).catch(() => {});
    } catch {}

    await forceProfileServerSync(updated);
    showToast('Email address linked & synced to cloud');
    return { success: true };
  }, [globalUser, userProfile, syncProfile, forceProfileServerSync, showToast]);

  const updateUserPassword = useCallback(async (currentPass: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
    if (!globalUser) {
      return { success: false, error: 'You must be logged in to change your password.' };
    }
    const cachedPass = globalPass || localStorage.getItem('hub_active_pass');
    if (cachedPass && currentPass !== cachedPass) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    if (!newPass || newPass.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long for security.' };
    }

    // Verify current credentials with server if online
    try {
      const verifyRes = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/login`, 5000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: globalUser, password: currentPass }),
      });
      const verifyData = await verifyRes.json().catch(() => null);
      if (verifyData && verifyData.error) {
        return { success: false, error: 'Current password is incorrect.' };
      }
    } catch {}

    try {
      let updatedOnServer = false;
      // 1. Try dedicated endpoint first if supported
      try {
        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/change-password`, 5000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: globalUser,
            currentPassword: currentPass,
            newPassword: newPass,
          }),
        });
        const resData = await res.json().catch(() => null);
        if (res.ok && (!resData || !resData.error)) {
          updatedOnServer = true;
        }
      } catch {}

      // 2. If dedicated endpoint not present, perform atomic recreate while preserving profile
      if (!updatedOnServer) {
        const profSnapshot = { ...userProfile };
        const isAdmin = Boolean(userProfile.isAdmin);

        // Delete user
        const delRes = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/delete-user`, 8000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: globalUser }),
        });
        const delData = await delRes.json().catch(() => null);
        if (!delRes.ok || (delData && delData.error)) {
          throw new Error(delData?.error || 'Failed to update credentials on server');
        }

        // Re-create user with new password
        const createRes = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/create-user`, 8000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: globalUser,
            password: newPass,
            isAdmin,
          }),
        });
        const createData = await createRes.json().catch(() => null);
        if (!createRes.ok || (createData && createData.error)) {
          throw new Error(createData?.error || 'Failed to set new password on server');
        }

        // Preserve admin role if applicable
        if (isAdmin) {
          await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/set-admin`, 8000, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: globalUser, isAdmin: true }),
          }).catch(() => {});
        }

        // Restore full profile data
        await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/save-profile`, 8000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...profSnapshot,
            username: globalUser,
          }),
        }).catch(() => {});

        updatedOnServer = true;
      }

      // Verify login with the new password
      try {
        const verifyNew = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/login`, 5000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: globalUser, password: newPass }),
        });
        const verifyNewData = await verifyNew.json().catch(() => null);
        if (!verifyNew.ok || (verifyNewData && verifyNewData.error)) {
          throw new Error(verifyNewData?.error || 'Verification with new password failed');
        }
      } catch (e: any) {
        if (e.message && !e.message.includes('fetch')) {
          return { success: false, error: e.message };
        }
      }

      // CRITICAL: Update global password state and website cache so user is NOT locked out
      setGlobalPass(newPass);
      try {
        localStorage.setItem('hub_active_pass', newPass);
      } catch {}

      cacheProfileLocally(globalUser, userProfile);
      showToast('Password updated and cached securely');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update password.' };
    }
  }, [globalUser, globalPass, userProfile, showToast]);

  const adminResetUserPassword = useCallback(async (targetUsername: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
    if (!targetUsername || !newPass) {
      return { success: false, error: 'Target username and new password are required.' };
    }
    if (newPass.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }
    try {
      let updatedOnServer = false;
      // 1. Try dedicated endpoints first if supported
      try {
        const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/admin-set-password`, 5000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: targetUsername,
            newPassword: newPass,
            password: newPass,
            adminUser: globalUser,
            adminPassword: globalPass || localStorage.getItem('hub_active_pass') || '',
          }),
        });
        const resData = await res.json().catch(() => null);
        if (res.ok && (!resData || !resData.error)) {
          updatedOnServer = true;
        }
      } catch {}

      if (!updatedOnServer) {
        try {
          const res = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/change-password`, 5000, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: targetUsername,
              newPassword: newPass,
              password: newPass,
              force: true,
            }),
          });
          const resData = await res.json().catch(() => null);
          if (res.ok && (!resData || !resData.error)) {
            updatedOnServer = true;
          }
        } catch {}
      }

      // 2. If endpoints not supported, atomic recreate with admin status and profile preservation
      if (!updatedOnServer) {
        let wasAdmin = false;
        try {
          const listRes = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/list-users`, 5000);
          const listData = await listRes.json().catch(() => null);
          const userEntry = listData?.users?.find(
            (u: any) => u.username.toLowerCase() === targetUsername.toLowerCase()
          );
          if (userEntry) wasAdmin = Boolean(userEntry.isAdmin);
        } catch {}

        const cachedTarget = restoreProfileFromCache(targetUsername);

        // Delete user
        const delRes = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/delete-user`, 8000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: targetUsername }),
        });
        const delData = await delRes.json().catch(() => null);
        if (!delRes.ok || (delData && delData.error)) {
          throw new Error(delData?.error || 'Failed to update user credentials on server');
        }

        // Re-create user with new password
        const createRes = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/create-user`, 8000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: targetUsername,
            password: newPass,
            isAdmin: wasAdmin,
          }),
        });
        const createData = await createRes.json().catch(() => null);
        if (!createRes.ok || (createData && createData.error)) {
          throw new Error(createData?.error || 'Failed to set user password on server');
        }

        // Restore admin role if applicable
        if (wasAdmin) {
          await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/set-admin`, 8000, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: targetUsername, isAdmin: true }),
          }).catch(() => {});
        }

        // Restore profile if cached
        if (cachedTarget) {
          await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/save-profile`, 8000, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...cachedTarget,
              username: targetUsername,
            }),
          }).catch(() => {});
        }

        updatedOnServer = true;
      }

      // Verify authentication with new password
      try {
        const verifyRes = await fetchWithTimeout(`${NEW_HUB_BACKEND}/api/login`, 5000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: targetUsername, password: newPass }),
        });
        const verifyData = await verifyRes.json().catch(() => null);
        if (!verifyRes.ok || (verifyData && verifyData.error)) {
          throw new Error(verifyData?.error || 'Authentication verification failed');
        }
      } catch (e: any) {
        if (e.message && !e.message.includes('fetch')) {
          return { success: false, error: e.message };
        }
      }

      // If updating the currently logged-in account
      if (globalUser && targetUsername.toLowerCase() === globalUser.toLowerCase()) {
        setGlobalPass(newPass);
        try {
          localStorage.setItem('hub_active_pass', newPass);
        } catch {}
      }

      showToast(`Password updated for "${targetUsername}"`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update user password.' };
    }
  }, [globalUser, globalPass, showToast]);

  // Music Taste Tuning
  const tuneMusicTaste = useCallback((track: Track, direction: 'more' | 'less') => {
    if (!track || !track.id) return;
    if (direction === 'more') {
      addExplicitInterested(track);
      showToast(`Added to your Music Taste — More like this`, true);
    } else {
      addExplicitNotInterested(track);
      showToast(`Marked as Not Interested — Less like this`, true);
      if (activeTrackRef.current?.id === track.id) {
        if (playNextRef.current) playNextRef.current();
      }
    }
    syncProfile();
  }, [showToast, syncProfile]);

  const removeTrackFromTaste = useCallback((trackId: string) => {
    if (!trackId) return;
    removeExplicitInterested(trackId);
    removeExplicitNotInterested(trackId);
    showToast(`Removed from Music Taste preferences`, true);
    syncProfile();
  }, [showToast, syncProfile]);

  const isTuneInterested = useCallback((trackId: string) => {
    return isExplicitInterested(trackId);
  }, []);

  const isTuneDisliked = useCallback((trackId: string) => {
    return isExplicitNotInterested(trackId);
  }, []);

  const getInterestedTracks = useCallback(() => {
    return getExplicitInterestedTracks();
  }, []);

  const getNotInterestedTracks = useCallback(() => {
    return getExplicitNotInterestedTracks();
  }, []);

  // Next Track Algorithmic Discovery with explicit taste prioritization
  const getNextAlgorithmTrack = async (seed: Track): Promise<Track | null> => {
    try {
      const res = await fetchWithTimeout(
        `${NEW_HUB_BACKEND}/api/similar-proxy?title=${encodeURIComponent(seed.title)}&artist=${encodeURIComponent(seed.artist)}`,
        5000
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.items || [];
        const candidates = list
          .map((it: any) => ({
            id: it.id || it.videoId,
            title: it.title || it.name,
            artist: it.artist || it.author || 'Various Artists',
            thumb: canonicalThumbUrl(it.id || it.videoId),
            type: 'song' as const,
          }))
          .filter((t: Track) => t.id && t.id !== seed.id && !isExplicitNotInterested(t.id));

        if (candidates.length > 0) {
          // Sort candidates: prioritize explicit interested songs & artists, avoid disliked
          const sorted = candidates.sort((a: Track, b: Track) => {
            const aScore = (isExplicitInterested(a.id) ? 15 : 0) + tasteArtistScore(a.artist);
            const bScore = (isExplicitInterested(b.id) ? 15 : 0) + tasteArtistScore(b.artist);
            return bScore - aScore;
          });
          return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
        }
      }
    } catch {}
    return null;
  };

  // Prefetch stream for next queued or algorithmic song
  const prefetchNextSong = async () => {
    if (!activeTrack) return;
    let nextTrack: Track | null = null;
    if (playbackQueue.length > 0 && queueIndex < playbackQueue.length - 1) {
      nextTrack = playbackQueue[queueIndex + 1];
    } else {
      nextTrack = await getNextAlgorithmTrack(activeTrack);
    }
    if (nextTrack) {
      const level = userProfile.dataSaverLevel || 'off';
      const q = level === 'ultra' ? '48' : level === 'saver' ? '96' : '320';
      prefetchTrackStream(nextTrack, q).catch(() => {});
    }
  };

  const tryPlayCandidates = async (candidates: string[], token: number, targetTrackId: string, idx = 0): Promise<boolean> => {
    if (idx >= candidates.length) return false;
    if (token !== playTokenRef.current) return false;
    const url = candidates[idx];
    const audio = audioRef.current;
    if (!audio) return false;

    return new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('loadeddata', onCanPlay);
        audio.removeEventListener('error', onError);
        clearTimeout(timer);
      };

      const finish = async (ok: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (token !== playTokenRef.current) {
          resolve(false);
          return;
        }
        if (ok) {
          if (targetTrackId) cacheStreamUrl(targetTrackId, url);
          resolve(true);
        } else {
          try {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
          } catch {}
          const nextOk = await tryPlayCandidates(candidates, token, targetTrackId, idx + 1);
          resolve(nextOk);
        }
      };

      const onPlaying = () => finish(true);
      const onCanPlay = () => finish(true);
      const onError = () => finish(false);
      // Give candidates ample time (9.5s on cold start, 6.5s for fallbacks) to avoid false negative "sources down"
      const timer = setTimeout(() => finish(false), idx === 0 ? 9500 : 6500);

      audio.addEventListener('playing', onPlaying, { once: true });
      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('loadeddata', onCanPlay, { once: true });
      audio.addEventListener('error', onError, { once: true });

      try {
        audio.src = url;
        audio.load();
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Might be autoplay policy or transient network error, wait for listeners or timer
          });
        }
      } catch {
        finish(false);
      }
    });
  };

  const generateRadioQueue = async (seedTrack: Track) => {
    try {
      const candidates: Track[] = [];
      const seenIds = new Set<string>([seedTrack.id]);
      const artistCounts: Record<string, number> = {};

      const seedArtistKey = tasteArtistKey(seedTrack.artist);
      if (seedArtistKey) artistCounts[seedArtistKey] = 1;

      // Collect playlist / liked song IDs so we prioritize fresh & new songs over repeating existing ones
      const existingPlaylistSongIds = new Set<string>();
      (userProfile.likedSongs || []).forEach((s) => s.id && existingPlaylistSongIds.add(s.id));
      (userProfile.customPlaylists || []).forEach((pl) => {
        (pl.tracks || []).forEach((s) => s.id && existingPlaylistSongIds.add(s.id));
      });

      let existingPlaylistTracksAdded = 0;

      // 1. Fetch direct authentic related tracks for seedTrack (Invidious / YouTube radio algorithm)
      try {
        const related = await getRelatedTracks(seedTrack.id);
        for (const it of related) {
          if (!it.id || seenIds.has(it.id)) continue;
          if (existingPlaylistSongIds.has(it.id)) {
            if (existingPlaylistTracksAdded >= 1) continue;
            existingPlaylistTracksAdded++;
          }
          const aKey = tasteArtistKey(it.artist);
          if (aKey && (artistCounts[aKey] || 0) >= 2) continue;
          seenIds.add(it.id);
          if (aKey) artistCounts[aKey] = (artistCounts[aKey] || 0) + 1;
          candidates.push(it);
        }
      } catch {}

      // 2. Fetch acoustic & thematic recommendations via similar-proxy
      try {
        const simRes = await fetchWithTimeout(
          `${NEW_HUB_BACKEND}/api/similar-proxy?title=${encodeURIComponent(seedTrack.title)}&artist=${encodeURIComponent(seedTrack.artist || '')}`,
          4500
        );
        if (simRes.ok) {
          const simData = await simRes.json();
          const list = Array.isArray(simData) ? simData : simData.items || [];
          for (const it of list) {
            const id = it.id || it.videoId;
            if (!id || seenIds.has(id)) continue;
            if (existingPlaylistSongIds.has(id)) {
              if (existingPlaylistTracksAdded >= 2) continue;
              existingPlaylistTracksAdded++;
            }
            const norm = normalizeTrack(it, 'song');
            const aKey = tasteArtistKey(norm.artist);
            if (aKey && (artistCounts[aKey] || 0) >= 2) continue;
            seenIds.add(id);
            if (aKey) artistCounts[aKey] = (artistCounts[aKey] || 0) + 1;
            candidates.push(norm);
          }
        }
      } catch {}

      // 3. Blend in fresh taste profile recommendations based on user history and overall musical vibe
      try {
        const tasteRecs = await getTasteProfileRecommendations(userProfile, seenIds, 12);
        for (const tRec of tasteRecs) {
          if (candidates.length >= 22) break;
          if (!tRec.id || seenIds.has(tRec.id)) continue;
          if (existingPlaylistSongIds.has(tRec.id)) {
            if (existingPlaylistTracksAdded >= 2) continue;
            existingPlaylistTracksAdded++;
          }
          const aKey = tasteArtistKey(tRec.artist);
          if (aKey && (artistCounts[aKey] || 0) >= 2) continue;
          seenIds.add(tRec.id);
          if (aKey) artistCounts[aKey] = (artistCounts[aKey] || 0) + 1;
          candidates.push(tRec);
        }
      } catch {}

      // 4. Fallback / supplement with radio mix search if fewer than 10 tracks
      if (candidates.length < 10) {
        const cleanTitle = cleanTitleForLyrics(seedTrack.title) || seedTrack.title;
        const query = cleanTitle ? `${cleanTitle} radio mix` : `${seedTrack.artist || 'popular'} mix`;
        const res = await fetchJsonRetry<any>(
          `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(query)}&f=song`,
          2
        ).catch(() => ({ items: [] }));
        const items = Array.isArray(res) ? res : res.items || [];
        for (const it of items) {
          const id = it.videoId || it.id;
          if (!id || seenIds.has(id)) continue;
          if (existingPlaylistSongIds.has(id)) {
            if (existingPlaylistTracksAdded >= 2) continue;
            existingPlaylistTracksAdded++;
          }
          const norm = normalizeTrack(it, 'song');
          const aKey = tasteArtistKey(norm.artist);
          if (aKey && (artistCounts[aKey] || 0) >= 2) continue;
          seenIds.add(id);
          if (aKey) artistCounts[aKey] = (artistCounts[aKey] || 0) + 1;
          candidates.push(norm);
          if (candidates.length >= 25) break;
        }
      }

      if (candidates.length > 0) {
        // Keep top 2 most immediate related tracks in front, then randomly interleave the remaining recommendations
        const head = candidates.slice(0, 2);
        const tail = candidates.slice(2);
        // Fisher-Yates gentle shuffle of tail to provide an organic, dynamic radio queue
        for (let i = tail.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tail[i], tail[j]] = [tail[j], tail[i]];
        }
        const finalQueue = [...head, ...tail].slice(0, 25);

        setPlaybackQueue((current) => {
          if (current.length <= 1) {
            return [seedTrack, ...finalQueue];
          }
          return current;
        });
      }
    } catch {}
  };

  const lastStatsSyncTimeRef = useRef(0);
  const listeningSecondsAccumRef = useRef(0);

  const recordListeningMinute = useCallback((mins = 1) => {
    const track = activeTrackRef.current;
    if (!track || !track.id) return;

    setUserProfile((prev) => {
      const stats = prev.stats || {
        totalMinutesListened: 0,
        totalTracksPlayed: 0,
        topSongs: [],
        topArtists: [],
      };

      const hiddenSongIds = new Set((prev.hiddenStatsSongs || []).map((s) => s.id));

      // 1. Update top songs (only for visible, non-hidden songs)
      const topSongs = [...(stats.topSongs || [])].filter((s) => !hiddenSongIds.has(s.id));
      if (!hiddenSongIds.has(track.id)) {
        const songIdx = topSongs.findIndex((s) => s.id === track.id);
        if (songIdx >= 0) {
          topSongs[songIdx] = {
            ...topSongs[songIdx],
            minutesListened: (topSongs[songIdx].minutesListened || 0) + mins,
            lastPlayed: Date.now(),
          };
        } else {
          topSongs.push({
            id: track.id,
            title: track.title,
            artist: track.artist,
            thumb: track.thumb,
            playCount: 1,
            minutesListened: mins,
            lastPlayed: Date.now(),
          });
        }
        topSongs.sort((a, b) => ((b.minutesListened || 0) * 3 + (b.playCount || 0) * 2) - ((a.minutesListened || 0) * 3 + (a.playCount || 0) * 2));
      }

      // 2. Derive top artists strictly from visible (non-hidden) songs so hidden songs never skew top artist
      const artistMap = new Map<string, ArtistPlayStat>();
      topSongs.forEach((s) => {
        const art = (s.artist || 'Unknown').trim();
        if (!art || art.toLowerCase() === 'various artists') return;
        const key = art.toLowerCase();
        const ex = artistMap.get(key);
        if (ex) {
          ex.playCount = (ex.playCount || 0) + (s.playCount || 1);
          ex.minutesListened = (ex.minutesListened || 0) + (s.minutesListened || 0);
          if (!ex.thumb && s.thumb) ex.thumb = s.thumb;
        } else {
          artistMap.set(key, {
            name: art,
            playCount: s.playCount || 1,
            minutesListened: s.minutesListened || 0,
            thumb: s.thumb,
          });
        }
      });
      const topArtists = Array.from(artistMap.values()).sort(
        (a, b) => ((b.minutesListened || 0) * 3 + (b.playCount || 0) * 2) - ((a.minutesListened || 0) * 3 + (a.playCount || 0) * 2)
      );

      const updatedStats = {
        totalMinutesListened: (stats.totalMinutesListened || 0) + mins,
        totalTracksPlayed: stats.totalTracksPlayed || 0,
        topSongs: topSongs.slice(0, 30),
        topArtists: topArtists.slice(0, 20),
        lastUpdated: Date.now(),
      };

      const updatedProf = { ...prev, stats: updatedStats };
      saveDeviceSettings(updatedProf);

      // Save locally immediately; batch sync periodically without hammering server on each track click
      if (globalUser && globalUser !== 'admin') {
        cacheProfileLocally(globalUser, updatedProf);
        pendingSyncProfRef.current = updatedProf;
        isSyncDirtyRef.current = true;
      }
      return updatedProf;
    });
  }, [globalUser]);

  const recordPlaybackSync = useCallback((track: Track) => {
    if (!track || !track.id) return;
    rememberListen(track);
    resumeAudioContext();

    setUserProfile((prev) => {
      const prevRecent = prev.recentlyPlayed || [];
      const matchIdx = prevRecent.findIndex((t) => t.id === track.id);

      let mergedThumb = (track.thumb && !track.thumb.startsWith('blob:') && track.thumb.trim().length > 5 && track.thumb !== FALLBACK_ART)
        ? track.thumb
        : null;

      if (!mergedThumb && matchIdx >= 0 && prevRecent[matchIdx]?.thumb && !prevRecent[matchIdx].thumb.startsWith('blob:') && prevRecent[matchIdx].thumb !== FALLBACK_ART) {
        mergedThumb = prevRecent[matchIdx].thumb;
      }
      if (!mergedThumb) {
        mergedThumb = getStoredCoverForTrack(track.id);
      }
      if (!mergedThumb && track.id.length === 11) {
        mergedThumb = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
      }
      if (!mergedThumb) {
        mergedThumb = canonicalThumbUrl(track.id);
      }

      const mergedTrack = { ...track, thumb: mergedThumb };
      const updated = [mergedTrack, ...prevRecent.filter((t) => t.id !== track.id)].slice(0, 30);

      const stats = prev.stats || {
        totalMinutesListened: 0,
        totalTracksPlayed: 0,
        topSongs: [],
        topArtists: [],
      };

      const hiddenSongIds = new Set((prev.hiddenStatsSongs || []).map((s) => s.id));
      const topSongs = [...(stats.topSongs || [])].filter((s) => !hiddenSongIds.has(s.id));

      if (!hiddenSongIds.has(track.id)) {
        const songIdx = topSongs.findIndex((s) => s.id === track.id);
        if (songIdx >= 0) {
          topSongs[songIdx] = {
            ...topSongs[songIdx],
            playCount: (topSongs[songIdx].playCount || 0) + 1,
            lastPlayed: Date.now(),
          };
        } else {
          topSongs.push({
            id: track.id,
            title: track.title,
            artist: track.artist,
            thumb: mergedThumb,
            playCount: 1,
            minutesListened: 1,
            lastPlayed: Date.now(),
          });
        }
        topSongs.sort((a, b) => ((b.playCount || 0) * 3 + (b.minutesListened || 0)) - ((a.playCount || 0) * 3 + (a.minutesListened || 0)));
      }

      const updatedStats = {
        ...stats,
        totalTracksPlayed: (stats.totalTracksPlayed || 0) + 1,
        topSongs: topSongs.slice(0, 30),
      };

      const updatedProf = { ...prev, recentlyPlayed: updated, stats: updatedStats };
      saveDeviceSettings(updatedProf);

      // Keep last played track synchronized in storage with recentlyPlayed
      try {
        localStorage.setItem('mouzika_last_played_track', JSON.stringify(mergedTrack));
      } catch {}

      // Keep activeTrack synchronized with the verified merged cover
      setActiveTrack((current) => {
        if (current && current.id === track.id) {
          return { ...current, thumb: mergedThumb };
        }
        return current;
      });

      // Save locally immediately; batch sync periodically without hammering server on each track click
      if (globalUser && globalUser !== 'admin') {
        cacheProfileLocally(globalUser, updatedProf);
        pendingSyncProfRef.current = updatedProf;
        isSyncDirtyRef.current = true;
      }
      return updatedProf;
    });
  }, [globalUser]);

  // Primary playback execution
  const playTrack = async (track: Track, fromQueue = false): Promise<boolean> => {
    if (!track || !track.id) return false;
    const audio = audioRef.current;
    if (!audio) return false;

    // Immediately stop and reset previous audio to prevent playing wrong song
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch {}

    hasPrefetchedNextRef.current = false;
    const token = ++playTokenRef.current;

    // When playing directly from outside queue (search or home), create autoplay queue
    if (!fromQueue) {
      setPlaybackQueue([track]);
      setQueueIndex(0);
      generateRadioQueue(track);
    }

    // Push to history
    if (activeTrack && activeTrack.id !== track.id) {
      playedHistoryRef.current.push(activeTrack);
      if (playedHistoryRef.current.length > 50) playedHistoryRef.current.shift();
    }

    // Ensure we never store a dead blob URL into persistent storage and recover best available cover
    const safeInitialThumb = (track.thumb && !track.thumb.startsWith('blob:') && track.thumb.trim().length > 5 && track.thumb !== FALLBACK_ART)
      ? track.thumb
      : (userProfile.recentlyPlayed?.find((t) => t.id === track.id)?.thumb ||
         userProfile.likedSongs?.find((t) => t.id === track.id)?.thumb ||
         getStoredCoverForTrack(track.id) ||
         (track.id.length === 11 ? `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` : canonicalThumbUrl(track.id)));
    const persistentInitialTrack = { ...track, thumb: safeInitialThumb };

    setActiveTrack(persistentInitialTrack);
    setIsMiniPlayerDismissed(false);
    try {
      localStorage.setItem('mouzika_last_played_track', JSON.stringify(persistentInitialTrack));
    } catch {}
    setIsBuffering(true);
    setCurrentTime(0);

    // Lyrics Resolver with Instant Offline Cache Fallback
    const resolveTrackLyrics = async (targetTrack: Track, targetDuration?: number): Promise<LyricsData> => {
      if (!targetTrack || !targetTrack.id) return { mode: 'none' };
      
      // 1. Check if stored in offline downloads first (instant offline availability)
      try {
        const offlineLyrics = await getDownloadedLyrics(targetTrack.id);
        if (offlineLyrics && (offlineLyrics.mode === 'synced' || offlineLyrics.mode === 'plain')) {
          return offlineLyrics;
        }
      } catch {}

      // 2. Online fetch if network is available
      try {
        const fetched = await fetchLyricsForTrack(targetTrack, targetDuration);
        if (fetched && (fetched.mode === 'synced' || fetched.mode === 'plain')) {
          // If the track is downloaded, persist these fetched lyrics to IndexedDB
          if (isDownloaded(targetTrack.id)) {
            saveDownloadLyrics(targetTrack.id, fetched).catch(() => {});
          }
          return fetched;
        }
      } catch {}

      // 3. Fallback to offline download record if network query failed
      try {
        const offlineLyrics = await getDownloadedLyrics(targetTrack.id);
        if (offlineLyrics && offlineLyrics.mode && offlineLyrics.mode !== 'none') {
          return offlineLyrics;
        }
      } catch {}

      return { mode: 'none' };
    };

    // Reset lyrics and resolve with offline priority
    setCurrentLyrics({ mode: 'loading' });
    resolveTrackLyrics(track, track.duration).then((l) => {
      if (token === playTokenRef.current) {
        setCurrentLyrics(l);
      }
    });

    // Revoke previous blob URL
    if (activeBlobUrlRef.current) {
      try { URL.revokeObjectURL(activeBlobUrlRef.current); } catch {}
      activeBlobUrlRef.current = null;
    }

    // 1. Offline playback if downloaded
    if (isDownloaded(track.id)) {
      try {
        const record = await getDownload(track.id);
        if (record?.audioBlob) {
          const blobUrl = URL.createObjectURL(record.audioBlob);
          activeBlobUrlRef.current = blobUrl;
          if (token !== playTokenRef.current) return false;
          audio.src = blobUrl;
          audio.play().catch(() => {});

          let activeThumb = safeInitialThumb;
          if (record.thumbLowRes) {
            try {
              activeThumb = URL.createObjectURL(record.thumbLowRes);
            } catch {}
          }
          // Note: Keep track.thumb persistent (do not store blob: URL in profile/recentlyPlayed)
          const playingTrack = { ...track, thumb: activeThumb };
          const persistentTrack = { ...track, thumb: safeInitialThumb };
          setActiveTrack(playingTrack);
          recordPlaybackSync(persistentTrack);
          updateMediaSession(playingTrack);
          try {
            localStorage.setItem('mouzika_last_played_track', JSON.stringify(persistentTrack));
          } catch {}
          return true;
        }
      } catch {}
    }

    // 2. Memory cached stream URL check
    const cachedUrl = getCachedStreamUrl(track.id);
    if (cachedUrl) {
      if (token !== playTokenRef.current) return false;
      audio.src = cachedUrl;
      audio.play().catch(() => {});
      recordPlaybackSync(persistentInitialTrack);
      updateMediaSession(persistentInitialTrack);
      return true;
    }

    // 3. Fast Parallel Resolving with Startup Race Protection & Low-Network Notification
    const level = userProfile.dataSaverLevel || 'off';
    const quality = level === 'ultra' ? '48' : level === 'saver' ? '96' : '320';
    const cleanedArtist = cleanArtistName(track.artist);
    let resolvedTrack = { ...track, thumb: safeInitialThumb };

    // Gentle loading feedback if page or network is slow/loading
    const slowNoticeTimer = setTimeout(() => {
      if (token === playTokenRef.current && audioRef.current?.paused) {
        showToast(t('player.connecting', 'Connecting to audio stream... Please wait'), true);
      }
    }, 1400);

    // If track has an imported ID (like Spotify "sp_...") or is still resolving metadata, resolve properly
    if (!resolvedTrack.id || resolvedTrack.title === 'Loading...' || resolvedTrack.id.startsWith('sp_') || resolvedTrack.id.length !== 11) {
      try {
        const queryTerm = `${resolvedTrack.title !== 'Loading...' ? resolvedTrack.title : ''} ${cleanedArtist}`.trim();
        if (queryTerm) {
          const found = await searchTracks(queryTerm, 'song');
          if (found.length > 0 && found[0].id) {
            resolvedTrack.id = found[0].id;
            if (!resolvedTrack.thumb || resolvedTrack.thumb === FALLBACK_ART) resolvedTrack.thumb = found[0].thumb || safeInitialThumb;
            if (resolvedTrack.title === 'Loading...') resolvedTrack.title = found[0].title;
          }
        }
      } catch {}
    }

    const candidates: string[] = [];

    // Parallel Stream Resolution across Worker Proxy, JioSaavn and Global Invidious/Piped Mirrors
    const [workerUrl, saavnUrl, mirrors] = await Promise.all([
      resolveWorkerStream(resolvedTrack.id).catch(() => null),
      resolveSaavnStream(
        cleanTitleForLyrics(resolvedTrack.title) || resolvedTrack.title,
        cleanedArtist,
        quality,
        resolvedTrack.title,
        resolvedTrack.artist
      ).catch(() => null),
      resolveMirrorStreams(resolvedTrack.id).catch(() => []),
    ]);

    if (workerUrl) candidates.push(workerUrl);
    if (saavnUrl) candidates.push(saavnUrl);
    if (mirrors && mirrors.length > 0) candidates.push(...mirrors);

    if (token !== playTokenRef.current) {
      clearTimeout(slowNoticeTimer);
      return false;
    }

    // Startup Race Condition Deferral: fallback search if no candidates were found
    if (candidates.length === 0) {
      try {
        const fallbackSearch = await searchTracks(`${resolvedTrack.title} ${cleanedArtist}`, 'song').catch(() => []);
        if (fallbackSearch.length > 0 && fallbackSearch[0].id) {
          const fbTrack = fallbackSearch[0];
          const [altWorker, altSaavn, altMirrors] = await Promise.all([
            resolveWorkerStream(fbTrack.id).catch(() => null),
            resolveSaavnStream(
              cleanTitleForLyrics(fbTrack.title) || fbTrack.title,
              cleanArtistName(fbTrack.artist),
              quality,
              fbTrack.title,
              fbTrack.artist
            ).catch(() => null),
            resolveMirrorStreams(fbTrack.id).catch(() => []),
          ]);
          if (altWorker) candidates.push(altWorker);
          if (altSaavn) candidates.push(altSaavn);
          if (altMirrors && altMirrors.length > 0) candidates.push(...altMirrors);
        }
      } catch {}
    }

    if (candidates.length === 0) {
      clearTimeout(slowNoticeTimer);
      if (token === playTokenRef.current) {
        setIsBuffering(false);
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch {}
        showToast('Sources are resolving. Please wait a moment or tap track again.', true);
      }
      return false;
    }

    // Play first working candidate
    let ok = await tryPlayCandidates(candidates, token, resolvedTrack.id, 0);
    
    // Auto-retry once with refreshed mirror list if first cycle had a network warmup hiccup
    if (!ok && token === playTokenRef.current) {
      try {
        const freshMirrors = await resolveMirrorStreams(resolvedTrack.id).catch(() => []);
        if (freshMirrors.length > 0) {
          ok = await tryPlayCandidates(freshMirrors, token, resolvedTrack.id, 0);
        }
      } catch {}
    }

    clearTimeout(slowNoticeTimer);
    if (token !== playTokenRef.current) return false;

    if (ok) {
      setActiveTrack(resolvedTrack);
      recordPlaybackSync(resolvedTrack);
      updateMediaSession(resolvedTrack);
      try {
        localStorage.setItem('mouzika_last_played_track', JSON.stringify(resolvedTrack));
      } catch {}
      // Auto cache if enabled
      if (userProfile.autoCachePlayed && !isDownloaded(resolvedTrack.id)) {
        setTimeout(() => {
          downloadTrack(resolvedTrack, true, true).catch(() => {});
        }, 3000);
      }
      return true;
    } else {
      setIsBuffering(false);
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch {}
      showToast('Playback connection issue. Tap track to retry.', true);
      return false;
    }
  };

  useEffect(() => {
    playTrackRef.current = playTrack;
  });

  const updateMediaSession = (t: Track) => {
    if (!('mediaSession' in navigator)) return;

    let artUrl = t.thumb || FALLBACK_ART;
    // Upgrade JioSaavn thumbnails to 500x500 square HD
    if (artUrl.includes('150x150.jpg')) {
      artUrl = artUrl.replace('150x150.jpg', '500x500.jpg');
    } else if (artUrl.includes('50x50.jpg')) {
      artUrl = artUrl.replace('50x50.jpg', '500x500.jpg');
    } else if (!artUrl.startsWith('blob:') && !artUrl.startsWith('data:')) {
      // Crop to perfect 512x512 square so Samsung/Android/iOS lock screen displays crisp full square artwork
      try {
        if (artUrl.includes('wsrv.nl/?url=')) {
          const parsed = new URL(artUrl);
          parsed.searchParams.set('w', '512');
          parsed.searchParams.set('h', '512');
          parsed.searchParams.set('fit', 'cover');
          artUrl = parsed.toString();
        } else {
          artUrl = `https://wsrv.nl/?url=${encodeURIComponent(artUrl)}&w=512&h=512&fit=cover`;
        }
      } catch {}
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: t.album || 'MOUZIKETNA',
        artwork: [
          { src: artUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: artUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: artUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
      navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) seekTo(details.seekTime);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        seekBy(-(details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        seekBy(details.seekOffset || 10);
      });
    } catch {}
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      resumeAudioContext();
      if (audio.error || !audio.src || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        if (activeTrack) {
          const resumePos = currentTime;
          playTrack(activeTrack, true).then((ok) => {
            if (ok && resumePos > 0 && audioRef.current) {
              audioRef.current.currentTime = resumePos;
            }
          });
          return;
        }
      }
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (activeTrack) {
            const resumePos = currentTime;
            playTrack(activeTrack, true).then((ok) => {
              if (ok && resumePos > 0 && audioRef.current) {
                audioRef.current.currentTime = resumePos;
              }
            });
          }
        });
      }
    } else {
      audio.pause();
    }
  };

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
    const targetTime = Math.max(0, Math.min(audio.duration, time));

    // Cancel any previous seek timer
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
      seekDebounceTimerRef.current = null;
    }

    isSeekingRef.current = true;
    lastSeekTimestampRef.current = Date.now();

    // Immediately synchronize UI scrub position for zero perceived latency
    setCurrentTime(targetTime);
    setIsBuffering(false);
    try {
      localStorage.setItem('mouzika_last_played_pos', String(Math.floor(targetTime)));
    } catch {}

    if (Math.abs(audio.currentTime - targetTime) < 0.05) {
      isSeekingRef.current = false;
      return;
    }

    // Set currentTime directly for exact target point precision
    try {
      if ('fastSeek' in audio && typeof (audio as any).fastSeek === 'function') {
        (audio as any).fastSeek(targetTime);
      } else {
        audio.currentTime = targetTime;
      }
    } catch (err) {
      try {
        audio.currentTime = targetTime;
      } catch (e) {
        console.warn('Direct currentTime seek error:', e);
      }
    }

    // Keep isSeekingRef true for a safety window so transient aborted socket errors from previous range requests are suppressed
    seekDebounceTimerRef.current = window.setTimeout(() => {
      isSeekingRef.current = false;
      setIsBuffering(false);
    }, 1200);
  };

  const seekBy = (delta: number) => {
    const audio = audioRef.current;
    if (audio) {
      seekTo(audio.currentTime + delta);
    }
  };

  const setVolumeLevel = (vol: number) => {
    const v = Math.max(0, Math.min(100, vol));
    setVolume(v);
    setIsMuted(v === 0);
    try {
      localStorage.setItem('hub_volume', String(v));
    } catch {}
    setBaseAudioVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v / 100;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolumeLevel(volume || 50);
    } else {
      setVolumeLevel(0);
    }
  };

  const toggleLoop = () => {
    setIsLooping((prev) => {
      const next = !prev;
      isLoopingRef.current = next;
      if (audioRef.current) audioRef.current.loop = next;
      return next;
    });
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => {
      const next = !prev;
      isShuffleRef.current = next;
      return next;
    });
  };

  const playNext = async () => {
    const queue = playbackQueueRef.current;
    const idx = queueIndexRef.current;
    const shuffle = isShuffleRef.current;
    const active = activeTrackRef.current;

    if (queue && queue.length > 0) {
      if (shuffle) {
        const nextIdx = Math.floor(Math.random() * queue.length);
        setQueueIndex(nextIdx);
        queueIndexRef.current = nextIdx;
        const ok = await playTrack(queue[nextIdx], true);
        if (!ok && queue.length > 1) {
          const fallbackIdx = (nextIdx + 1) % queue.length;
          setQueueIndex(fallbackIdx);
          queueIndexRef.current = fallbackIdx;
          await playTrack(queue[fallbackIdx], true);
        }
      } else if (idx >= 0 && idx < queue.length - 1) {
        const nextIdx = idx + 1;
        setQueueIndex(nextIdx);
        queueIndexRef.current = nextIdx;
        const ok = await playTrack(queue[nextIdx], true);
        if (!ok && nextIdx < queue.length - 1) {
          const nextNextIdx = nextIdx + 1;
          setQueueIndex(nextNextIdx);
          queueIndexRef.current = nextNextIdx;
          await playTrack(queue[nextNextIdx], true);
        }
      } else if (active) {
        // Queue ended or loop queue, let's discover next algorithm track
        const next = await getNextAlgorithmTrack(active);
        if (next) {
          const newQueue = [...queue, next];
          setPlaybackQueue(newQueue);
          playbackQueueRef.current = newQueue;
          const nextIdx = newQueue.length - 1;
          setQueueIndex(nextIdx);
          queueIndexRef.current = nextIdx;
          await playTrack(next, true);
        } else if (queue.length > 0) {
          // Loop back to start of playlist
          setQueueIndex(0);
          queueIndexRef.current = 0;
          await playTrack(queue[0], true);
        }
      }
    } else if (active) {
      const next = await getNextAlgorithmTrack(active);
      if (next) {
        setPlaybackQueue([next]);
        playbackQueueRef.current = [next];
        setQueueIndex(0);
        queueIndexRef.current = 0;
        await playTrack(next, true);
      }
    }
  };

  const playPrevious = async () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const queue = playbackQueueRef.current;
    const idx = queueIndexRef.current;
    const shuffle = isShuffleRef.current;

    if (queue && queue.length > 0) {
      if (shuffle) {
        const prevIdx = Math.floor(Math.random() * queue.length);
        setQueueIndex(prevIdx);
        queueIndexRef.current = prevIdx;
        await playTrack(queue[prevIdx], true);
        return;
      } else if (idx > 0) {
        const prevIdx = idx - 1;
        setQueueIndex(prevIdx);
        queueIndexRef.current = prevIdx;
        await playTrack(queue[prevIdx], true);
        return;
      }
    }

    if (playedHistoryRef.current.length > 0) {
      const prev = playedHistoryRef.current.pop();
      if (prev) {
        await playTrack(prev);
        return;
      }
    }

    if (audio) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
  };

  useEffect(() => {
    playbackQueueRef.current = playbackQueue;
  }, [playbackQueue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  useEffect(() => {
    activeTrackRef.current = activeTrack;
  }, [activeTrack]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    playNextRef.current = playNext;
    playPreviousRef.current = playPrevious;
  });

  const addToQueue = (track: Track, playNext = false) => {
    setPlaybackQueue((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      if (playNext) {
        const insertAt = queueIndex >= 0 ? queueIndex + 1 : 0;
        const copy = [...filtered];
        copy.splice(insertAt, 0, track);
        playbackQueueRef.current = copy;
        return copy;
      }
      const copy = [...filtered, track];
      playbackQueueRef.current = copy;
      return copy;
    });
  };

  const removeFromQueue = (idx: number) => {
    setPlaybackQueue((prev) => {
      const copy = prev.filter((_, i) => i !== idx);
      playbackQueueRef.current = copy;
      return copy;
    });
    if (idx < queueIndex) {
      setQueueIndex((q) => {
        const next = q - 1;
        queueIndexRef.current = next;
        return next;
      });
    }
  };

  const clearQueue = () => {
    setPlaybackQueue([]);
    playbackQueueRef.current = [];
    setQueueIndex(-1);
    queueIndexRef.current = -1;
  };

  const playQueueIndex = (idx: number) => {
    if (idx >= 0 && idx < playbackQueue.length) {
      setQueueIndex(idx);
      queueIndexRef.current = idx;
      playTrack(playbackQueue[idx], true);
    }
  };

  const playWholeCollection = (tracks: Track[]) => {
    if (!tracks.length) return;
    setPlaybackQueue(tracks);
    playbackQueueRef.current = tracks;
    setQueueIndex(0);
    queueIndexRef.current = 0;
    playTrack(tracks[0], true);
  };

  const playShuffledCollection = (tracks: Track[]) => {
    if (!tracks.length) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setPlaybackQueue(shuffled);
    playbackQueueRef.current = shuffled;
    setQueueIndex(0);
    queueIndexRef.current = 0;
    setIsShuffle(true);
    isShuffleRef.current = true;
    playTrack(shuffled[0], true);
  };

  const playCollectionFromIndex = (tracks: Track[], index: number) => {
    if (!tracks.length) return;
    const clampedIndex = Math.max(0, Math.min(index, tracks.length - 1));
    setPlaybackQueue(tracks);
    playbackQueueRef.current = tracks;
    setQueueIndex(clampedIndex);
    queueIndexRef.current = clampedIndex;
    playTrack(tracks[clampedIndex], true);
  };

  // Downloads Engine
  const downloadTrack = async (
    track: Track,
    silent = false,
    isAutoCache = false
  ): Promise<boolean> => {
    if (!track?.id) return false;

    // Calculate quality target
    let quality: '320' | '160' | '96' | '48' = '160';
    if (isAutoCache) {
      const ac = userProfile.autoCacheQuality || 'stable';
      quality = ac === 'high' ? '320' : ac === 'ultra' ? '48' : ac === 'saver' ? '96' : '160';
    } else {
      const dq =
        userProfile.downloadQuality ||
        (userProfile.dataSaverLevel === 'ultra'
          ? 'ultra'
          : userProfile.dataSaverLevel === 'saver'
          ? 'saver'
          : 'stable');
      quality = dq === 'high' ? '320' : dq === 'ultra' ? '48' : dq === 'saver' ? '96' : '160';
    }

    const currentQuality = getDownloadQuality(track.id);

    if (isDownloaded(track.id)) {
      // Check if user is manually upgrading a saver quality track to high quality
      if (!isAutoCache && (currentQuality === '96' || currentQuality === '48') && quality === '320') {
        if (!silent) showToast(`Upgrading "${track.title}" to High Quality (320 kbps)…`);
      } else {
        if (!silent) {
          const isHigh = currentQuality === '320' || currentQuality === 'high';
          showToast(`Already downloaded (${isHigh ? 'High Quality' : 'Saver Quality'})`);
        }
        return true;
      }
    } else {
      if (!silent) showToast(`Downloading "${track.title}"…`);
    }

    ensurePersistentStorageOnce();
    const cleanedArtist = cleanArtistName(track.artist);

    // Resolve real YouTube ID if track has external/Spotify ID
    let ytTrackId = track.id;
    if (!ytTrackId || ytTrackId.startsWith('sp_') || ytTrackId.length !== 11) {
      try {
        const found = await searchTracks(`${track.title} ${cleanedArtist}`, 'song');
        if (found.length > 0 && found[0].id) {
          ytTrackId = found[0].id;
          if (!track.thumb) track.thumb = found[0].thumb;
        }
      } catch {}
    }

    try {
      const candidates: string[] = [];

      // 1. Cached in-memory stream if available
      const cached = getCachedStreamUrl(track.id);
      if (cached) candidates.push(cached);

      // 2. Parallel stream resolution for maximum speed (Saavn + Mirrors + Worker proxy)
      const [saavnRes, mirrorRes, workerRes] = await Promise.allSettled([
        resolveSaavnStream(
          cleanTitleForLyrics(track.title) || track.title,
          cleanedArtist,
          quality,
          track.title,
          track.artist
        ),
        resolveMirrorStreams(ytTrackId || track.id),
        fetchWithTimeout(`${NEW_HUB_BACKEND}/api/stream-proxy/${ytTrackId || track.id}`, 6000).then(async (r) => {
          if (!r.ok) return null;
          const j = await r.json();
          const audio = (j?.adaptiveFormats || []).filter((f: any) => f.type && f.type.startsWith('audio'));
          if (audio.length) {
            audio.sort((a: any, b: any) => parseInt(b.bitrate) - parseInt(a.bitrate));
            return audio[0].url;
          }
          return null;
        }),
      ]);

      if (saavnRes.status === 'fulfilled' && saavnRes.value && !candidates.includes(saavnRes.value)) {
        candidates.push(saavnRes.value);
      }
      if (workerRes.status === 'fulfilled' && workerRes.value && !candidates.includes(workerRes.value)) {
        candidates.push(workerRes.value);
      }
      if (mirrorRes.status === 'fulfilled' && Array.isArray(mirrorRes.value)) {
        for (const m of mirrorRes.value) {
          if (m && !candidates.includes(m)) {
            candidates.push(m);
          }
        }
      }

      if (candidates.length === 0) throw new Error('No stream source available');

      // Attempt to download audio from candidate sources with fast timeout
      let audioBlob: Blob | null = null;
      for (const url of candidates) {
        try {
          const res = await fetchWithTimeout(url, 12000);
          if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 2000) {
              audioBlob = blob;
              break;
            }
          }
        } catch {}
      }

      if (!audioBlob) throw new Error('Failed to download audio content');

      // Parallel fetch for offline artwork and lyrics (non-blocking)
      const [artResult, lyricsResult] = await Promise.allSettled([
        userProfile.downloadArtOffline !== false
          ? fetchArtworkBlob(ytTrackId || track.id, track.thumb, userProfile.artQualityOffline || 'low')
          : Promise.resolve(null),
        userProfile.downloadLyricsOffline !== false
          ? fetchLyricsForTrack(track)
          : Promise.resolve(null),
      ]);

      const thumbBlob = artResult.status === 'fulfilled' ? artResult.value : null;
      const lyricsData = lyricsResult.status === 'fulfilled' ? lyricsResult.value : null;

      const record: DownloadRecord = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        thumbLowRes: thumbBlob,
        audioBlob,
        quality,
        lyricsData,
        sizeBytes: (audioBlob.size || 0) + (thumbBlob?.size || 0),
        downloadedAt: Date.now(),
      };

      await saveDownload(record);
      setDownloadedSet((prev) => new Set([...prev, track.id]));
      if (!silent) {
        showToast(
          quality === '320'
            ? `Downloaded "${track.title}" (320 kbps)`
            : `Downloaded "${track.title}" (Saver Quality)`
        );
      }
      return true;
    } catch {
      if (!silent) showToast(`Couldn't download "${track.title}"`, true);
      return false;
    }
  };

  const removeDownload = async (trackId: string) => {
    await deleteDownload(trackId);
    setDownloadedSet((prev) => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
    showToast('Download removed', true);
  };

  const removeMultipleDownloads = async (trackIds: string[]) => {
    for (const id of trackIds) {
      await deleteDownload(id);
    }
    setDownloadedSet((prev) => {
      const next = new Set(prev);
      trackIds.forEach((id) => next.delete(id));
      return next;
    });
    showToast(`Removed ${trackIds.length} downloads`, true);
  };

  const clearAllDownloads = async () => {
    await deleteAllDownloads();
    setDownloadedSet(new Set());
  };

  // Concurrent Multi-Song Download Queue (3 concurrent workers)
  const downloadPlaylist = async (tracks: Track[]) => {
    const unDownloaded = tracks.filter((t) => !isDownloaded(t.id));
    if (!unDownloaded.length) {
      showToast('All tracks are already downloaded');
      return;
    }

    const total = unDownloaded.length;
    setBulkDownloadState({ done: 0, total, inProgress: true });

    let successCount = 0;
    let failCount = 0;
    let finishedCount = 0;

    const concurrency = Math.min(3, total);
    let queueIdx = 0;

    const worker = async () => {
      while (queueIdx < total) {
        const itemIdx = queueIdx++;
        const trackToDownload = unDownloaded[itemIdx];
        if (!trackToDownload) break;

        try {
          const ok = await downloadTrack(trackToDownload, true);
          if (ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        } finally {
          finishedCount++;
          setBulkDownloadState({
            done: finishedCount,
            total,
            inProgress: true,
          });
        }
      }
    };

    // Run 3 workers in parallel
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    setBulkDownloadState({ done: total, total, inProgress: false });

    if (failCount === 0) {
      showToast(`Downloaded all ${successCount} songs for offline listening`);
    } else if (successCount > 0) {
      showToast(`Downloaded ${successCount} songs (${failCount} unavailable on servers)`);
    } else {
      showToast(`Unable to download tracks. Please check connection.`, true);
    }
  };

  const retryLyrics = () => {
    if (activeTrack) {
      setCurrentLyrics({ mode: 'loading' });
      // Check offline store first, then LRCLIB
      getDownloadedLyrics(activeTrack.id).then((cached) => {
        if (cached && (cached.mode === 'synced' || cached.mode === 'plain')) {
          setCurrentLyrics(cached);
        } else {
          fetchLyricsForTrack(activeTrack, duration).then((fetched) => {
            setCurrentLyrics(fetched);
            if (isDownloaded(activeTrack.id) && fetched && (fetched.mode === 'synced' || fetched.mode === 'plain')) {
              saveDownloadLyrics(activeTrack.id, fetched).catch(() => {});
            }
          });
        }
      });
    }
  };

  // Sleep Timer
  const cancelSleepTimer = () => {
    if (sleepTimerIdRef.current) {
      clearInterval(sleepTimerIdRef.current);
      sleepTimerIdRef.current = null;
    }
    setSleepTimerRemaining(null);
    setSleepTimerIsEndOfSong(false);
    showToast('Sleep timer turned off', true);
  };

  const setSleepTimerMinutes = (mins: number) => {
    cancelSleepTimer();
    let leftSecs = mins * 60;
    setSleepTimerRemaining(leftSecs);
    showToast(`Sleep timer set to ${mins} minutes`);
    sleepTimerIdRef.current = setInterval(() => {
      leftSecs -= 1;
      if (leftSecs <= 0) {
        clearInterval(sleepTimerIdRef.current);
        sleepTimerIdRef.current = null;
        setSleepTimerRemaining(null);
        if (audioRef.current) audioRef.current.pause();
        showToast('Sleep timer ended', true);
      } else {
        setSleepTimerRemaining(leftSecs);
      }
    }, 1000);
  };

  const setSleepTimerEndOfSong = () => {
    cancelSleepTimer();
    setSleepTimerIsEndOfSong(true);
    showToast('Sleep timer: End of current song');
  };

  // Likes & Playlists
  const toggleLikeTrack = (track: Track) => {
    const isLiked = userProfile.likedSongs.some((s) => s.id === track.id);
    let updatedSongs: Track[] = [];
    if (isLiked) {
      updatedSongs = userProfile.likedSongs.filter((s) => s.id !== track.id);
      tasteEvent('unlike', track);
      showToast('Removed from Liked Songs', true);
    } else {
      updatedSongs = [track, ...userProfile.likedSongs];
      tasteEvent('like', track);
      showToast('Saved to Liked Songs');
    }
    syncProfile({ ...userProfile, likedSongs: updatedSongs });
  };

  const createPlaylist = (name: string, firstTrack?: Track) => {
    const pl: CustomPlaylist = {
      id: 'pl_' + Date.now(),
      name,
      tracks: firstTrack ? [firstTrack] : [],
      thumb: null,
      customCover: null,
    };
    syncProfile({ ...userProfile, customPlaylists: [pl, ...userProfile.customPlaylists] });
    showToast(`Created playlist "${name}"`);
  };

  const renamePlaylist = (plId: string, newName: string) => {
    const pl = userProfile.customPlaylists.find((p) => p.id === plId);
    if (!pl) return;
    const cleanName = newName.trim();
    if (!cleanName) return;
    const updated = { ...pl, name: cleanName };
    syncProfile({
      ...userProfile,
      customPlaylists: userProfile.customPlaylists.map((p) => (p.id === plId ? updated : p)),
    });
    if (collectionTarget?.id === plId) {
      setCollectionTarget({ ...collectionTarget, title: cleanName });
    }
    showToast(`Playlist renamed to "${cleanName}"`);
  };

  const deletePlaylist = (plId: string) => {
    syncProfile({
      ...userProfile,
      customPlaylists: userProfile.customPlaylists.filter((p) => p.id !== plId),
    });
    if (activePane === 'collection' && collectionTarget?.id === plId) {
      setActivePane('library');
    }
    showToast('Playlist deleted', true);
  };

  const removeTrackFromPlaylist = (plId: string, trackId: string) => {
    const pl = userProfile.customPlaylists.find((p) => p.id === plId);
    if (!pl) return;
    const updated = {
      ...pl,
      tracks: pl.tracks.filter((t) => t.id !== trackId),
    };
    syncProfile({
      ...userProfile,
      customPlaylists: userProfile.customPlaylists.map((p) => (p.id === plId ? updated : p)),
    });
    showToast('Removed from playlist', true);
  };

  const addTrackToPlaylist = (plId: string, track: Track) => {
    const pl = userProfile.customPlaylists.find((p) => p.id === plId);
    if (!pl) return;
    if (pl.tracks.some((t) => t.id === track.id)) {
      showToast('Already in that playlist', true);
      return;
    }
    const updated = {
      ...pl,
      tracks: [...pl.tracks, track],
      thumb: pl.customCover || pl.thumb || null,
    };
    syncProfile({
      ...userProfile,
      customPlaylists: userProfile.customPlaylists.map((p) => (p.id === plId ? updated : p)),
    });
    showToast(`Added to "${pl.name}"`);
  };

  const updatePlaylistTracks = (plId: string, newTracks: Track[]) => {
    const pl = userProfile.customPlaylists.find((p) => p.id === plId);
    if (!pl) return;
    const updated = {
      ...pl,
      tracks: newTracks,
      thumb: pl.customCover || pl.thumb || null,
    };
    syncProfile({
      ...userProfile,
      customPlaylists: userProfile.customPlaylists.map((p) => (p.id === plId ? updated : p)),
    });
  };

  const addMultipleTracksToPlaylist = (plId: string, tracksToAdd: Track[]) => {
    const pl = userProfile.customPlaylists.find((p) => p.id === plId);
    if (!pl) return;
    const existingIds = new Set(pl.tracks.map((t) => t.id));
    const uniqueNew = tracksToAdd.filter((t) => !existingIds.has(t.id));
    const updated = {
      ...pl,
      tracks: [...pl.tracks, ...uniqueNew],
      thumb: pl.customCover || pl.thumb || null,
    };
    syncProfile({
      ...userProfile,
      customPlaylists: userProfile.customPlaylists.map((p) => (p.id === plId ? updated : p)),
    });
    showToast(`Added ${uniqueNew.length} tracks to "${pl.name}"`);
  };

  const openCollection = (
    type: 'liked' | 'downloads' | 'custom-playlist' | 'artist' | 'playlist',
    id?: string | null,
    title?: string,
    thumb?: string | null,
    initialTracks?: Track[]
  ) => {
    setCollectionTarget({ type, id, title, thumb, initialTracks });
    setNavHistory((prev) => [...prev, activePane]);
    setActivePane('collection');
  };

  const goBack = () => {
    if (navHistory.length > 0) {
      const prev = navHistory[navHistory.length - 1];
      setNavHistory((h) => h.slice(0, -1));
      setActivePane(prev);
    } else {
      setActivePane('home');
    }
  };

  return (
    <MusicContext.Provider
      value={{
        activePane,
        setActivePane: (pane) => {
          setNavHistory((prev) => [...prev, activePane]);
          setActivePane(pane);
        },
        t,
        language,
        setLanguage,
        collectionTarget,
        openCollection,
        goBack,
        globalUser,
        globalPass,
        userProfile,
        setUserProfile,
        login,
        logout,
        syncProfile,
        isAuthGateOpen,
        setIsAuthGateOpen,
        isAccountSettingsOpen,
        setIsAccountSettingsOpen,
        updateUserPassword,
        updateUserEmail,
        adminResetUserPassword,
        activeTrack,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        volume,
        isMuted,
        isLooping,
        isShuffle,
        playbackQueue,
        queueIndex,
        playTrack,
        togglePlay,
        seekTo,
        seekBy,
        setVolumeLevel,
        toggleMute,
        toggleLoop,
        toggleShuffle,
        playNext,
        playPrevious,
        addToQueue,
        removeFromQueue,
        clearQueue,
        playQueueIndex,
        playWholeCollection,
        playShuffledCollection,
        playCollectionFromIndex,
        isFullScreenOpen,
        setIsFullScreenOpen,
        isMiniPlayerDismissed,
        setIsMiniPlayerDismissed,
        dismissMiniPlayer,
        isLandscapeStageOpen,
        setIsLandscapeStageOpen,
        isLyricsOpen,
        setIsLyricsOpen,
        isQueueOpen,
        setIsQueueOpen,
        actionSheetTrack,
        setActionSheetTrack,
        actionSheetMeta,
        setActionSheetMeta,
        modalCreatePlaylistOpen,
        setModalCreatePlaylistOpen,
        modalAddToPlaylistTrack,
        setModalAddToPlaylistTrack,
        modalImportPlaylistOpen,
        setModalImportPlaylistOpen,
        modalAddSongByLinkPlId,
        setModalAddSongByLinkPlId,
        modalAudioRecognitionOpen,
        setModalAudioRecognitionOpen,
        modalConfirm,
        setModalConfirm,
        isInstallModalOpen,
        setIsInstallModalOpen,
        hideSongFromStats,
        unhideSongFromStats,
        tuneMusicTaste,
        removeTrackFromTaste,
        isTuneInterested,
        isTuneDisliked,
        getInterestedTracks,
        getNotInterestedTracks,
        forceProfileServerSync,
        clearListeningStats,
        isSyncingToServer,
        lastServerSyncTime,
        downloadedSet,
        downloadQualityMap: downloadedQualityMap,
        downloadTrack,
        removeDownload,
        removeMultipleDownloads,
        clearAllDownloads,
        downloadPlaylist,
        bulkDownloadState,
        currentLyrics,
        retryLyrics,
        sleepTimerRemaining,
        sleepTimerIsEndOfSong,
        setSleepTimerMinutes,
        setSleepTimerEndOfSong,
        cancelSleepTimer,
        showToast,
        toasts,
        toggleLikeTrack,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        removeTrackFromPlaylist,
        addTrackToPlaylist,
        updatePlaylistTracks,
        addMultipleTracksToPlaylist,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within a MusicProvider');
  return context;
};
