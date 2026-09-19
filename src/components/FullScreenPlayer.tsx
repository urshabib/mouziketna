import React, { useState, useEffect, useRef } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  FileText,
  ListMusic,
  Moon,
  Plus,
  Tv,
  Maximize,
  Loader2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { canonicalThumbUrl } from '../services/api';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const FullScreenPlayer: React.FC = () => {
  const {
    activeTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    isLooping,
    isShuffle,
    togglePlay,
    seekTo,
    seekBy,
    toggleLoop,
    toggleShuffle,
    playNext,
    playPrevious,
    toggleLikeTrack,
    userProfile,
    isFullScreenOpen,
    setIsFullScreenOpen,
    setIsLyricsOpen,
    setIsQueueOpen,
    setModalAddToPlaylistTrack,
    sleepTimerRemaining,
    setSleepTimerMinutes,
    setSleepTimerEndOfSong,
    cancelSleepTimer,
  } = useMusic();

  const [isVideoMode, setIsVideoMode] = useState(false);
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!isFullScreenOpen || !activeTrack) return null;

  const isLiked = userProfile.likedSongs?.some((s) => s.id === activeTrack.id);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Touch swipe down to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.touches[0].clientY - touchStart;
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffset > 150) {
      setIsFullScreenOpen(false);
    }
    setDragOffset(0);
    setTouchStart(null);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateY(${dragOffset}px)`,
        transition: dragOffset > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#2a1708] via-[#120b05] to-black text-white px-6 sm:px-12 py-6 sm:py-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto select-none"
    >
      {/* Dynamic blurred ambient glow behind art */}
      <div
        className="absolute inset-0 opacity-40 blur-3xl pointer-events-none -z-10"
        style={{
          backgroundImage: `url(${activeTrack.thumb || canonicalThumbUrl(activeTrack.id)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-6 sm:mb-8">
        <button
          onClick={() => setIsFullScreenOpen(false)}
          className="p-2 -ml-2 text-white/70 hover:text-white transition-colors"
          title="Minimize"
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[11px] font-black tracking-widest text-white/50 uppercase">
            Now Playing
          </span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setIsLyricsOpen(true)}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Lyrics"
          >
            <FileText className="w-5 h-5" />
          </button>

          {/* Sleep Timer Popover */}
          <div className="relative">
            <button
              onClick={() => setIsSleepMenuOpen(!isSleepMenuOpen)}
              className={`p-2 transition-colors relative ${
                sleepTimerRemaining !== null ? 'text-[#ff6b1a]' : 'text-white/70 hover:text-white'
              }`}
              title="Sleep Timer"
            >
              <Moon className="w-5 h-5" />
              {sleepTimerRemaining !== null && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff6b1a] text-black text-[9px] font-extrabold flex items-center justify-center">
                  {Math.ceil(sleepTimerRemaining / 60)}m
                </span>
              )}
            </button>

            {isSleepMenuOpen && (
              <div className="absolute right-0 top-10 w-44 bg-[#1f1f23] rounded-2xl p-2 border border-white/10 shadow-2xl z-50 flex flex-col gap-1 text-sm font-semibold">
                <span className="text-[10px] uppercase font-bold text-white/40 px-3 py-1">Sleep Timer</span>
                <button
                  onClick={() => { setSleepTimerMinutes(5); setIsSleepMenuOpen(false); }}
                  className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                >
                  5 minutes
                </button>
                <button
                  onClick={() => { setSleepTimerMinutes(15); setIsSleepMenuOpen(false); }}
                  className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                >
                  15 minutes
                </button>
                <button
                  onClick={() => { setSleepTimerMinutes(30); setIsSleepMenuOpen(false); }}
                  className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                >
                  30 minutes
                </button>
                <button
                  onClick={() => { setSleepTimerMinutes(60); setIsSleepMenuOpen(false); }}
                  className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                >
                  1 hour
                </button>
                <button
                  onClick={() => { setSleepTimerEndOfSong(); setIsSleepMenuOpen(false); }}
                  className="px-3 py-2 text-left hover:bg-white/10 rounded-xl"
                >
                  End of current song
                </button>
                {sleepTimerRemaining !== null && (
                  <button
                    onClick={() => { cancelSleepTimer(); setIsSleepMenuOpen(false); }}
                    className="px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-xl border-t border-white/5 mt-1"
                  >
                    Turn off
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsQueueOpen(true)}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Queue"
          >
            <ListMusic className="w-5 h-5" />
          </button>

          <button
            onClick={() => setModalAddToPlaylistTrack(activeTrack)}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Add to Playlist"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsVideoMode(!isVideoMode)}
            className={`p-2 transition-colors ${
              isVideoMode ? 'text-[#ff6b1a]' : 'text-white/70 hover:text-white'
            }`}
            title="Toggle Video Mode"
          >
            <Tv className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Artwork or Video Container */}
      <div className="flex-1 flex items-center justify-center w-full max-w-sm sm:max-w-md mx-auto my-auto">
        {isVideoMode ? (
          <div className="w-full aspect-square rounded-3xl overflow-hidden shadow-2xl bg-black border border-white/10 relative">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${activeTrack.id}?autoplay=1&mute=1&controls=0&loop=1&playsinline=1`}
              className="w-full h-full border-0 pointer-events-none"
              title="YouTube Video"
              allow="autoplay"
            />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] bg-[#18181b] border border-white/10 group">
            <img
              src={activeTrack.thumb || canonicalThumbUrl(activeTrack.id)}
              alt={activeTrack.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Bottom Track Meta, Timeline & Controls */}
      <div className="w-full max-w-lg mx-auto flex flex-col gap-6 mt-6">
        {/* Title & Like */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-2xl sm:text-3xl font-black text-white truncate leading-tight">
              {activeTrack.title}
            </h2>
            <p className="text-base sm:text-lg text-white/60 truncate font-semibold mt-1">
              {activeTrack.artist}
            </p>
          </div>

          <button
            onClick={() => toggleLikeTrack(activeTrack)}
            className="p-3 text-white/70 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title={isLiked ? 'Unlike' : 'Like'}
          >
            <Heart
              className={`w-7 h-7 ${
                isLiked ? 'fill-[#ff6b1a] text-[#ff6b1a]' : 'text-white/60'
              }`}
            />
          </button>
        </div>

        {/* Progress Scrubber */}
        <div className="flex flex-col gap-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            step={0.1}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="custom-slider w-full show-thumb"
            style={{
              background: `linear-gradient(to right, var(--accent) ${progressPct}%, #3a3a3c ${progressPct}%)`,
            }}
          />
          <div className="flex justify-between text-xs font-bold text-white/40 tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-between px-2">
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-colors ${
              isShuffle ? 'text-[#ff6b1a]' : 'text-white/40 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle className="w-6 h-6" />
          </button>

          <button
            onClick={playPrevious}
            className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title="Previous"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          <button
            onClick={() => seekBy(-10)}
            className="p-2 text-white/60 hover:text-white active:scale-90 transition-all relative"
            title="Back 10s"
          >
            <RotateCcw className="w-6 h-6" />
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black pointer-events-none">
              10
            </span>
          </button>

          <button
            onClick={togglePlay}
            disabled={isBuffering}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-90 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-black" />
            ) : (
              <Play className="w-8 h-8 fill-black ml-1" />
            )}
          </button>

          <button
            onClick={() => seekBy(10)}
            className="p-2 text-white/60 hover:text-white active:scale-90 transition-all relative"
            title="Forward 10s"
          >
            <RotateCw className="w-6 h-6" />
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black pointer-events-none">
              10
            </span>
          </button>

          <button
            onClick={playNext}
            className="p-2 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title="Next"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          <button
            onClick={toggleLoop}
            className={`p-2 transition-colors ${
              isLooping ? 'text-[#ff6b1a]' : 'text-white/40 hover:text-white'
            }`}
            title={isLooping ? 'Repeat One' : 'Repeat Off'}
          >
            {isLooping ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};
