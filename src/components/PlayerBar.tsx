import React, { useMemo } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  ListMusic,
  Heart,
  Plus,
  FileText,
  Loader2,
} from 'lucide-react';
import { canonicalThumbUrl, FALLBACK_ART } from '../services/api';
import { useTrackThumb } from '../services/useTrackThumb';
import { TrackProgressBar } from './TrackProgressBar';
import { getSongHighlights } from '../services/songHighlights';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const PlayerBar: React.FC = () => {
  const {
    activeTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    isLooping,
    isShuffle,
    togglePlay,
    seekTo,
    seekBy,
    setVolumeLevel,
    toggleMute,
    toggleLoop,
    toggleShuffle,
    playNext,
    playPrevious,
    toggleLikeTrack,
    userProfile,
    setIsFullScreenOpen,
    setIsLyricsOpen,
    isLyricsOpen,
    setIsQueueOpen,
    isQueueOpen,
    setModalAddToPlaylistTrack,
    currentLyrics,
  } = useMusic();

  const thumbSrc = useTrackThumb(activeTrack);

  const highlights = useMemo(() => {
    return getSongHighlights(activeTrack, currentLyrics, duration);
  }, [activeTrack?.id, currentLyrics.mode, currentLyrics.lines, duration]);

  if (!activeTrack) return null;

  const isLiked = userProfile.likedSongs?.some((s) => s.id === activeTrack.id);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-5 h-5" />;
    if (volume < 50) return <Volume1 className="w-5 h-5" />;
    return <Volume2 className="w-5 h-5" />;
  };

  return (
    <div className="hidden md:flex h-24 bg-black/90 glass-panel border-t border-white/10 px-6 items-center justify-between z-30 select-none">
      {/* Left: Track Info & Secondary Actions */}
      <div className="flex items-center gap-4 w-1/4 min-w-[220px]">
        <div
          onClick={() => setIsFullScreenOpen(true)}
          className="relative w-14 h-14 rounded-xl overflow-hidden cursor-pointer shadow-lg group flex-shrink-0"
        >
          <img
            src={thumbSrc}
            alt={activeTrack.title}
            onError={(e) => {
              e.currentTarget.src = FALLBACK_ART;
            }}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h5
            onClick={() => setIsFullScreenOpen(true)}
            className="text-sm font-bold text-white truncate cursor-pointer hover:underline leading-snug"
          >
            {activeTrack.title}
          </h5>
          <p className="text-xs text-white/50 truncate font-medium mt-0.5">{activeTrack.artist}</p>
        </div>

        <div className="flex items-center gap-1 text-white/50">
          <button
            onClick={() => toggleLikeTrack(activeTrack)}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
              isLiked ? 'text-[#ff6b1a]' : 'hover:text-white'
            }`}
            title={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#ff6b1a]' : ''}`} />
          </button>
          <button
            onClick={() => setModalAddToPlaylistTrack(activeTrack)}
            className="p-2 rounded-full hover:bg-white/10 hover:text-white transition-colors"
            title="Add to Playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center: Controls & Timeline */}
      <div className="flex flex-col items-center gap-2 w-2/4 max-w-xl">
        <div className="flex items-center gap-5">
          <button
            onClick={toggleShuffle}
            className={`p-1.5 transition-colors ${
              isShuffle ? 'text-[#ff6b1a]' : 'text-white/40 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={playPrevious}
            className="p-1.5 text-white/70 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => seekBy(-10)}
            className="p-1.5 text-white/50 hover:text-white transition-colors relative"
            title="Back 10s"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black pointer-events-none">
              10
            </span>
          </button>

          <button
            onClick={togglePlay}
            disabled={isBuffering}
            className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-black" />
            ) : (
              <Play className="w-5 h-5 fill-black ml-0.5" />
            )}
          </button>

          <button
            onClick={() => seekBy(10)}
            className="p-1.5 text-white/50 hover:text-white transition-colors relative"
            title="Forward 10s"
          >
            <RotateCw className="w-4 h-4" />
            <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black pointer-events-none">
              10
            </span>
          </button>

          <button
            onClick={playNext}
            className="p-1.5 text-white/70 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={toggleLoop}
            className={`p-1.5 transition-colors ${
              isLooping ? 'text-[#ff6b1a]' : 'text-white/40 hover:text-white'
            }`}
            title={isLooping ? 'Repeat One' : 'Repeat Off'}
          >
            {isLooping ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        {/* Timeline Slider adhering to progressBarStyle and keyparts */}
        <div className="w-full">
          <TrackProgressBar
            currentTime={currentTime}
            duration={duration}
            highlights={highlights}
            seekTo={seekTo}
            inlineTimestamps={true}
            hideBadges={true}
          />
        </div>
      </div>

      {/* Right: Lyrics, Queue, Volume & Fullscreen */}
      <div className="flex items-center justify-end gap-3.5 w-1/4 min-w-[220px]">
        <button
          onClick={() => setIsLyricsOpen(!isLyricsOpen)}
          className={`p-2 rounded-full transition-colors ${
            isLyricsOpen ? 'text-[#ff6b1a] bg-white/10' : 'text-white/50 hover:text-white'
          }`}
          title="Lyrics"
        >
          <FileText className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsQueueOpen(!isQueueOpen)}
          className={`p-2 rounded-full transition-colors ${
            isQueueOpen ? 'text-[#ff6b1a] bg-white/10' : 'text-white/50 hover:text-white'
          }`}
          title="Queue"
        >
          <ListMusic className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 group">
          <button
            onClick={toggleMute}
            className="text-white/50 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {getVolumeIcon()}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolumeLevel(Number(e.target.value))}
            className="custom-slider w-24"
            style={{
              background: `linear-gradient(to right, var(--accent) ${isMuted ? 0 : volume}%, #3a3a3c ${isMuted ? 0 : volume}%)`,
            }}
          />
        </div>

        <button
          onClick={() => setIsFullScreenOpen(true)}
          className="p-2 text-white/50 hover:text-white transition-colors"
          title="Full Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const MiniPlayer: React.FC = () => {
  const {
    activeTrack,
    isPlaying,
    isBuffering,
    togglePlay,
    currentTime,
    duration,
    toggleLikeTrack,
    userProfile,
    setIsFullScreenOpen,
    setIsQueueOpen,
    playNext,
    playPrevious,
  } = useMusic();

  const thumbSrc = useTrackThumb(activeTrack);
  const [dragX, setDragX] = React.useState(0);
  const [swipeHint, setSwipeHint] = React.useState<'next' | 'prev' | null>(null);
  const startRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = React.useRef(false);

  if (!activeTrack) return null;

  const isLiked = userProfile.likedSongs?.some((s) => s.id === activeTrack.id);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a')) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    startRef.current = { x: clientX, y: clientY, time: Date.now() };
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!startRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const diffX = clientX - startRef.current.x;
    const diffY = clientY - startRef.current.y;

    if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
      isSwipingRef.current = true;
      setDragX(diffX * 0.7);
      if (diffX < -30) setSwipeHint('next');
      else if (diffX > 30) setSwipeHint('prev');
      else setSwipeHint(null);
    }
  };

  const handleTouchEnd = () => {
    if (!startRef.current) return;
    const diff = dragX;
    const wasSwiping = isSwipingRef.current;

    if (wasSwiping) {
      if (diff < -40) {
        playNext();
      } else if (diff > 40) {
        playPrevious();
      }
    } else {
      const elapsed = Date.now() - startRef.current.time;
      if (elapsed < 400 && Math.abs(diff) < 15) {
        setIsFullScreenOpen(true);
      }
    }

    startRef.current = null;
    isSwipingRef.current = false;
    setDragX(0);
    setSwipeHint(null);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      style={{
        transform: `translateX(${dragX}px)`,
        transition: dragX === 0 ? 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }}
      className="md:hidden fixed left-2.5 right-2.5 bottom-[calc(4.2rem+env(safe-area-inset-bottom))] z-30 bg-[#1c140d]/90 glass-panel border border-white/15 rounded-2xl p-2.5 flex items-center gap-3 shadow-2xl backdrop-blur-2xl cursor-pointer select-none touch-none active:scale-[0.99] transition-transform"
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0">
        <img
          src={thumbSrc}
          alt={activeTrack.title}
          onError={(e) => {
            e.currentTarget.src = FALLBACK_ART;
          }}
          className="w-11 h-11 rounded-xl object-cover shadow-md pointer-events-none"
          draggable={false}
        />
        {swipeHint && (
          <div className="absolute inset-0 bg-[#ff6b1a]/90 rounded-xl flex items-center justify-center text-black font-extrabold text-[10px]">
            {swipeHint === 'next' ? 'NEXT' : 'PREV'}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <h5 className="text-sm font-bold text-white truncate leading-snug">{activeTrack.title}</h5>
        <p className="text-xs text-white/50 truncate font-medium">{activeTrack.artist}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => toggleLikeTrack(activeTrack)}
          className={`p-2 rounded-full transition-colors ${
            isLiked ? 'text-[#ff6b1a]' : 'text-white/60 hover:text-white'
          }`}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-[#ff6b1a]' : ''}`} />
        </button>

        <button
          onClick={togglePlay}
          disabled={isBuffering}
          className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isBuffering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-black" />
          ) : (
            <Play className="w-4 h-4 fill-black ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setIsQueueOpen(true)}
          className="p-2 text-white/60 hover:text-white transition-colors"
          title="Queue"
        >
          <ListMusic className="w-5 h-5" />
        </button>
      </div>

      {/* Progress line */}
      <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#ff6b1a] transition-all duration-200"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
};
