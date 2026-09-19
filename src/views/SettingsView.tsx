import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  Settings,
  Sparkles,
  Palette,
  HardDrive,
  Activity,
  RotateCcw,
  Check,
  ChevronRight,
  Wifi,
  Loader2,
  Trash2,
  Smartphone,
  Download,
} from 'lucide-react';
import {
  getTotalDownloadedSize,
  formatBytes,
  deleteAllDownloads,
} from '../services/storage';
import { NEW_HUB_BACKEND, fetchWithTimeout } from '../services/api';
import { InstallModal } from '../components/InstallModal';

const ACCENTS = [
  { id: 'orange', name: 'Orange', color: '#ff6b1a' },
  { id: 'purple', name: 'Purple', color: '#a259ff' },
  { id: 'blue', name: 'Blue', color: '#3b9dff' },
  { id: 'green', name: 'Green', color: '#28c76f' },
  { id: 'pink', name: 'Pink', color: '#ff5fa2' },
  { id: 'red', name: 'Red', color: '#f15e6c' },
  { id: 'gold', name: 'Gold', color: '#d4af37' },
  { id: 'ocean', name: 'Ocean', color: '#06b6d4' },
  { id: 'emerald', name: 'Emerald', color: '#10b981' },
  { id: 'crimson', name: 'Crimson', color: '#e11d48' },
  { id: 'sunset', name: 'Sunset', color: '#fb7185' },
  { id: 'mono', name: 'Monochrome', color: '#d8d8d8' },
];

const LYRICS_COLORS = [
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'orange', name: 'Orange', color: '#ff6b1a' },
  { id: 'purple', name: 'Purple', color: '#a259ff' },
  { id: 'blue', name: 'Blue', color: '#3b9dff' },
  { id: 'green', name: 'Green', color: '#28c76f' },
  { id: 'pink', name: 'Pink', color: '#ff5fa2' },
  { id: 'gold', name: 'Gold', color: '#e8c968' },
  { id: 'ocean', name: 'Ocean', color: '#22d3ee' },
  { id: 'emerald', name: 'Emerald', color: '#34d399' },
  { id: 'crimson', name: 'Crimson', color: '#fb7185' },
  { id: 'sunset', name: 'Sunset', color: '#fda4af' },
];

const PRESETS = [
  { id: 'classic', name: 'Classic', desc: 'Minimal Dark & Orange', accent: '#ff6b1a', glass: false, theme: 'dark', tint: 'none', lyrics: 'white' },
  { id: 'glass', name: 'Liquid Glass', desc: 'Frosted Translucent Blur', accent: '#ff8b47', glass: true, theme: 'dark', tint: 'none', lyrics: 'white' },
  { id: 'monochrome', name: 'Monochrome', desc: 'Clean White & Gray', accent: '#d8d8d8', glass: false, theme: 'dark', tint: 'none', lyrics: 'mono' },
  { id: 'daylight', name: 'Daylight', desc: 'Crisp Modern Light Mode', accent: '#3b9dff', glass: false, theme: 'light', tint: 'none', lyrics: 'white' },
  { id: 'gold', name: 'Gold Luxury', desc: 'Warm Amber & Brass Glow', accent: '#d4af37', glass: false, theme: 'dark', tint: 'gold', lyrics: 'gold' },
  { id: 'midnight', name: 'Midnight', desc: 'Deep Violet & Cyber Glow', accent: '#a259ff', glass: true, theme: 'dark', tint: 'purple', lyrics: 'purple' },
  { id: 'ocean', name: 'Ocean Wave', desc: 'Cyan & Deep Sea Azure', accent: '#06b6d4', glass: false, theme: 'dark', tint: 'ocean', lyrics: 'ocean' },
  { id: 'emerald', name: 'Emerald', desc: 'Forest Green Atmosphere', accent: '#10b981', glass: false, theme: 'dark', tint: 'emerald', lyrics: 'emerald' },
  { id: 'crimson', name: 'Crimson Night', desc: 'Velvet Ruby & Frosted Glass', accent: '#e11d48', glass: true, theme: 'dark', tint: 'crimson', lyrics: 'crimson' },
  { id: 'sunset', name: 'Sunset Bloom', desc: 'Peach & Coral Dusk', accent: '#fb7185', glass: false, theme: 'dark', tint: 'sunset', lyrics: 'sunset' },
];

export const SettingsView: React.FC = () => {
  const {
    userProfile,
    syncProfile,
    openCollection,
    downloadedSet,
    setModalConfirm,
    showToast,
  } = useMusic();

  const [downloadSize, setDownloadSize] = useState('0 MB');
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [serverStats, setServerStats] = useState<Record<string, { status: string; latency?: number }>>({});
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    getTotalDownloadedSize().then((bytes) => setDownloadSize(formatBytes(bytes)));
  }, [downloadedSet]);

  const runServerDiagnostics = async () => {
    setDiagnosticsRunning(true);
    setServerStats({});

    const tests = [
      { name: 'Cloudflare Worker API', url: `${NEW_HUB_BACKEND}/api/list-users` },
      { name: 'Primary Saavn Resolver', url: 'https://fast-saavn.vercel.app/api?title=test&artist=test' },
      { name: 'Omada Invidious Mirror', url: 'https://yt.omada.cafe/api/v1/videos/dQw4w9WgXcQ' },
      { name: 'Schenkel Invidious Mirror', url: 'https://invidious.schenkel.eti.br/api/v1/videos/dQw4w9WgXcQ' },
    ];

    const results: Record<string, { status: string; latency?: number }> = {};

    for (const t of tests) {
      const start = Date.now();
      try {
        const r = await fetchWithTimeout(t.url, 4000);
        const lat = Date.now() - start;
        results[t.name] = {
          status: r.status < 500 ? 'Healthy' : `HTTP ${r.status}`,
          latency: lat,
        };
      } catch {
        results[t.name] = { status: 'Timeout / Unreachable' };
      }
    }

    setServerStats(results);
    setDiagnosticsRunning(false);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    syncProfile({
      ...userProfile,
      liquidGlass: preset.glass,
      theme: preset.theme as any,
      accentColor: preset.accent === '#ff6b1a' ? 'orange' : preset.id === 'daylight' ? 'blue' : preset.id,
      lyricsColor: preset.lyrics,
      presetTint: preset.tint,
      activePreset: preset.id,
    });
    showToast(`"${preset.name}" theme applied`);
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl pb-24 select-none">
      <div>
        <h2 className="text-3xl font-black text-white tracking-tight">Settings</h2>
        <p className="text-xs text-white/50 font-semibold mt-1">
          Customize audio playback, storage, streaming quality, and interface themes.
        </p>
      </div>

      {/* 1. PLAYBACK & AUDIO QUALITY */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-1 border-b border-white/10">
          <Settings className="w-4 h-4 text-[#ff6b1a]" />
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-white/70">
            Audio & Downloads
          </h3>
        </div>

        {/* Manual Download Quality */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col gap-3">
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Manual Download Quality</h4>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Green Icon
              </span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              Audio bitrate when you choose to download songs or playlists for offline listening.
            </p>
          </div>

          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1">
            {[
              { id: 'high', label: 'High (320 kbps)' },
              { id: 'saver', label: 'Saver (96 kbps)' },
              { id: 'ultra', label: 'Ultra (48 kbps)' },
            ].map((opt) => {
              const current = userProfile.downloadQuality || (userProfile.dataSaverLevel === 'ultra' ? 'ultra' : userProfile.dataSaverLevel === 'saver' ? 'saver' : 'high');
              const isSelected = current === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    syncProfile({
                      ...userProfile,
                      downloadQuality: opt.id as any,
                      dataSaverLevel: opt.id === 'high' ? 'off' : (opt.id as any),
                      dataSaver: opt.id !== 'high',
                    });
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#ff6b1a] text-black shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto Cache Played Songs */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-white">Automatically Cache Played Songs</h4>
                <span className="text-[11px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                  Blue Icon
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Silently caches played songs in the background so replaying is instant without internet.
              </p>
            </div>
            <button
              onClick={() => {
                syncProfile({ ...userProfile, autoCachePlayed: !userProfile.autoCachePlayed });
              }}
              className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
                userProfile.autoCachePlayed ? 'bg-[#ff6b1a]' : 'bg-white/20'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                  userProfile.autoCachePlayed ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Sub-menu: Auto-Cache Quality */}
          {userProfile.autoCachePlayed && (
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white/90">Auto-Cache Quality</span>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    Saver quality is used by default to protect device storage. If you manually download that song later, it will automatically upgrade to High Quality.
                  </p>
                </div>
              </div>

              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1 max-w-sm">
                {[
                  { id: 'saver', label: 'Saver (96 kbps) • Default' },
                  { id: 'ultra', label: 'Ultra Saver (48 kbps)' },
                ].map((opt) => {
                  const current = userProfile.autoCacheQuality || 'saver';
                  const isSelected = current === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        syncProfile({
                          ...userProfile,
                          autoCacheQuality: opt.id as any,
                        });
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-sky-500 text-black shadow-md'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Offline Lyrics */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h4 className="font-bold text-sm text-white">Save Lyrics Offline with Downloads</h4>
            <p className="text-xs text-white/50 mt-0.5">
              Downloads synchronized lyrics alongside songs for full offline karaoke playback.
            </p>
          </div>
          <button
            onClick={() => {
              syncProfile({ ...userProfile, downloadLyricsOffline: !userProfile.downloadLyricsOffline });
            }}
            className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
              userProfile.downloadLyricsOffline ? 'bg-[#ff6b1a]' : 'bg-white/20'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                userProfile.downloadLyricsOffline ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* 2. APPEARANCE & THEME */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-1 border-b border-white/10">
          <Palette className="w-4 h-4 text-[#ff6b1a]" />
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-white/70">
            Appearance & Themes
          </h3>
        </div>

        {/* Liquid Glass Frosted Mode */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h4 className="font-bold text-sm text-white">Liquid Glass Theme</h4>
            <p className="text-xs text-white/50 mt-0.5">
              Enables translucent blurred iOS-style glassmorphism on panels, menus, and overlays.
            </p>
          </div>
          <button
            onClick={() => {
              syncProfile({ ...userProfile, liquidGlass: !userProfile.liquidGlass });
            }}
            className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
              userProfile.liquidGlass ? 'bg-[#ff6b1a]' : 'bg-white/20'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                userProfile.liquidGlass ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Light Mode Switch */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h4 className="font-bold text-sm text-white">Light Mode</h4>
            <p className="text-xs text-white/50 mt-0.5">
              Toggle between high-contrast Dark mode and modern Daylight theme.
            </p>
          </div>
          <button
            onClick={() => {
              syncProfile({ ...userProfile, theme: userProfile.theme === 'light' ? 'dark' : 'light' });
            }}
            className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
              userProfile.theme === 'light' ? 'bg-[#ff6b1a]' : 'bg-white/20'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                userProfile.theme === 'light' ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Accent Color Swatches */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col gap-3">
          <h4 className="font-bold text-sm text-white">Accent Color</h4>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((acc) => (
              <button
                key={acc.id}
                onClick={() => syncProfile({ ...userProfile, accentColor: acc.id })}
                style={{ backgroundColor: acc.color }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-md ${
                  userProfile.accentColor === acc.id ? 'ring-2 ring-white scale-110' : ''
                }`}
                title={acc.name}
              >
                {userProfile.accentColor === acc.id && (
                  <Check className="w-4 h-4 text-black stroke-[3]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Lyrics Highlight Color Swatches */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col gap-3">
          <h4 className="font-bold text-sm text-white">Lyrics Karaoke Highlight Color</h4>
          <div className="flex flex-wrap gap-2.5">
            {LYRICS_COLORS.map((lyr) => (
              <button
                key={lyr.id}
                onClick={() => syncProfile({ ...userProfile, lyricsColor: lyr.id })}
                style={{ backgroundColor: lyr.color }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-md ${
                  userProfile.lyricsColor === lyr.id ? 'ring-2 ring-white scale-110' : ''
                }`}
                title={lyr.name}
              >
                {userProfile.lyricsColor === lyr.id && (
                  <Check className="w-4 h-4 text-black stroke-[3]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Curated Preset Themes */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col gap-3">
          <h4 className="font-bold text-sm text-white">One-Tap Preset Themes</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                  userProfile.activePreset === p.id
                    ? 'border-[#ff6b1a] bg-[#ff6b1a]/10'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06]'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.accent }}
                />
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs text-white block truncate">{p.name}</span>
                  <span className="text-[10px] text-white/40 block truncate">{p.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. STORAGE & OFFLINE DOWNLOADS */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-1 border-b border-white/10">
          <HardDrive className="w-4 h-4 text-[#ff6b1a]" />
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-white/70">
            Storage & Offline Files
          </h3>
        </div>

        <div
          onClick={() => openCollection('downloads')}
          className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.07] transition-colors"
        >
          <div className="flex flex-col">
            <h4 className="font-bold text-sm text-white">Manage Downloaded Songs</h4>
            <p className="text-xs text-white/50 mt-0.5">
              {downloadedSet.size} offline tracks stored • {downloadSize}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/40" />
        </div>

        <button
          onClick={() => {
            setModalConfirm({
              title: 'Clear all offline music?',
              text: 'This will delete all downloaded audio files from your browser storage.',
              onConfirm: async () => {
                await deleteAllDownloads();
                showToast('All downloads cleared', true);
              },
            });
          }}
          className="py-3 px-4 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete All Downloaded Songs</span>
        </button>
      </section>

      {/* 4. SERVER HEALTH & STREAM DIAGNOSTICS */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-1 border-b border-white/10">
          <Activity className="w-4 h-4 text-[#ff6b1a]" />
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-white/70">
            Server Health Diagnostics
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-white">Live Mirror & API Latency</h4>
              <p className="text-xs text-white/50 mt-0.5">
                Test connectivity to your Cloudflare Worker, Saavn server, and video stream mirrors.
              </p>
            </div>
            <button
              onClick={runServerDiagnostics}
              disabled={diagnosticsRunning}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 transition-all"
            >
              {diagnosticsRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-[#ff6b1a]" />
              )}
              <span>Run Ping Test</span>
            </button>
          </div>

          {Object.keys(serverStats).length > 0 && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
              {Object.entries(serverStats).map(([name, stat]) => (
                <div key={name} className="flex items-center justify-between text-xs py-1">
                  <span className="font-medium text-white/70">{name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold ${
                        stat.status === 'Healthy' ? 'text-[#28c76f]' : 'text-red-400'
                      }`}
                    >
                      {stat.status}
                    </span>
                    {stat.latency !== undefined && (
                      <span className="text-white/40 tabular-nums">({stat.latency}ms)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. APP INSTALLATION & PWA */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-1 border-b border-white/10">
          <Smartphone className="w-4 h-4 text-[#ff6b1a]" />
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-white/70">
            Install MOUZIKA to Device
          </h3>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
              <img
                src="./apple-touch-icon.png"
                alt="App Icon"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Full Screen App Experience</h4>
              <p className="text-xs text-white/50 mt-0.5 max-w-sm">
                Install MOUZIKA directly onto your Android, iPhone, or Desktop to run standalone without browser tabs or URL bars.
              </p>
            </div>
          </div>

          <button
            id="settings-install-app-btn"
            onClick={() => setShowInstallModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-95 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b1a]/20 transition-all cursor-pointer flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Install App</span>
          </button>
        </div>
      </section>

      {/* Reset button */}
      <button
        onClick={() => {
          setModalConfirm({
            title: 'Reset all settings to defaults?',
            text: 'Your theme, quality, and appearance preferences will be restored to defaults. Your saved songs and playlists are safe.',
            onConfirm: () => {
              syncProfile({
                ...userProfile,
                dataSaver: false,
                dataSaverLevel: 'off',
                downloadLyricsOffline: false,
                autoCachePlayed: true,
                liquidGlass: true,
                theme: 'dark',
                accentColor: 'orange',
                lyricsColor: 'white',
                presetTint: 'none',
                activePreset: 'glass',
              });
              showToast('Settings reset to defaults');
            },
          });
        }}
        className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white font-semibold text-xs transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset Preferences to Default</span>
      </button>

      {showInstallModal && (
        <InstallModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
        />
      )}
    </div>
  );
};
