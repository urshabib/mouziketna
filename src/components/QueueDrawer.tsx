import React, { useState, useRef, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { X, Trash2, ListMusic, Volume2 } from 'lucide-react';
import { canonicalThumbUrl } from '../services/api';

export const QueueDrawer: React.FC = () => {
  const {
    isQueueOpen,
    setIsQueueOpen,
    playbackQueue,
    queueIndex,
    activeTrack,
    playQueueIndex,
    removeFromQueue,
    clearQueue,
    t,
  } = useMusic();

  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentDragYRef = useRef(0);
  const hasMovedRef = useRef(false);
  const currentItemRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll instantly to currently playing track when opened
  useEffect(() => {
    if (isQueueOpen) {
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);
      currentDragYRef.current = 0;

      const timer = setTimeout(() => {
        if (currentItemRef.current) {
          currentItemRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isQueueOpen, queueIndex]);

  if (!isQueueOpen && !isClosing) return null;

  const close = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsQueueOpen(false);
      setIsClosing(false);
      setDragY(0);
      currentDragYRef.current = 0;
    }, 240);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    if (Math.abs(diff) > 4) {
      hasMovedRef.current = true;
    }
    if (diff > 0) {
      currentDragYRef.current = diff;
      setDragY(diff);
    } else {
      const resisted = diff * 0.15;
      currentDragYRef.current = resisted;
      setDragY(resisted);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentDragYRef.current > 70) {
      if (navigator.vibrate) {
        try {
          navigator.vibrate(15);
        } catch {}
      }
      close();
    } else {
      setDragY(0);
      currentDragYRef.current = 0;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startYRef.current = e.clientY;
    hasMovedRef.current = false;
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientY - startYRef.current;
      if (Math.abs(diff) > 4) hasMovedRef.current = true;
      if (diff > 0) {
        currentDragYRef.current = diff;
        setDragY(diff);
      } else {
        const resisted = diff * 0.15;
        currentDragYRef.current = resisted;
        setDragY(resisted);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);
      if (currentDragYRef.current > 70) {
        close();
      } else {
        setDragY(0);
        currentDragYRef.current = 0;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center sm:justify-end animate-in fade-in duration-200 select-none p-0 sm:p-4"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translateY(${Math.max(0, dragY)}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 200ms ease',
          opacity: isClosing ? 0 : 1,
        }}
        className="w-full sm:max-w-md bg-[#18181b] glass-panel h-[75vh] max-h-[75vh] sm:h-[82vh] sm:max-h-[82vh] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-3 shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-right duration-260"
      >
        {/* Android / iOS Gesture Grab Bar at the top (Swipe Down to Dismiss) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasMovedRef.current) {
              close();
            }
          }}
          className="w-full flex flex-col items-center justify-center py-2 -mt-1 cursor-grab active:cursor-grabbing touch-none select-none group"
          title="Drag down or tap to close queue"
        >
          <div className="w-12 h-1.5 rounded-full bg-white/30 group-hover:bg-white/60 group-active:bg-[#ff6b1a] transition-all duration-150" />
        </div>

        {/* Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between pb-3 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
        >
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-white">{t('nav.queue', 'Playback Queue')}</h3>
            <p className="text-xs text-white/50 font-medium">
              {playbackQueue.length ? `${playbackQueue.length} ${t('common.tracks', 'tracks')}` : t('nav.queueEmpty', 'Queue is empty')}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {playbackQueue.length > 0 && (
              <button
                type="button"
                onClick={clearQueue}
                className="p-2 text-white/40 hover:text-red-400 rounded-full transition-colors cursor-pointer"
                title={t('nav.clearQueue', 'Clear Queue')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="p-2 text-white/40 hover:text-white rounded-full transition-colors cursor-pointer"
              title={t('modal.close', 'Close')}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full Queue List (Auto-scrolled to Current Playing Track) */}
        <div ref={listContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
          {playbackQueue.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center text-center p-6 gap-3 text-white/40">
              <ListMusic className="w-12 h-12 text-white/20" />
              <h4 className="font-bold text-base text-white/70">{t('nav.queueEmpty', 'Your queue is empty')}</h4>
              <p className="text-xs max-w-xs leading-relaxed">
                {t('nav.queueEmptyDesc', 'Use the ⋮ menu on any track to add it to your queue or tap "Play Next".')}
              </p>
            </div>
          ) : (
            playbackQueue.map((track, i) => {
              const isCurrent = i === queueIndex;
              return (
                <div
                  key={`${track.id}-${i}`}
                  ref={isCurrent ? currentItemRef : null}
                  onClick={() => playQueueIndex(i)}
                  className={`group flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-[#ff6b1a]/20 border border-[#ff6b1a]/30 shadow-lg text-white'
                      : 'hover:bg-white/5 border border-transparent text-white/80'
                  }`}
                >
                  <div className="relative w-11 h-11 flex-shrink-0">
                    <img
                      src={track.thumb || canonicalThumbUrl(track.id)}
                      alt={track.title}
                      className="w-full h-full rounded-xl object-cover pointer-events-none"
                    />
                    {isCurrent && (
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                        <Volume2 className="w-4 h-4 text-[#ff6b1a] animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {isCurrent && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#ff6b1a] block leading-tight mb-0.5">
                        {t('nav.nowPlaying', 'Now Playing')}
                      </span>
                    )}
                    <h5
                      className={`text-sm font-semibold truncate ${
                        isCurrent ? 'text-[#ff6b1a] font-bold' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </h5>
                    <p className="text-xs text-white/50 truncate font-medium">{track.artist}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(i);
                    }}
                    className="p-1.5 opacity-60 sm:opacity-0 group-hover:opacity-100 text-white/40 hover:text-white rounded-full transition-all cursor-pointer"
                    title={t('nav.removeFromQueue', 'Remove from Queue')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
};
