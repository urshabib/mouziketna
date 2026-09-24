import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  X,
  Plus,
  Music,
  FolderPlus,
  DownloadCloud,
  Link as LinkIcon,
  AlertTriangle,
  Mic,
  Loader2,
  Gift,
} from 'lucide-react';
import {
  importPlaylistFromYoutube,
  importPlaylistFromSpotify,
  resolveSingleSongLink,
  extractSpotifyPlaylistUrl,
  fetchWithTimeout,
} from '../services/api';
import { PlaylistCover } from './PlaylistCover';
import { getPersistentPlaylistCover } from '../services/storage';

export const Modals: React.FC = () => {
  const {
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
    isAuthGateOpen,
    setIsAuthGateOpen,
    login,
    createPlaylist,
    addTrackToPlaylist,
    userProfile,
    syncProfile,
    showToast,
  } = useMusic();

  // Add/Create Playlist state
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Import Playlist state
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  // Add song by link state
  const [songLink, setSongLink] = useState('');
  const [songLinkLoading, setSongLinkLoading] = useState(false);
  const [songLinkError, setSongLinkError] = useState('');

  // Audio Recognition state
  const [isListening, setIsListening] = useState(false);

  // Auth gate state
  const [gateUser, setGateUser] = useState('');
  const [gatePass, setGatePass] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState('');

  // Handle Add to Playlist
  const handleAddToExisting = (plId: string) => {
    if (!modalAddToPlaylistTrack) return;
    addTrackToPlaylist(plId, modalAddToPlaylistTrack);
    setModalAddToPlaylistTrack(null);
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim(), modalAddToPlaylistTrack || undefined);
    setNewPlaylistName('');
    setModalCreatePlaylistOpen(false);
    setModalAddToPlaylistTrack(null);
  };

  // Handle Import Playlist
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    setImportLoading(true);
    setImportError('');

    try {
      const spotifyUrl = extractSpotifyPlaylistUrl(importUrl);
      if (spotifyUrl) {
        const importedPl = await importPlaylistFromSpotify(spotifyUrl);
        syncProfile({
          ...userProfile,
          customPlaylists: [importedPl, ...userProfile.customPlaylists],
        });
        showToast(`Imported "${importedPl.name}" (${importedPl.tracks.length} tracks from Spotify)!`);
        setModalImportPlaylistOpen(false);
        setImportUrl('');
        return;
      }

      // YouTube / YouTube Music playlist import with multiple fallback tiers
      const importedPl = await importPlaylistFromYoutube(importUrl);
      syncProfile({
        ...userProfile,
        customPlaylists: [importedPl, ...userProfile.customPlaylists],
      });
      showToast(`Imported "${importedPl.name}" (${importedPl.tracks.length} tracks)!`);
      setModalImportPlaylistOpen(false);
      setImportUrl('');
    } catch (err: any) {
      setImportError(err.message || "Couldn't import that playlist.");
    } finally {
      setImportLoading(false);
    }
  };

  // Handle Add Song by Link
  const handleAddSongByLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songLink.trim() || !modalAddSongByLinkPlId) return;
    setSongLinkLoading(true);
    setSongLinkError('');

    try {
      const track = await resolveSingleSongLink(songLink.trim());
      addTrackToPlaylist(modalAddSongByLinkPlId, track);
      setModalAddSongByLinkPlId(null);
      setSongLink('');
    } catch (err: any) {
      setSongLinkError(err.message || "Couldn't resolve that track link.");
    } finally {
      setSongLinkLoading(false);
    }
  };

  // Handle Gate Login
  const handleGateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateUser.trim() || !gatePass.trim()) return;
    setGateLoading(true);
    setGateError('');
    const res = await login(gateUser.trim(), gatePass.trim());
    setGateLoading(false);
    if (!res.success) {
      setGateError(res.error || 'Login failed.');
    }
  };

  return (
    <>
      {/* 1. ADD / CREATE PLAYLIST MODAL */}
      {(modalCreatePlaylistOpen || modalAddToPlaylistTrack) && (
        <div
          onClick={() => {
            setModalCreatePlaylistOpen(false);
            setModalAddToPlaylistTrack(null);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#18181b] glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-lg text-white">
                {modalAddToPlaylistTrack ? 'Add to Playlist' : 'Create Playlist'}
              </h3>
              <button
                onClick={() => {
                  setModalCreatePlaylistOpen(false);
                  setModalAddToPlaylistTrack(null);
                }}
                className="p-1.5 text-white/40 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List existing playlists if adding a track */}
            {modalAddToPlaylistTrack && userProfile.customPlaylists.length > 0 && (
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-1">
                {userProfile.customPlaylists.map((pl) => {
                  const customCover = (pl.id ? getPersistentPlaylistCover(pl.id) : null) || pl.customCover;
                  return (
                    <button
                      key={pl.id}
                      onClick={() => handleAddToExisting(pl.id)}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-[#252528] shadow-sm flex items-center justify-center">
                          <PlaylistCover
                            cover={customCover}
                            tracks={pl.tracks}
                            sizeClass="w-8 h-8"
                            roundedClass="rounded-lg"
                            alt={pl.name}
                          />
                        </div>
                        <span className="font-semibold text-sm text-white truncate">{pl.name}</span>
                      </div>
                      <span className="text-xs text-white/40 group-hover:text-white/60">
                        {pl.tracks.length} tracks
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Create new playlist form */}
            <form onSubmit={handleCreateAndAdd} className="flex flex-col gap-3 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                New Playlist
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Playlist name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff6b1a] transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-5 py-2.5 bg-[#ff6b1a] text-black font-extrabold text-sm rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. IMPORT PLAYLIST MODAL */}
      {modalImportPlaylistOpen && (
        <div
          onClick={() => setModalImportPlaylistOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#18181b] glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <DownloadCloud className="w-5 h-5 text-[#ff6b1a]" />
                <h3 className="font-bold text-lg text-white">Import Playlist</h3>
              </div>
              <button
                onClick={() => setModalImportPlaylistOpen(false)}
                className="p-1.5 text-white/40 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60 leading-relaxed">
              Paste a public YouTube Music or YouTube playlist URL. Songs will be imported directly
              into your library with multi-tier mirror fallback so it never fails.
            </p>

            <form onSubmit={handleImportSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="https://music.youtube.com/playlist?list=..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff6b1a] transition-colors"
              />

              {importError && (
                <p className="text-xs text-red-400 font-medium bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  {importError}
                </p>
              )}

              <button
                type="submit"
                disabled={importLoading || !importUrl.trim()}
                className="w-full py-3 bg-[#ff6b1a] text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg"
              >
                {importLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing Playlist…</span>
                  </>
                ) : (
                  <span>Import Tracks</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD SONG BY LINK MODAL */}
      {modalAddSongByLinkPlId && (
        <div
          onClick={() => setModalAddSongByLinkPlId(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#18181b] glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <LinkIcon className="w-5 h-5 text-[#ff6b1a]" />
                <h3 className="font-bold text-lg text-white">Add Song by Link</h3>
              </div>
              <button
                onClick={() => setModalAddSongByLinkPlId(null)}
                className="p-1.5 text-white/40 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60 leading-relaxed">
              Paste a YouTube or YouTube Music song link to add it to this playlist.
            </p>

            <form onSubmit={handleAddSongByLink} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="https://music.youtube.com/watch?v=..."
                value={songLink}
                onChange={(e) => setSongLink(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff6b1a] transition-colors"
              />

              {songLinkError && (
                <p className="text-xs text-red-400 font-medium bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  {songLinkError}
                </p>
              )}

              <button
                type="submit"
                disabled={songLinkLoading || !songLink.trim()}
                className="w-full py-3 bg-[#ff6b1a] text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg"
              >
                {songLinkLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resolving Track…</span>
                  </>
                ) : (
                  <span>Add to Playlist</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. CONFIRM MODAL */}
      {modalConfirm && (
        <div
          onClick={() => setModalConfirm(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#18181b] glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-3 animate-in zoom-in-95 duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-1">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-white">{modalConfirm.title}</h3>
            <p className="text-xs text-white/60 leading-relaxed">{modalConfirm.text}</p>
            <div className="flex gap-2 w-full mt-3">
              <button
                onClick={() => setModalConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  modalConfirm.onConfirm();
                  setModalConfirm(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. AUDIO RECOGNITION (SHAZAM-STYLE) */}
      {modalAudioRecognitionOpen && (
        <div
          onClick={() => setModalAudioRecognitionOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#18181b] glass-panel border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="relative flex items-center justify-center my-4">
              <div className="w-24 h-24 rounded-full bg-[#ff6b1a] text-black flex items-center justify-center shadow-2xl animate-pulse">
                <Mic className="w-10 h-10" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-[#ff6b1a] animate-ping opacity-75" />
            </div>
            <h3 className="font-black text-xl text-white">Listening…</h3>
            <p className="text-xs text-white/60">Hold your device near the audio source</p>
            <button
              onClick={() => setModalAudioRecognitionOpen(false)}
              className="mt-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 6. AUTH GATE MODAL */}
      {isAuthGateOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none">
          <div className="w-full max-w-sm bg-[#18181b] glass-panel border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff6b1a] to-[#7a2c00] flex items-center justify-center shadow-lg text-white mb-2">
              <Gift className="w-7 h-7" />
            </div>

            <h3 className="font-black text-2xl text-white">Welcome to MOUZIKA</h3>
            <p className="text-xs text-white/50 -mt-1">
              Sign in to sync your library, favorites, and playlists.
            </p>

            <form onSubmit={handleGateLogin} className="w-full flex flex-col gap-3 mt-2">
              <input
                type="text"
                placeholder="Username"
                value={gateUser}
                onChange={(e) => setGateUser(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff6b1a] transition-colors text-center font-medium"
              />
              <input
                type="password"
                placeholder="Password"
                value={gatePass}
                onChange={(e) => setGatePass(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff6b1a] transition-colors text-center font-medium"
              />

              {gateError && (
                <p className="text-xs text-red-400 font-medium bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  {gateError}
                </p>
              )}

              <button
                type="submit"
                disabled={gateLoading || !gateUser.trim() || !gatePass.trim()}
                className="w-full py-3 bg-[#ff6b1a] text-black font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg mt-1"
              >
                {gateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Sign In</span>}
              </button>
            </form>

            <button
              onClick={() => setIsAuthGateOpen(false)}
              className="text-xs font-semibold text-white/40 hover:text-white/70 transition-colors mt-2"
            >
              Continue Offline as Guest
            </button>
          </div>
        </div>
      )}
    </>
  );
};
