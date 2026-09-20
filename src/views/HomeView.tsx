import React, { useEffect, useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { Track } from '../types';
import { TrackCard } from '../components/TrackCard';
import { TrackRow } from '../components/TrackRow';
import {
  RefreshCw,
  Flame,
  Globe2,
  Coffee,
  Mic2,
  BookOpen,
  Dumbbell,
  Heart,
  Disc,
  Radio,
} from 'lucide-react';
import { fetchJsonRetry, normalizeTrack, NEW_HUB_BACKEND } from '../services/api';
import { tasteTopSeeds, tasteArtistKey } from '../services/storage';

const GENRES = [
  { name: 'Arabic Hits', query: 'Top 50 Arabic Hits', bg: 'from-purple-900 to-indigo-950', icon: <Flame className="w-8 h-8 opacity-40" /> },
  { name: 'Global Pop', query: 'Global Pop Hits', bg: 'from-blue-900 to-slate-950', icon: <Globe2 className="w-8 h-8 opacity-40" /> },
  { name: 'Chill & Relax', query: 'Calm Chill Relax Lofi', bg: 'from-teal-900 to-emerald-950', icon: <Coffee className="w-8 h-8 opacity-40" /> },
  { name: 'Tunisian Rap', query: 'Tunisian Rap', bg: 'from-amber-900 to-yellow-950', icon: <Mic2 className="w-8 h-8 opacity-40" /> },
  { name: 'Deep Focus', query: 'Deep Focus Study', bg: 'from-emerald-900 to-teal-950', icon: <BookOpen className="w-8 h-8 opacity-40" /> },
  { name: 'Workout', query: 'Gym Workout Motivation', bg: 'from-pink-900 to-rose-950', icon: <Dumbbell className="w-8 h-8 opacity-40" /> },
];

export const HomeView: React.FC = () => {
  const {
    userProfile,
    setActivePane,
    openCollection,
    playTrack,
    showToast,
  } = useMusic();

  const [recommendedSongs, setRecommendedSongs] = useState<Track[]>([]);
  const [recommendedPlaylists, setRecommendedPlaylists] = useState<Track[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const recentlyPlayed = userProfile.recentlyPlayed || [];

  const loadRecommendations = async (manual = false) => {
    setLoadingRecs(true);
    try {
      // 1. Gather rich seeds across user's liked songs, recently played, and custom playlists
      const playlistSongs = (userProfile.customPlaylists || []).flatMap((pl) => pl.tracks || []);
      const allUserTracks = [...(userProfile.likedSongs || []), ...recentlyPlayed, ...playlistSongs];
      const topTaste = tasteTopSeeds(allUserTracks, 4);

      // 2. Select dynamic query based on taste seeds and artists
      let seedQuery = 'Tunisian Rap Arabic Pop Hits';
      if (topTaste.length > 0) {
        const artists = topTaste.map((t) => t.artist).filter(Boolean);
        seedQuery = artists.slice(0, 2).join(' ') + ' mix';
      } else if (recentlyPlayed.length > 0) {
        seedQuery = recentlyPlayed[0].artist + ' mix';
      }

      const res = await fetchJsonRetry<any>(
        `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(seedQuery)}&f=song`,
        2
      );
      const items = Array.isArray(res) ? res : res.items || [];
      const seen = new Set<string>();
      const artistSeen: Record<string, number> = {};
      const songs: Track[] = [];

      // Interleave user favorite tracks if available
      for (const t of topTaste) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          songs.push(t);
        }
      }

      // Add discovered matching songs
      for (const it of items) {
        const norm = normalizeTrack(it, 'song');
        if (!norm.id || seen.has(norm.id)) continue;
        const aKey = tasteArtistKey(norm.artist);
        if (aKey && (artistSeen[aKey] || 0) >= 2) continue;
        seen.add(norm.id);
        if (aKey) artistSeen[aKey] = (artistSeen[aKey] || 0) + 1;
        songs.push(norm);
        if (songs.length >= 12) break;
      }

      setRecommendedSongs(songs);

      // Playlists based on genre/taste
      const plQuery = topTaste.length > 0 && topTaste[0].artist
        ? `${topTaste[0].artist} Playlist Mix`
        : 'Top Hits Music Mix';

      const plRes = await fetchJsonRetry<any>(
        `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(plQuery)}&f=playlist`,
        2
      );
      const plItems = Array.isArray(plRes) ? plRes : plRes.items || [];
      const pls: Track[] = plItems.slice(0, 6).map((it: any) => normalizeTrack(it, 'playlist'));
      setRecommendedPlaylists(pls);

      if (manual) showToast('Recommendations updated');
    } catch {
      // Fallback
    } finally {
      setLoadingRecs(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, []);

  const handleGenreClick = (query: string) => {
    openCollection('playlist', query, query);
  };

  return (
    <div className="flex flex-col gap-10 pb-16">
      {/* 1. Recently Played */}
      {recentlyPlayed.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Recently Played
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {recentlyPlayed.slice(0, 6).map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </div>
        </section>
      )}

      {/* 2. Recommended For You */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Recommended For You
          </h3>
          <button
            onClick={() => loadRecommendations(true)}
            disabled={loadingRecs}
            className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRecs ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {recommendedSongs.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {recommendedSongs.slice(0, 6).map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white/[0.03] animate-pulse flex flex-col gap-2.5">
                <div className="w-full aspect-square bg-white/5 rounded-xl" />
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Made For You Playlists */}
      {recommendedPlaylists.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Made For You
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {recommendedPlaylists.map((pl) => (
              <TrackCard key={pl.id} track={pl} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Quick Genre Browse */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Browse Categories
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {GENRES.map((g) => (
            <div
              key={g.name}
              onClick={() => handleGenreClick(g.query)}
              className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 aspect-[16/10] bg-gradient-to-br ${g.bg} cursor-pointer hover:scale-[1.03] active:scale-95 transition-all shadow-lg flex flex-col justify-between`}
            >
              <div className="self-end">{g.icon}</div>
              <h4 className="font-extrabold text-base sm:text-lg text-white tracking-tight leading-snug">
                {g.name}
              </h4>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
