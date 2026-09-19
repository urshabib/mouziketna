import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { CustomPlaylist, DownloadRecord, LyricsData, NavigationPane, Track, UserProfile } from '../types';
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
  canonicalThumbUrl,
  FALLBACK_ART,
  fetchJsonRetry,
  normalizeTrack,
  searchTracks,
} from '../services/api';
import {
  cacheProfileLocally,
  deleteDownload,
  downloadedIds,
  downloadedQualityMap,
  getDownloadQuality,
  ensurePersistentStorageOnce,
  formatBytes,
  getDownload,
  initDownloadsRegistry,
  isDownloaded,
  listDownloads,
  loadDeviceSettings,
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
} from '../services/storage';

interface Toast {
  id: string;
  message: string;
  isGray?: boolean;
}

interface MusicContextType {
  // Navigation
  activePane: NavigationPane;
  setActivePane: (pane: NavigationPane) => void;
  collectionTarget: { type: 'liked' | 'downloads' | 'custom-playlist' | 'artist' | 'playlist'; id?: string | null; title?: string; thumb?: string | null } | null;
  openCollection: (type: 'liked' | 'downloads' | 'custom-playlist' | 'artist' | 'playlist', id?: string | null, title?: string, thumb?: string | null) => void;
  goBack: () => void;

  // Profile & Auth
  globalUser: string | null;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  login: (user: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  syncProfile: (updatedProfile?: UserProfile) => void;
  isAuthGateOpen: boolean;
  setIsAuthGateOpen: (open: boolean) => void;

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
  surpriseUser: string | null;
  setSurpriseUser: (user: string | null) => void;

  // Downloads
  downloadedSet: Set<string>;
  downloadQualityMap: Map<string, string>;
  downloadTrack: (track: Track, silent?: boolean, isAutoCache?: boolean) => Promise<boolean>;
  removeDownload: (trackId: string) => Promise<void>;
  removeMultipleDownloads: (trackIds: string[]) => Promise<void>;
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
  downloadQuality: 'high',
  autoCacheQuality: 'stable',
  downloadLyricsOffline: false,
  autoCachePlayed: true,
  liquidGlass: true,
  theme: 'dark',
  accentColor: 'orange',
  lyricsColor: 'white',
  presetTint: 'none',
  activePreset: 'glass',
  avatarUrl: null,
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePane, setActivePane] = useState<NavigationPane>('home');
  const [navHistory, setNavHistory] = useState<NavigationPane[]>(['home']);
  const [collectionTarget, setCollectionTarget] = useState<MusicContextType['collectionTarget']>(null);

  const [globalUser, setGlobalUser] = useState<string | null>(() => localStorage.getItem('hub_active_user') || null);
  const [globalPass, setGlobalPass] = useState<string | null>(() => localStorage.getItem('hub_active_pass') || null);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);

  // Playback state
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('hub_volume') ?? 50));
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  // Audio elements
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const playTokenRef = useRef(0);
  const hasPrefetchedNextRef = useRef(false);
  const playedHistoryRef = useRef<Track[]>([]);

  // Overlays
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
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
  const [surpriseUser, setSurpriseUser] = useState<string | null>(null);

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
    }, 2500);
  }, []);

  // Initialize audio elements
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = volume / 100;
    audioRef.current = audio;

    const prefetchAudio = new Audio();
    prefetchAudio.preload = 'auto';
    prefetchAudio.muted = true;
    prefetchAudioRef.current = prefetchAudio;

    const onPlay = () => {
      setIsPlaying(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
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
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      updatePositionState();
      // Auto prefetch check: trigger at 18s left in song
      if (
        !hasPrefetchedNextRef.current &&
        audio.duration > 25 &&
        audio.duration - audio.currentTime <= 18
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
      if (audio.loop) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        playNext();
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    // Init downloads registry
    initDownloadsRegistry().then(() => {
      setDownloadedSet(new Set(downloadedIds));
    });

    // Device settings initialization
    const devSettings = loadDeviceSettings();
    if (devSettings) {
      setUserProfile((prev) => ({ ...prev, ...devSettings }));
      applyTheme(devSettings.theme || 'dark', devSettings.accentColor || 'orange', devSettings.lyricsColor || 'white', devSettings.presetTint || 'none', devSettings.liquidGlass ?? true);
    }

    // Auto-login on launch if saved
    const savedUser = localStorage.getItem('hub_active_user');
    const savedPass = localStorage.getItem('hub_active_pass');
    if (savedUser && savedPass) {
      if (savedUser !== 'admin') {
        const cached = restoreProfileFromCache(savedUser);
        if (cached) {
          setUserProfile((prev) => ({ ...prev, ...cached }));
        }
      }
      login(savedUser, savedPass);
    } else {
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
    liquidGlass: boolean
  ) => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-accent', accent);
    document.documentElement.setAttribute('data-lyrics-color', lyricsColor);
    document.documentElement.setAttribute('data-preset-tint', presetTint);
    document.body.classList.toggle('liquid-glass', !!liquidGlass);
  };

  const syncProfile = useCallback((updated?: UserProfile) => {
    const prof = updated || userProfile;
    setUserProfile(prof);
    saveDeviceSettings(prof);
    applyTheme(prof.theme, prof.accentColor, prof.lyricsColor, prof.presetTint, prof.liquidGlass);
    if (!globalUser || globalUser === 'admin') return;
    cacheProfileLocally(globalUser, prof);

    fetchWithTimeout(`${NEW_HUB_BACKEND}/api/save-profile`, 8000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prof),
    }).catch(() => {});
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
      localStorage.setItem('hub_active_user', user);
      localStorage.setItem('hub_active_pass', pass);
      setIsAuthGateOpen(false);

      if (data.isAdmin) {
        showToast('Logged in as Admin');
      } else if (data.profile) {
        const p = data.profile;
        const merged: UserProfile = {
          ...userProfile,
          username: p.username || user,
          likedSongs: p.likedSongs || [],
          customPlaylists: p.customPlaylists || [],
          favouriteArtists: p.favouriteArtists || [],
          favouriteAlbums: p.favouriteAlbums || [],
          recentlyPlayed: p.recentlyPlayed || [],
          dataSaver: !!p.dataSaver,
          dataSaverLevel: p.dataSaverLevel || 'off',
          downloadLyricsOffline: !!p.downloadLyricsOffline,
          autoCachePlayed: p.autoCachePlayed !== false,
          liquidGlass: p.liquidGlass !== undefined ? !!p.liquidGlass : true,
          theme: p.theme === 'light' ? 'light' : 'dark',
          accentColor: p.accentColor || 'orange',
          lyricsColor: p.lyricsColor || 'white',
          presetTint: p.presetTint || 'none',
          activePreset: p.activePreset ?? 'glass',
          avatarUrl: p.avatarUrl || null,
        };
        setUserProfile(merged);
        applyTheme(merged.theme, merged.accentColor, merged.lyricsColor, merged.presetTint, merged.liquidGlass);
        cacheProfileLocally(user, merged);
        if (data.surprise) {
          setSurpriseUser(user);
        } else {
          showToast(`Welcome back, ${user}`);
        }
      }
      return { success: true };
    } catch {
      return { success: false, error: "Can't reach server. Working in offline mode." };
    }
  };

  const logout = () => {
    localStorage.removeItem('hub_active_user');
    localStorage.removeItem('hub_active_pass');
    setGlobalUser(null);
    setGlobalPass(null);
    setUserProfile(defaultProfile);
    setIsAuthGateOpen(true);
    showToast('Logged out', true);
  };

  // Next Track Algorithmic Discovery
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
          .filter((t: Track) => t.id && t.id !== seed.id);

        if (candidates.length > 0) {
          return candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
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

  const tryPlayCandidates = async (candidates: string[], token: number, idx = 0): Promise<boolean> => {
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
          if (activeTrack) cacheStreamUrl(activeTrack.id, url);
          resolve(true);
        } else {
          const nextOk = await tryPlayCandidates(candidates, token, idx + 1);
          resolve(nextOk);
        }
      };

      const onPlaying = () => finish(true);
      const onCanPlay = () => finish(true);
      const onError = () => finish(false);
      const timer = setTimeout(() => finish(false), 6000);

      audio.addEventListener('playing', onPlaying, { once: true });
      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('error', onError, { once: true });

      try {
        audio.src = url;
        audio.play().catch(() => {});
      } catch {
        finish(false);
      }
    });
  };

  const generateRadioQueue = async (seedTrack: Track) => {
    try {
      const query = seedTrack.artist ? cleanArtistName(seedTrack.artist) : seedTrack.title;
      const res = await fetchJsonRetry<any>(
        `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(query)}&f=song`,
        2
      );
      const items = Array.isArray(res) ? res : res.items || [];
      const recs: Track[] = items
        .filter((it: any) => (it.videoId || it.id) !== seedTrack.id)
        .slice(0, 15)
        .map((it: any) => normalizeTrack(it, 'song'));

      if (recs.length > 0) {
        setPlaybackQueue((current) => {
          if (current.length <= 1) {
            return [seedTrack, ...recs];
          }
          return current;
        });
      }
    } catch {}
  };

  // Primary playback execution
  const playTrack = async (track: Track, fromQueue = false): Promise<boolean> => {
    if (!track || !track.id) return false;
    const audio = audioRef.current;
    if (!audio) return false;

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

    setActiveTrack(track);
    setIsBuffering(true);
    setCurrentTime(0);

    // Reset lyrics
    setCurrentLyrics({ mode: 'loading' });
    fetchLyricsForTrack(track).then((l) => {
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
          rememberListen(track);
          updateMediaSession(track);
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
      rememberListen(track);
      updateMediaSession(track);
      return true;
    }

    // 3. Fast Parallel Resolving
    const level = userProfile.dataSaverLevel || 'off';
    const quality = level === 'ultra' ? '48' : level === 'saver' ? '96' : '320';
    const cleanedArtist = cleanArtistName(track.artist);

    // If track has an imported ID (like Spotify "sp_..."), resolve YouTube ID for mirror fallback
    if (!track.id || track.id.startsWith('sp_') || track.id.length !== 11) {
      try {
        const found = await searchTracks(`${track.title} ${cleanedArtist}`, 'song');
        if (found.length > 0 && found[0].id) {
          track.id = found[0].id;
          if (!track.thumb) track.thumb = found[0].thumb;
        }
      } catch {}
    }

    const candidates: string[] = [];
    const mirrorPromise = resolveMirrorStreams(track.id).catch(() => []);

    // Try Saavn first
    try {
      const saavnUrl = await resolveSaavnStream(
        cleanTitleForLyrics(track.title) || track.title,
        cleanedArtist,
        quality,
        track.title,
        track.artist
      );
      if (saavnUrl) candidates.push(saavnUrl);
    } catch {}

    try {
      const mirrors = await mirrorPromise;
      candidates.push(...mirrors);
    } catch {}

    if (token !== playTokenRef.current) return false;

    if (candidates.length === 0) {
      setIsBuffering(false);
      showToast('Could not resolve stream source for this track.', true);
      return false;
    }

    // Play first working candidate
    const ok = await tryPlayCandidates(candidates, token, 0);
    if (token !== playTokenRef.current) return false;

    if (ok) {
      rememberListen(track);
      updateMediaSession(track);
      // Auto cache if enabled
      if (userProfile.autoCachePlayed && !isDownloaded(track.id)) {
        setTimeout(() => {
          downloadTrack(track, true, true).catch(() => {});
        }, 3000);
      }
      return true;
    } else {
      setIsBuffering(false);
      showToast('Playback failed across all mirrors. Please try another track.', true);
      return false;
    }
  };

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
        album: t.album || 'MOUZIKA',
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
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (audio && isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(audio.duration, time));
      setCurrentTime(audio.currentTime);
    }
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
    localStorage.setItem('hub_volume', String(v));
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
      if (audioRef.current) audioRef.current.loop = next;
      return next;
    });
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const playNext = async () => {
    if (playbackQueue.length > 0) {
      if (isShuffle) {
        const nextIdx = Math.floor(Math.random() * playbackQueue.length);
        setQueueIndex(nextIdx);
        playTrack(playbackQueue[nextIdx], true);
      } else if (queueIndex < playbackQueue.length - 1) {
        const nextIdx = queueIndex + 1;
        setQueueIndex(nextIdx);
        playTrack(playbackQueue[nextIdx], true);
      } else if (activeTrack) {
        // Algorithmic discovery when queue finishes
        const next = await getNextAlgorithmTrack(activeTrack);
        if (next) playTrack(next);
      }
    } else if (activeTrack) {
      const next = await getNextAlgorithmTrack(activeTrack);
      if (next) playTrack(next);
    }
  };

  const playPrevious = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (playedHistoryRef.current.length > 0) {
      const prev = playedHistoryRef.current.pop();
      if (prev) playTrack(prev);
    } else if (audio) {
      audio.currentTime = 0;
    }
  };

  const addToQueue = (track: Track, playNext = false) => {
    setPlaybackQueue((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      if (playNext) {
        const insertAt = queueIndex >= 0 ? queueIndex + 1 : 0;
        const copy = [...filtered];
        copy.splice(insertAt, 0, track);
        return copy;
      }
      return [...filtered, track];
    });
    showToast(playNext ? `Playing next: ${track.title}` : `Added to queue: ${track.title}`);
  };

  const removeFromQueue = (idx: number) => {
    setPlaybackQueue((prev) => prev.filter((_, i) => i !== idx));
    if (idx < queueIndex) setQueueIndex((q) => q - 1);
  };

  const clearQueue = () => {
    setPlaybackQueue([]);
    setQueueIndex(-1);
    showToast('Queue cleared', true);
  };

  const playQueueIndex = (idx: number) => {
    if (idx >= 0 && idx < playbackQueue.length) {
      setQueueIndex(idx);
      playTrack(playbackQueue[idx], true);
    }
  };

  const playWholeCollection = (tracks: Track[]) => {
    if (!tracks.length) return;
    setPlaybackQueue(tracks);
    setQueueIndex(0);
    playTrack(tracks[0], true);
  };

  const playShuffledCollection = (tracks: Track[]) => {
    if (!tracks.length) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setPlaybackQueue(shuffled);
    setQueueIndex(0);
    setIsShuffle(true);
    playTrack(shuffled[0], true);
  };

  const playCollectionFromIndex = (tracks: Track[], index: number) => {
    if (!tracks.length) return;
    const clampedIndex = Math.max(0, Math.min(index, tracks.length - 1));
    setPlaybackQueue(tracks);
    setQueueIndex(clampedIndex);
    playTrack(tracks[clampedIndex], true);
  };

  // Downloads
  const downloadTrack = async (
    track: Track,
    silent = false,
    isAutoCache = false
  ): Promise<boolean> => {
    if (!track?.id) return false;

    // Calculate quality target
    let quality: '320' | '160' | '96' | '48' = '320';
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
          : 'high');
      quality = dq === 'ultra' ? '48' : dq === 'saver' ? '96' : '320';
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

      // 1. Cached in-memory stream if currently available
      const cached = getCachedStreamUrl(track.id);
      if (cached) candidates.push(cached);

      // 2. Saavn high quality / saver stream
      try {
        const saavnUrl = await resolveSaavnStream(
          cleanTitleForLyrics(track.title) || track.title,
          cleanedArtist,
          quality,
          track.title,
          track.artist
        );
        if (saavnUrl && !candidates.includes(saavnUrl)) {
          candidates.push(saavnUrl);
        }
      } catch {}

      // 3. Mirror streaming sources
      try {
        const mirrors = await resolveMirrorStreams(ytTrackId || track.id).catch(() => []);
        for (const m of mirrors) {
          if (m && !candidates.includes(m)) {
            candidates.push(m);
          }
        }
      } catch {}

      if (candidates.length === 0) throw new Error('No stream source');

      // Attempt to download from candidates until one succeeds
      let audioBlob: Blob | null = null;
      for (const url of candidates) {
        try {
          const res = await fetchWithTimeout(url, 25000);
          if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 10000) {
              audioBlob = blob;
              break;
            }
          }
        } catch {}
      }

      if (!audioBlob) throw new Error('Failed to fetch audio stream');

      // Low-res thumbnail blob
      let thumbBlob: Blob | null = null;
      try {
        if (track.thumb) {
          const tRes = await fetchWithTimeout(canonicalThumbUrl(ytTrackId || track.id), 5000);
          if (tRes.ok) thumbBlob = await tRes.blob();
        }
      } catch {}

      // Lyrics if offline lyrics enabled
      let lyricsData: LyricsData | null = null;
      if (userProfile.downloadLyricsOffline) {
        lyricsData = await fetchLyricsForTrack(track);
      }

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
      setDownloadedSet(new Set(downloadedIds));
      if (!silent) {
        showToast(
          quality === '320'
            ? `Downloaded "${track.title}" in High Quality`
            : `Downloaded "${track.title}" in Data Saver`
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
    setDownloadedSet(new Set(downloadedIds));
    showToast('Download removed', true);
  };

  const removeMultipleDownloads = async (trackIds: string[]) => {
    for (const id of trackIds) {
      await deleteDownload(id);
    }
    setDownloadedSet(new Set(downloadedIds));
    showToast(`Removed ${trackIds.length} downloads`, true);
  };

  const downloadPlaylist = async (tracks: Track[]) => {
    const unDownloaded = tracks.filter((t) => !isDownloaded(t.id));
    if (!unDownloaded.length) {
      showToast('All tracks are already downloaded');
      return;
    }
    setBulkDownloadState({ done: 0, total: unDownloaded.length, inProgress: true });
    let successCount = 0;
    let failCount = 0;
    for (const t of unDownloaded) {
      const ok = await downloadTrack(t, true);
      if (ok) {
        successCount++;
      } else {
        failCount++;
      }
      setBulkDownloadState({ done: successCount + failCount, total: unDownloaded.length, inProgress: true });
    }
    setBulkDownloadState({ done: successCount + failCount, total: unDownloaded.length, inProgress: false });
    if (failCount === 0) {
      showToast(`Downloaded all ${successCount} tracks`);
    } else if (successCount > 0) {
      showToast(`Downloaded ${successCount} tracks (${failCount} failed)`);
    } else {
      showToast(`Failed to download tracks. Please check connection.`, true);
    }
  };

  const retryLyrics = () => {
    if (activeTrack) {
      setCurrentLyrics({ mode: 'loading' });
      fetchLyricsForTrack(activeTrack, duration).then(setCurrentLyrics);
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
      thumb: firstTrack?.thumb || null,
    };
    syncProfile({ ...userProfile, customPlaylists: [pl, ...userProfile.customPlaylists] });
    showToast(`Created playlist "${name}"`);
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
      thumb: pl.thumb || track.thumb,
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
      thumb: newTracks[0]?.thumb || pl.thumb,
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
      thumb: pl.thumb || uniqueNew[0]?.thumb,
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
    thumb?: string | null
  ) => {
    setCollectionTarget({ type, id, title, thumb });
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
        collectionTarget,
        openCollection,
        goBack,
        globalUser,
        userProfile,
        setUserProfile,
        login,
        logout,
        syncProfile,
        isAuthGateOpen,
        setIsAuthGateOpen,
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
        surpriseUser,
        setSurpriseUser,
        downloadedSet,
        downloadQualityMap: downloadedQualityMap,
        downloadTrack,
        removeDownload,
        removeMultipleDownloads,
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
