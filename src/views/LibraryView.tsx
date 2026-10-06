import React, { useEffect, useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { TrackCard } from '../components/TrackCard';
import {
  Heart,
  Download,
  Plus,
  DownloadCloud,
  Music2,
  User,
  Trash2,
} from 'lucide-react';
import { getTotalDownloadedSize, formatBytes, getPersistentPlaylistCover } from '../services/storage';
import { PlaylistCover } from '../components/PlaylistCover';

export const LibraryView: React.FC = () => {
  const {
    userProfile,
    openCollection,
    setModalCreatePlaylistOpen,
    setModalImportPlaylistOpen,
    setModalConfirm,
    deletePlaylist,
    downloadedSet,
  } = useMusic();

  const [downloadSize, setDownloadSize] = useState('0 MB');

  useEffect(() => {
    getTotalDownloadedSize().then((bytes) => setDownloadSize(formatBytes(bytes)));
  }, [downloadedSet]);

  const likedCount = userProfile.likedSongs?.length || 0;
  const customPlaylists = userProfile.customPlaylists || [];
  const followedArtists = userProfile.favouriteArtists || [];

  return (
    <div className="flex flex-col gap-10 pb-20 select-none">
      {/* 1. Playlists Header & Quick Action Buttons */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl font-black text-white tracking-tight">Your Playlists</h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalImportPlaylistOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all hover:scale-105 active:scale-95"
            >
              <DownloadCloud className="w-4 h-4 text-[#ff6b1a]" />
              <span>Import Playlist</span>
            </button>

            <button
              onClick={() => setModalCreatePlaylistOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#ff6b1a] text-black text-xs font-extrabold transition-all hover:scale-105 active:scale-95 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>New Playlist</span>
            </button>
          </div>
        </div>

        {/* Playlists Grid - Custom & Imported Playlists first */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* User's Custom Playlists (Priority) */}
          {customPlaylists.map((pl) => {
            const customCover = (pl.id ? getPersistentPlaylistCover(pl.id) : null) || pl.customCover;
            return (
              <div
                key={pl.id}
                onClick={() => openCollection('custom-playlist', pl.id, pl.name, customCover)}
                className="group relative flex flex-col p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 transition-all cursor-pointer shadow-sm"
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-[#18181b] shadow-md group-hover:scale-105 transition-transform duration-300">
                  <PlaylistCover
                    cover={customCover}
                    tracks={pl.tracks}
                    sizeClass="w-full h-full"
                    roundedClass="rounded-xl"
                    alt={pl.name}
                  />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalConfirm({
                        title: `Delete "${pl.name}"?`,
                        text: "The playlist will be permanently removed from your library.",
                        onConfirm: () => deletePlaylist(pl.id),
                      });
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-white/70 hover:text-red-400 transition-all z-10 cursor-pointer"
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="font-bold text-sm text-white truncate">{pl.name}</h4>
                <p className="text-xs text-white/50 truncate font-medium mt-0.5">
                  {pl.source ? `${pl.source} • ` : ''}
                  {pl.tracks?.length || 0} tracks
                </p>
              </div>
            );
          })}

          {/* Quick Collections: Liked and Downloaded at the bottom */}
          {/* Liked Songs Special Card */}
          <div
            onClick={() => openCollection('liked')}
            className="group relative flex flex-col p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 transition-all cursor-pointer shadow-sm"
          >
            <div className="relative w-full aspect-square rounded-xl bg-gradient-to-br from-[#ff6b1a] to-[#6b2600] flex items-center justify-center text-white mb-3 shadow-md group-hover:scale-105 transition-transform duration-300">
              <Heart className="w-12 h-12 fill-white" />
            </div>
            <h4 className="font-bold text-sm text-white truncate">Liked Songs</h4>
            <p className="text-xs text-white/50 truncate font-medium mt-0.5">
              {likedCount} track{likedCount === 1 ? '' : 's'}
            </p>
          </div>

          {/* Downloaded Songs Special Card */}
          <div
            onClick={() => openCollection('downloads')}
            className="group relative flex flex-col p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 transition-all cursor-pointer shadow-sm"
          >
            <div className="relative w-full aspect-square rounded-xl bg-[#1c1c1e] border border-white/10 flex items-center justify-center text-[#ff6b1a] mb-3 shadow-md group-hover:scale-105 transition-transform duration-300">
              <Download className="w-12 h-12" />
            </div>
            <h4 className="font-bold text-sm text-white truncate">Downloaded</h4>
            <p className="text-xs text-white/50 truncate font-medium mt-0.5">
              {downloadedSet.size} tracks • {downloadSize}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Followed Artists */}
      {followedArtists.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-2xl font-black text-white tracking-tight">Favorite Artists</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {followedArtists.map((artist) => (
              <TrackCard key={artist.id} track={artist} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
