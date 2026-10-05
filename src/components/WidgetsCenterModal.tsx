import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sparkles,
  Smartphone,
  Apple,
  ExternalLink,
  Layers,
  Copy,
  Check,
  Music2,
  TrendingUp,
} from 'lucide-react';
import { FALLBACK_ART } from '../services/api';
import { useTrackThumb } from '../services/useTrackThumb';
import { Track } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const WidgetsCenterModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    activeTrack,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    playTrack,
    userProfile,
    showToast,
    setIsInstallModalOpen,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'preview' | 'ios' | 'android'>('preview');
  const [widgetType, setWidgetType] = useState<'now-playing' | 'top-songs'>('now-playing');
  const [copiedCode, setCopiedCode] = useState(false);

  const thumbSrc = useTrackThumb(activeTrack);

  if (!isOpen) return null;

  // Fallback track if nothing currently active: use first recently played or fallback
  const displayTrack: Track =
    activeTrack ||
    (userProfile.recentlyPlayed && userProfile.recentlyPlayed[0]) || {
      id: 'demo-track',
      title: 'MOUZIKETNA Player',
      artist: 'Select any track to stream',
      thumb: FALLBACK_ART,
      type: 'song',
    };

  const topSongs = userProfile.stats?.topSongs?.slice(0, 4) || [];

  const handleCopyShortcut = () => {
    const shortcutUrl = window.location.origin;
    navigator.clipboard.writeText(shortcutUrl);
    setCopiedCode(true);
    showToast('Widget launch URL copied to clipboard');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-[#14100c] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ff6b1a]/20 border border-[#ff6b1a]/30 flex items-center justify-center text-[#ff6b1a]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                <span>Home & Lock Widgets</span>
                <span className="text-[10px] bg-[#ff6b1a] text-black font-extrabold px-1.5 py-0.5 rounded-full uppercase">
                  iOS & Android
                </span>
              </h3>
              <p className="text-xs text-white/50">Spotify-style live widgets for your phone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-black/60 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'preview'
                ? 'bg-[#ff6b1a] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Widget Studio
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'ios'
                ? 'bg-[#ff6b1a] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>iOS Setup</span>
          </button>
          <button
            onClick={() => setActiveTab('android')}
            className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'android'
                ? 'bg-[#ff6b1a] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Setup</span>
          </button>
        </div>

        {/* Tab 1: Interactive Widget Studio / Preview */}
        {activeTab === 'preview' && (
          <div className="flex flex-col gap-4">
            {/* Widget Type Switcher */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setWidgetType('now-playing')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  widgetType === 'now-playing'
                    ? 'bg-white/20 text-white border border-[#ff6b1a]'
                    : 'bg-white/5 text-white/50 hover:text-white'
                }`}
              >
                1. Now Playing Widget
              </button>
              <button
                onClick={() => setWidgetType('top-songs')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  widgetType === 'top-songs'
                    ? 'bg-white/20 text-white border border-[#ff6b1a]'
                    : 'bg-white/5 text-white/50 hover:text-white'
                }`}
              >
                2. Most Played Songs Widget
              </button>
            </div>

            {/* Simulated Mobile Home Screen Widget Canvas */}
            <div className="relative p-5 rounded-3xl bg-gradient-to-b from-[#1f160e] via-[#100b07] to-black border border-white/10 shadow-2xl overflow-hidden flex flex-col items-center">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-extrabold tracking-widest uppercase text-white/30">
                Interactive Live Preview
              </div>

              {widgetType === 'now-playing' ? (
                /* Spotify Style Now Playing Widget (Medium / Compact) */
                <div className="w-full max-w-sm bg-[#1e1b18]/90 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3.5 mt-3 relative overflow-hidden group">
                  <div
                    className="absolute inset-0 opacity-25 blur-xl pointer-events-none -z-10"
                    style={{
                      backgroundImage: `url(${thumbSrc || displayTrack.thumb})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />

                  {/* Album Cover Art */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 relative shadow-md">
                    <img
                      src={thumbSrc || displayTrack.thumb || FALLBACK_ART}
                      alt={displayTrack.title}
                      className="w-full h-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/75 rounded text-[8px] font-black text-[#ff6b1a]">
                        LIVE
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-black text-white truncate">
                      {displayTrack.title}
                    </h4>
                    <p className="text-[11px] text-white/60 font-semibold truncate mt-0.5">
                      {displayTrack.artist}
                    </p>

                    {/* Progress Bar preview */}
                    <div className="w-full h-1 bg-white/20 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full bg-[#ff6b1a] rounded-full ${isPlaying ? 'w-2/3 animate-pulse' : 'w-1/3'}`} />
                    </div>
                  </div>

                  {/* Interactive Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={playPrevious}
                      className="p-1.5 text-white/60 hover:text-white transition-colors active:scale-90"
                      title="Previous"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="w-8 h-8 rounded-full bg-[#ff6b1a] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[#ff6b1a]/25"
                      title="Play/Pause"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                    </button>
                    <button
                      onClick={playNext}
                      className="p-1.5 text-white/60 hover:text-white transition-colors active:scale-90"
                      title="Next"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Spotify Style Most Played / Heavy Rotation Widget */
                <div className="w-full max-w-sm bg-[#1e1b18]/90 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-2xl mt-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-white">
                      <TrendingUp className="w-3.5 h-3.5 text-[#ff6b1a]" />
                      <span>Most Played Rotation</span>
                    </div>
                    <span className="text-[10px] text-white/40 font-bold">1-Tap Stream</span>
                  </div>

                  {topSongs.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {topSongs.map((song) => (
                        <div
                          key={song.id}
                          onClick={() => {
                            playTrack({
                              id: song.id,
                              title: song.title,
                              artist: song.artist,
                              thumb: song.thumb || null,
                              type: 'song',
                            });
                            showToast(`Playing ${song.title}`, true);
                          }}
                          className="flex items-center gap-2 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all cursor-pointer group"
                        >
                          <img
                            src={song.thumb || FALLBACK_ART}
                            alt={song.title}
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-white truncate group-hover:text-[#ff6b1a] transition-colors">
                              {song.title}
                            </p>
                            <p className="text-[9px] text-white/50 truncate font-semibold">
                              {song.artist}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-white/40 flex flex-col items-center gap-1">
                      <Music2 className="w-6 h-6 text-white/20" />
                      <span>Play a few songs to populate your Most Played widget</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-white/50 text-center mt-4">
                Both widgets update live with your account statistics and playback history.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: iOS Setup Guide */}
        {activeTab === 'ios' && (
          <div className="flex flex-col gap-3 text-xs leading-relaxed text-white/80">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
              <span className="text-lg">📱</span>
              <div>
                <h4 className="font-bold text-white text-sm mb-1">Native iOS Lock Screen Widget</h4>
                <p className="text-white/60">
                  Whenever you stream any track, iOS automatically enables the **Full-Color Dynamic Island & Lock Screen Media Widget** with interactive scrubbing, play/pause, and next/prev controls.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
              <span className="text-lg">⚡</span>
              <div>
                <h4 className="font-bold text-white text-sm mb-1">iOS Home Screen Widget via Shortcuts</h4>
                <p className="text-white/60 mb-2">
                  1. Open the **Shortcuts app** on your iPhone.
                  <br />
                  2. Add a new shortcut with action **Open URL**.
                  <br />
                  3. Paste the app link below, name it **MOUZIKA**, and choose a music icon.
                  <br />
                  4. On your Home Screen, long-press, tap **+**, search for Shortcuts, and select the widget size!
                </p>
                <button
                  onClick={handleCopyShortcut}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#ff6b1a] text-black font-extrabold text-[11px] active:scale-95 transition-all"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'URL Copied!' : 'Copy App Launch URL'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Android Setup Guide */}
        {activeTab === 'android' && (
          <div className="flex flex-col gap-3 text-xs leading-relaxed text-white/80">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
              <span className="text-lg">🤖</span>
              <div>
                <h4 className="font-bold text-white text-sm mb-1">Android Notification & Lock Screen Widget</h4>
                <p className="text-white/60">
                  Android automatically pins the high-res **Android 13+ Media Player Widget** to your notification shade and always-on display lock screen with album artwork waves.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
              <span className="text-lg">📲</span>
              <div>
                <h4 className="font-bold text-white text-sm mb-1">Android PWA Home Screen Installation</h4>
                <p className="text-white/60 mb-2">
                  Install the WebAPK to enable full widget support and offline playback cache:
                </p>
                <button
                  onClick={() => {
                    onClose();
                    setIsInstallModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#ff6b1a] text-black font-extrabold text-xs active:scale-95 transition-all shadow-md"
                >
                  <span>Install Web App (WebAPK)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/10 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
