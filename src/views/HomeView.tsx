import React, { useEffect, useState, useRef } from 'react';
import { useMusic } from '../context/MusicContext';
import { Track } from '../types';
import { TrackCard } from '../components/TrackCard';
import {
  RefreshCw,
  Flame,
  Globe2,
  Coffee,
  Mic2,
  BookOpen,
  Dumbbell,
  Play,
  Heart,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  fetchJsonRetry,
  normalizeTrack,
  NEW_HUB_BACKEND,
  FALLBACK_ART,
  fetchTrendingTracks,
  getTasteProfileRecommendations,
} from '../services/api';
import { tasteTopSeeds, tasteArtistKey } from '../services/storage';
import { TrackThumbImage } from '../services/useTrackThumb';
import { useLongPress } from '../hooks/useLongPress';

interface HomeRecentItemProps {
  track: Track;
  isSwipingRef: React.MutableRefObject<boolean>;
  onPlay: (track: Track) => void;
  onLongPress: (track: Track) => void;
}

const HomeRecentItem: React.FC<HomeRecentItemProps> = ({
  track,
  isSwipingRef,
  onPlay,
  onLongPress,
}) => {
  const { handlers, handleClick } = useLongPress({
    onLongPress: () => onLongPress(track),
    onClick: () => {
      if (!isSwipingRef.current) onPlay(track);
    },
  });

  return (
    <div
      onClick={handleClick}
      {...handlers}
      className="group flex items-center gap-2 sm:gap-2.5 p-1.5 sm:p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.99] border border-white/5 hover:border-white/15 cursor-pointer transition-all duration-200 overflow-hidden select-none"
    >
      <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow-sm">
        <TrackThumbImage
          track={track}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-[#ff6b1a] transition-colors">
          {track.title}
        </h4>
        <p className="text-[10px] sm:text-xs text-white/50 truncate mt-0.5">{track.artist}</p>
      </div>
    </div>
  );
};

interface HomeTrendingItemProps {
  track: Track;
  index: number;
  isLiked: boolean;
  onPlay: (track: Track) => void;
  onLike: (track: Track) => void;
  onLongPress: (track: Track) => void;
}

const HomeTrendingItem: React.FC<HomeTrendingItemProps> = ({
  track,
  index,
  isLiked,
  onPlay,
  onLike,
  onLongPress,
}) => {
  const { handlers, handleClick } = useLongPress({
    onLongPress: () => onLongPress(track),
    onClick: () => onPlay(track),
  });

  return (
    <div
      onClick={handleClick}
      {...handlers}
      className="snap-start flex items-center gap-3 p-2 sm:p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] active:scale-[0.99] border border-white/5 hover:border-white/15 cursor-pointer transition-all duration-200 group select-none"
    >
      <span className="w-5 text-center text-xs font-black text-white/40 group-hover:text-[#ff6b1a]">
        {index + 1}
      </span>
      <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow-sm">
        <TrackThumbImage
          track={track}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-[#ff6b1a] transition-colors">
          {track.title}
        </h4>
        <p className="text-[11px] sm:text-xs text-white/50 truncate mt-0.5">{track.artist}</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onLike(track);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="p-1.5 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-colors cursor-pointer"
        title={isLiked ? 'Unlike' : 'Like'}
      >
        <Heart
          className={`w-3.5 h-3.5 ${
            isLiked ? 'fill-[#ff6b1a] text-[#ff6b1a]' : ''
          }`}
        />
      </button>
    </div>
  );
};

export const HomeView: React.FC = () => {
  const {
    userProfile,
    setActivePane,
    openCollection,
    playTrack,
    toggleLikeTrack,
    showToast,
    setActionSheetTrack,
    setActionSheetMeta,
  } = useMusic();

  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  const [recommendedSongs, setRecommendedSongs] = useState<Track[]>([]);
  const [recommendedPlaylists, setRecommendedPlaylists] = useState<Track[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Horizontal carousel state for Recently Played
  const [recentPage, setRecentPage] = useState(0);
  const recentCarouselRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  // Horizontal carousel state for Trending Now
  const [trendingPage, setTrendingPage] = useState(0);
  const trendingCarouselRef = useRef<HTMLDivElement>(null);

  // Maximum 30 history tracks
  const recentlyPlayed = (userProfile.recentlyPlayed || []).slice(0, 30);
  const totalRecentPages = Math.min(5, Math.ceil(recentlyPlayed.length / 6));

  // 3 songs per column in 3-row layout
  const totalTrendingPages = Math.max(1, Math.ceil(trendingTracks.slice(0, 18).length / 3));

  const handleTrendingScroll = () => {
    if (!trendingCarouselRef.current) return;
    const { scrollLeft, clientWidth } = trendingCarouselRef.current;
    if (clientWidth > 0) {
      const isMobile = window.innerWidth < 640;
      const colWidth = isMobile ? clientWidth * 0.85 : clientWidth * 0.48;
      const pageIndex = Math.round(scrollLeft / colWidth);
      setTrendingPage(Math.min(totalTrendingPages - 1, Math.max(0, pageIndex)));
    }
  };

  const scrollToTrendingPage = (pageIdx: number) => {
    if (!trendingCarouselRef.current) return;
    const clientWidth = trendingCarouselRef.current.clientWidth;
    const isMobile = window.innerWidth < 640;
    const colWidth = isMobile ? clientWidth * 0.85 : clientWidth * 0.48;
    trendingCarouselRef.current.scrollTo({
      left: pageIdx * colWidth,
      behavior: 'smooth',
    });
    setTrendingPage(pageIdx);
  };

  const handleRecentScroll = () => {
    if (!recentCarouselRef.current) return;
    const { scrollLeft, clientWidth } = recentCarouselRef.current;
    if (clientWidth > 0) {
      const pageIndex = Math.round(scrollLeft / clientWidth);
      setRecentPage(Math.min(totalRecentPages - 1, Math.max(0, pageIndex)));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0 && recentPage < totalRecentPages - 1) {
        const next = recentPage + 1;
        setRecentPage(next);
        if (recentCarouselRef.current) {
          recentCarouselRef.current.scrollTo({
            left: next * recentCarouselRef.current.clientWidth,
            behavior: 'smooth',
          });
        }
      } else if (deltaX > 0 && recentPage > 0) {
        const prev = recentPage - 1;
        setRecentPage(prev);
        if (recentCarouselRef.current) {
          recentCarouselRef.current.scrollTo({
            left: prev * recentCarouselRef.current.clientWidth,
            behavior: 'smooth',
          });
        }
      }
    }
    setTimeout(() => {
      isSwiping.current = false;
    }, 100);
  };

  // 1. Load Real Global Trending Now Tracks
  const loadTrending = async (force = false) => {
    setLoadingTrending(true);
    try {
      const tracks = await fetchTrendingTracks(force);
      setTrendingTracks(tracks);
    } catch {
      // Keep fallback
    } finally {
      setLoadingTrending(false);
    }
  };

  // 2. Multi-Factor Taste Profile Engine for "Just For You"
  const loadRecommendations = async (manual = false) => {
    setLoadingRecs(true);
    try {
      const songs = await getTasteProfileRecommendations(userProfile, new Set(), 12);
      setRecommendedSongs(songs);

      // Playlists based on favorite taste
      const topSong = userProfile.likedSongs?.[0] || userProfile.recentlyPlayed?.[0];
      const plQuery = topSong ? `${topSong.artist} mix` : 'Top 50 Global Hits';
      const plRes = await fetchJsonRetry<any>(
        `${NEW_HUB_BACKEND}/api/search-proxy?q=${encodeURIComponent(plQuery)}&f=playlist`,
        2
      ).catch(() => ({ items: [] }));
      const plItems = Array.isArray(plRes) ? plRes : plRes?.items || [];
      const pls: Track[] = plItems.slice(0, 6).map((it: any) => normalizeTrack(it, 'playlist'));
      setRecommendedPlaylists(pls);

      if (manual) showToast('Recommendations updated');
    } catch {
      // Fallback gracefully
    } finally {
      setLoadingRecs(false);
    }
  };

  useEffect(() => {
    loadTrending();
    loadRecommendations();
  }, []);

  return (
    <div className="flex flex-col gap-10 pb-20 select-none">
      {/* SECTION 1 (TOP): Recently Played Horizontal 2-Column Carousel */}
      {recentlyPlayed.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Recently Played
              </h3>
              <p className="text-xs text-white/40 font-medium">Pick up right where you left off</p>
            </div>

            {/* Slide Page Indicator */}
            {totalRecentPages > 1 && (
              <span className="text-xs font-bold text-white/40">
                {recentPage + 1} / {totalRecentPages}
              </span>
            )}
          </div>

          {/* Paginated 3-Row x 2-Column Horizontal Carousel with Touch Swipe */}
          <div
            ref={recentCarouselRef}
            onScroll={handleRecentScroll}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none gap-4 pb-2"
          >
            {Array.from({ length: totalRecentPages }).map((_, pageIdx) => {
              const pageTracks = recentlyPlayed.slice(pageIdx * 6, pageIdx * 6 + 6);
              return (
                <div
                  key={pageIdx}
                  className="min-w-full w-full snap-start grid grid-cols-2 grid-rows-3 gap-2 sm:gap-2.5"
                >
                  {pageTracks.map((track) => (
                    <HomeRecentItem
                      key={track.id}
                      track={track}
                      isSwipingRef={isSwiping}
                      onPlay={(t) => playTrack(t)}
                      onLongPress={(t) => {
                        setActionSheetTrack(t);
                        setActionSheetMeta(null);
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Active Dot Pagination Bar with Dynamic Smooth Slide Indicator */}
          {totalRecentPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {Array.from({ length: totalRecentPages }).map((_, idx) => {
                const isActive = idx === recentPage;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (recentCarouselRef.current) {
                        recentCarouselRef.current.scrollTo({
                          left: idx * recentCarouselRef.current.clientWidth,
                          behavior: 'smooth',
                        });
                      }
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive ? 'w-6 bg-[#ff6b1a]' : 'w-1.5 bg-white/20 hover:bg-white/40'
                    }`}
                    aria-label={`Go to page ${idx + 1}`}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2 (MIDDLE): Trending Now (3 Rows of Compact Items) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#ff6b1a]" />
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Trending Now
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollToTrendingPage(Math.max(0, trendingPage - 1))}
              disabled={trendingPage === 0}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-20 transition-all cursor-pointer"
              aria-label="Previous trending songs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollToTrendingPage(Math.min(totalTrendingPages - 1, trendingPage + 1))}
              disabled={trendingPage >= totalTrendingPages - 1}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-20 transition-all cursor-pointer"
              aria-label="Next trending songs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => loadTrending(true)}
              disabled={loadingTrending}
              className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white transition-colors cursor-pointer ml-1 px-2 py-1 rounded-lg hover:bg-white/5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTrending ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {trendingTracks.length > 0 ? (
          <div
            ref={trendingCarouselRef}
            onScroll={handleTrendingScroll}
            className="grid grid-flow-col grid-rows-3 auto-cols-[85%] sm:auto-cols-[48%] md:auto-cols-[32%] overflow-x-auto gap-2.5 pb-2 scrollbar-none snap-x snap-mandatory"
          >
            {trendingTracks.slice(0, 18).map((track, i) => (
              <HomeTrendingItem
                key={track.id}
                track={track}
                index={i}
                isLiked={Boolean(userProfile.likedSongs?.some((s) => s.id === track.id))}
                onPlay={(t) => playTrack(t)}
                onLike={(t) => toggleLikeTrack(t)}
                onLongPress={(t) => {
                  setActionSheetTrack(t);
                  setActionSheetMeta(null);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-flow-col grid-rows-3 auto-cols-[85%] sm:auto-cols-[48%] md:auto-cols-[32%] overflow-x-auto gap-2.5 pb-2 scrollbar-none">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-white/[0.03] animate-pulse flex items-center gap-3">
                <div className="w-5 h-4 bg-white/5 rounded" />
                <div className="w-11 h-11 bg-white/5 rounded-lg flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3.5 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Dot Pagination Bar for Trending Now */}
        {totalTrendingPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {Array.from({ length: totalTrendingPages }).map((_, idx) => {
              const isActive = idx === Math.min(trendingPage, totalTrendingPages - 1);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => scrollToTrendingPage(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    isActive ? 'w-6 bg-[#ff6b1a]' : 'w-1.5 bg-white/20 hover:bg-white/40'
                  }`}
                  aria-label={`Go to trending page ${idx + 1}`}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3 (BOTTOM): Recommended / "Just For You" */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#ff6b1a]" />
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Just For You
            </h3>
          </div>
          <button
            type="button"
            onClick={() => loadRecommendations(true)}
            disabled={loadingRecs}
            className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white transition-colors cursor-pointer"
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

      {/* Curated Taste Playlists (Made For You) */}
      {recommendedPlaylists.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Made For You Playlists
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {recommendedPlaylists.map((pl) => (
              <TrackCard key={pl.id} track={pl} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
