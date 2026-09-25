export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumb: string | null;
  type: 'song' | 'artist' | 'playlist' | 'video';
  duration?: number;
}

export interface UserProfile {
  username: string;
  likedSongs: Track[];
  customPlaylists: CustomPlaylist[];
  favouriteArtists: Track[];
  favouriteAlbums: Track[];
  recentlyPlayed: Track[];
  dataSaver: boolean;
  dataSaverLevel: 'off' | 'saver' | 'ultra';
  downloadQuality?: 'stable' | 'high' | 'saver' | 'ultra';
  autoCacheQuality?: 'stable' | 'high' | 'saver' | 'ultra';
  customAppName?: string;
  appLogo?: string;
  downloadLyricsOffline: boolean;
  downloadArtOffline?: boolean;
  artQualityOffline?: 'low' | 'medium' | 'high' | 'original';
  autoCachePlayed: boolean;
  liquidGlass: boolean;
  theme: 'dark' | 'light';
  accentColor: string;
  customAccentHex?: string;
  lyricsFont?: 'poppins' | 'bebas' | 'caveat' | 'playfair' | 'righteous' | 'jetbrains' | string;
  lyricsColor: string;
  customLyricsHex?: string;
  lyricsGlow?: 'off' | 'default' | 'strong';
  keyPartsDisplay?: 'off' | 'dots' | 'full';
  progressBarStyle?: 'default' | 'block' | 'wave' | 'neon';
  presetTint: string;
  uiScale?: 'small' | 'default' | 'large';
  activePreset: string | null;
  avatarUrl: string | null;
  isAdmin?: boolean;
}

export interface SongHighlight {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  type: 'chorus' | 'hook' | 'drop' | 'intro';
}

export interface CustomPlaylist {
  id: string;
  name: string;
  tracks: Track[];
  source?: string;
  thumb?: string | null;
  customCover?: string | null;
}

export interface SyncedLyricsLine {
  time: number;
  text: string;
}

export interface LyricsData {
  mode: 'loading' | 'synced' | 'plain' | 'none' | 'error';
  lines?: SyncedLyricsLine[] | string | null;
  source?: string;
}

export interface DownloadRecord {
  id: string;
  title: string;
  artist: string;
  thumbLowRes: Blob | null;
  audioBlob: Blob;
  quality: string;
  lyricsData: LyricsData | null;
  sizeBytes: number;
  downloadedAt: number;
}

export type NavigationPane = 'home' | 'search' | 'library' | 'collection' | 'settings' | 'account' | 'admin';

export interface CollectionTarget {
  type: 'liked' | 'downloads' | 'custom-playlist' | 'artist' | 'playlist';
  id?: string | null;
  title?: string;
  thumb?: string | null;
}
