import React from 'react';
import { useMusic } from '../context/MusicContext';
import { X, Trash2, Music2, ListMusic } from 'lucide-react';
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
  } = useMusic();

  if (!isQueueOpen) return null;

  return (
    <div
      onClick={() => setIsQueueOpen(false)}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200 select-none"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#18181b] glass-panel h-full border-l border-white/10 p-6 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="font-extrabold text-lg text-white">Playback Queue</h3>
            <p className="text-xs text-white/50 font-medium">
              {playbackQueue.length ? `${playbackQueue.length} tracks in queue` : 'Queue is empty'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {playbackQueue.length > 0 && (
              <button
                onClick={clearQueue}
                className="p-2 text-white/40 hover:text-red-400 rounded-full transition-colors"
                title="Clear Queue"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsQueueOpen(false)}
              className="p-2 text-white/40 hover:text-white rounded-full transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Currently Playing Card */}
        {activeTrack && (
          <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center gap-3">
            <img
              src={activeTrack.thumb || canonicalThumbUrl(activeTrack.id)}
              alt={activeTrack.title}
              className="w-12 h-12 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-[#ff6b1a]">
                Now Playing
              </span>
              <h4 className="text-sm font-bold text-white truncate">{activeTrack.title}</h4>
              <p className="text-xs text-white/50 truncate">{activeTrack.artist}</p>
            </div>
          </div>
        )}

        {/* Up Next List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
          {playbackQueue.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center text-center p-6 gap-3 text-white/40">
              <ListMusic className="w-12 h-12 text-white/20" />
              <h4 className="font-bold text-base text-white/70">Your queue is empty</h4>
              <p className="text-xs max-w-xs leading-relaxed">
                Use the ⋮ menu on any track to add it to your queue or tap "Play Next".
              </p>
            </div>
          ) : (
            playbackQueue.map((track, i) => {
              const isCurrent = i === queueIndex;
              return (
                <div
                  key={`${track.id}-${i}`}
                  onClick={() => playQueueIndex(i)}
                  className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isCurrent ? 'bg-[#ff6b1a]/15 text-white' : 'hover:bg-white/5 text-white/80'
                  }`}
                >
                  <img
                    src={track.thumb || canonicalThumbUrl(track.id)}
                    alt={track.title}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <h5
                      className={`text-sm font-semibold truncate ${
                        isCurrent ? 'text-[#ff6b1a]' : 'text-white'
                      }`}
                    >
                      {track.title}
                    </h5>
                    <p className="text-xs text-white/50 truncate font-medium">{track.artist}</p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(i);
                    }}
                    className="p-1.5 opacity-0 group-hover:opacity-100 text-white/40 hover:text-white rounded-full transition-all"
                    title="Remove from Queue"
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
