export interface Track {
  id: string;
  title: string;
  artist: string;
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
  downloadQuality?: 'high' | 'saver' | 'ultra';
  autoCacheQuality?: 'saver' | 'ultra';
  downloadLyricsOffline: boolean;
  autoCachePlayed: boolean;
  liquidGlass: boolean;
  theme: 'dark' | 'light';
  accentColor: string;
  lyricsColor: string;
  presetTint: string;
  activePreset: string | null;
  avatarUrl: string | null;
  isAdmin?: boolean;
}

export interface CustomPlaylist {
  id: string;
  name: string;
  tracks: Track[];
  source?: string;
  thumb?: string | null;
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
