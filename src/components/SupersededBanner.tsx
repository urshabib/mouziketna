import React from 'react';
import { useMusic } from '../context/MusicContext';
import { Smartphone, Laptop, Play, X, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SupersededBanner: React.FC = () => {
  const { supersededNotice, setSupersededNotice, claimPlaybackHere, currentDeviceName } = useMusic();

  if (!supersededNotice) return null;

  const isRemotePhone = /iPhone|Android|Mobile/i.test(supersededNotice.byDevice);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-[calc(4.8rem+env(safe-area-inset-bottom))] md:bottom-24 left-1/2 -translate-x-1/2 z-[70] w-[94%] max-w-lg"
      >
        <div className="relative overflow-hidden rounded-2xl bg-neutral-900/95 border border-[var(--accent)]/40 p-3.5 sm:p-4 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          {/* Subtle Ambient Background Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[var(--accent)]/15 blur-2xl pointer-events-none" />

          <div className="flex items-center gap-3 sm:gap-4 relative z-10">
            {/* Device Icon with Pulsing Live Indicator */}
            <div className="relative flex-shrink-0 w-11 h-11 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shadow-[0_0_15px_var(--accent-soft)]">
              {isRemotePhone ? (
                <Smartphone className="w-5 h-5" />
              ) : (
                <Laptop className="w-5 h-5" />
              )}
              {/* Green active ping dot */}
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#28c76f] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#28c76f]"></span>
              </span>
            </div>

            {/* Notification Text */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#28c76f] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#28c76f]">
                  Active on another device
                </span>
              </div>
              <h4 className="text-sm font-bold text-white truncate mt-0.5">
                Listening on {supersededNotice.byDevice}
              </h4>
              <p className="text-[11px] text-white/60 truncate mt-0.5">
                Playback paused here. Only 1 device can stream at a time.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => claimPlaybackHere()}
                className="px-3.5 py-2 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_12px_var(--accent-soft)] transition-all cursor-pointer"
                title={`Transfer playback to ${currentDeviceName}`}
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span className="whitespace-nowrap">Play Here</span>
              </button>

              <button
                onClick={() => setSupersededNotice(null)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
                title="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
