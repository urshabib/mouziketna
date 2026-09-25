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
  UploadCloud,
  FileCode,
  RefreshCw,
  Edit3,
  CheckCircle2,
  Volume2,
  Layers,
  Sun,
  Moon,
  Mic2,
  Sliders,
  Image as ImageIcon,
  CheckCheck,
  Maximize2,
} from 'lucide-react';
import {
  getTotalDownloadedSize,
  formatBytes,
  deleteAllDownloads,
} from '../services/storage';
import { NEW_HUB_BACKEND, fetchWithTimeout } from '../services/api';
import {
  LOGO_PRESETS,
  getAppLogoSrc,
  applyCustomAppLogo,
  applyCustomAppName,
  getStoredAppName,
  DEFAULT_APP_NAME,
  forceAppUpdateAndRefresh,
  hasPwaInstallPrompt,
  promptPwaInstall,
} from '../services/pwa';
import { LogoCropperModal } from '../components/LogoCropperModal';

const ACCENTS = [
  { id: 'orange', name: 'Flame Orange', color: '#ff6b1a' },
  { id: 'purple', name: 'Cosmic Purple', color: '#a259ff' },
  { id: 'blue', name: 'Electric Blue', color: '#3b9dff' },
  { id: 'green', name: 'Neon Green', color: '#28c76f' },
  { id: 'emerald', name: 'Emerald', color: '#10b981' },
  { id: 'pink', name: 'Hot Pink', color: '#ff5fa2' },
  { id: 'red', name: 'Crimson Red', color: '#f15e6c' },
  { id: 'gold', name: 'Luxury Gold', color: '#d4af37' },
  { id: 'ocean', name: 'Ocean Cyan', color: '#06b6d4' },
  { id: 'sunset', name: 'Sunset Rose', color: '#fb7185' },
  { id: 'mono', name: 'Monochrome', color: '#d8d8d8' },
];

const LYRICS_COLORS = [
  { id: 'white', name: 'Pure White', color: '#ffffff' },
  { id: 'orange', name: 'Flame Orange', color: '#ff6b1a' },
  { id: 'purple', name: 'Cosmic Purple', color: '#a259ff' },
  { id: 'blue', name: 'Electric Blue', color: '#3b9dff' },
  { id: 'green', name: 'Neon Green', color: '#28c76f' },
  { id: 'emerald', name: 'Emerald', color: '#34d399' },
  { id: 'pink', name: 'Hot Pink', color: '#ff5fa2' },
  { id: 'gold', name: 'Luxury Gold', color: '#e8c968' },
  { id: 'ocean', name: 'Ocean Cyan', color: '#22d3ee' },
  { id: 'sunset', name: 'Sunset Rose', color: '#fda4af' },
];

const PRESETS = [
  { id: 'classic', name: 'Classic Dark', desc: 'Minimal Obsidian & Orange', accentColor: 'orange', accentHex: '#ff6b1a', glass: false, theme: 'dark', tint: 'none', lyrics: 'white' },
  { id: 'glass', name: 'Liquid Glass', desc: 'Translucent Frosted Blur', accentColor: 'orange', accentHex: '#ff8b47', glass: true, theme: 'dark', tint: 'none', lyrics: 'white' },
  { id: 'midnight', name: 'Midnight Violet', desc: 'Deep Violet Cyber Glow', accentColor: 'purple', accentHex: '#a259ff', glass: true, theme: 'dark', tint: 'purple', lyrics: 'purple' },
  { id: 'daylight', name: 'Daylight', desc: 'Crisp Modern Light Mode', accentColor: 'blue', accentHex: '#3b9dff', glass: false, theme: 'light', tint: 'none', lyrics: 'white' },
];

type SettingsTab = 'all' | 'audio' | 'appearance' | 'app' | 'system';

export const SettingsView: React.FC = () => {
  const {
    userProfile,
    syncProfile,
    openCollection,
    downloadedSet,
    clearAllDownloads,
    setModalConfirm,
    showToast,
    setIsInstallModalOpen,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<SettingsTab>('all');
  const [downloadSize, setDownloadSize] = useState('0 MB');
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [serverStats, setServerStats] = useState<Record<string, { status: string; latency?: number }>>({});
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [showFileGuide, setShowFileGuide] = useState(false);
  const [appNameInput, setAppNameInput] = useState<string>(
    userProfile.customAppName || getStoredAppName() || DEFAULT_APP_NAME
  );
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);

  useEffect(() => {
    const check =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(check);
  }, []);

  // Restore active tab and scroll to logo section after auto-reload
  useEffect(() => {
    try {
      const restoreRaw = sessionStorage.getItem('mouzika_restore_after_logo');
      if (restoreRaw) {
        const data = JSON.parse(restoreRaw);
        if (data.tab) setActiveTab(data.tab);
        sessionStorage.removeItem('mouzika_restore_after_logo');
        setTimeout(() => {
          const el = document.getElementById(data.anchor || 'logo-customizer-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (data.name) {
            showToast(`Emblem switched to ${data.name}`);
          }
        }, 180);
      }
    } catch {
      sessionStorage.removeItem('mouzika_restore_after_logo');
    }
  }, []);

  useEffect(() => {
    if (userProfile.customAppName) {
      setAppNameInput(userProfile.customAppName);
    }
  }, [userProfile.customAppName]);

  useEffect(() => {
    getTotalDownloadedSize().then((bytes) => setDownloadSize(formatBytes(bytes)));
  }, [downloadedSet]);

  const handleSaveAppName = async (nameToSave: string) => {
    const clean = nameToSave.trim() || DEFAULT_APP_NAME;
    setAppNameInput(clean);
    await applyCustomAppName(clean);
    syncProfile({ ...userProfile, customAppName: clean });
    setNameSavedSuccess(true);
    showToast(`App shortcut name updated to "${clean}"`);
    setTimeout(() => setNameSavedSuccess(false), 2500);
  };

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
      accentColor: preset.accentColor,
      lyricsColor: preset.lyrics,
      presetTint: preset.tint,
      activePreset: preset.id,
    });
    showToast(`"${preset.name}" theme applied`);
  };

  const handleTriggerInstall = async () => {
    if (hasPwaInstallPrompt()) {
      const res = await promptPwaInstall();
      if (res.outcome === 'accepted') {
        showToast('App installed successfully!');
        return;
      }
    }
    setIsInstallModalOpen(true);
  };

  const showAudio = activeTab === 'all' || activeTab === 'audio';
  const showAppearance = activeTab === 'all' || activeTab === 'appearance';
  const showApp = !isStandalone && (activeTab === 'all' || activeTab === 'app');
  const showSystem = activeTab === 'all' || activeTab === 'system';

  return (
    <div className="flex flex-col gap-6 max-w-4xl pb-24 select-none">
      {/* Header & Category Pills */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Settings</h2>
          <p className="text-xs text-white/50 font-medium mt-0.5">
            Manage audio quality, interface styling, home screen app shortcuts, and offline storage.
          </p>
        </div>

        {/* Quick Category Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Settings', icon: Sliders },
            { id: 'audio', label: 'Audio & Offline', icon: Volume2 },
            { id: 'appearance', label: 'Theme & Colors', icon: Palette },
            ...(!isStandalone ? [{ id: 'app', label: 'App & Logo', icon: Smartphone }] : []),
            { id: 'system', label: 'Storage & System', icon: HardDrive },
          ].map((cat) => {
            const isCurrent = activeTab === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id as SettingsTab)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-[#ff6b1a] text-black shadow-md shadow-[#ff6b1a]/20'
                    : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. AUDIO & DOWNLOADS */}
      {showAudio && (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-1 border-b border-white/10">
            <Volume2 className="w-4 h-4 text-[#ff6b1a]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white/70">
              Audio & Offline Downloads
            </h3>
          </div>

          {/* Manual Download Quality Card */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Download Audio Quality</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Offline Tracks
                  </span>
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Choose audio fidelity when downloading tracks to your offline library.
                </p>
              </div>
            </div>

            {/* Visual Quality Selector Grid (2x2 Horizontal Layout) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {[
                {
                  id: 'stable',
                  title: 'Balanced',
                  kbps: '160 kbps',
                  desc: 'Fast download • Crystal clear',
                  badge: 'Recommended',
                },
                {
                  id: 'high',
                  title: 'Studio High',
                  kbps: '320 kbps',
                  desc: 'Master fidelity lossless',
                  badge: 'Best on WiFi',
                },
                {
                  id: 'saver',
                  title: 'Data Saver',
                  kbps: '96 kbps',
                  desc: 'Saves storage & bandwidth',
                  badge: 'Lightweight',
                },
                {
                  id: 'ultra',
                  title: 'Ultra Saver',
                  kbps: '48 kbps',
                  desc: 'Ultra minimal file size',
                  badge: 'Compact',
                },
              ].map((tier) => {
                const current = userProfile.downloadQuality || 'stable';
                const isSelected = current === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => {
                      syncProfile({
                        ...userProfile,
                        downloadQuality: tier.id as any,
                        dataSaverLevel: tier.id === 'high' ? 'off' : (tier.id as any),
                        dataSaver: tier.id !== 'high' && tier.id !== 'stable',
                      });
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#ff6b1a] bg-[#ff6b1a]/10 shadow-md shadow-[#ff6b1a]/10'
                        : 'border-white/5 bg-black/40 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-bold text-xs text-white leading-tight">{tier.title}</div>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-[#ff6b1a] stroke-[3] flex-shrink-0" />
                      ) : (
                        <span className="text-[10px] text-white/30 font-medium">{tier.kbps}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/50 leading-snug line-clamp-1">{tier.desc}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                      <span className="text-[#ff6b1a] font-semibold">{tier.kbps}</span>
                      <span className="text-white/40">{tier.badge}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automatic Background Cache */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">Cache Songs as You Listen</h4>
                  <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                    Seamless Replay
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Automatically keeps songs in temporary offline cache while playing so replays don't use internet.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !userProfile.autoCachePlayed;
                  syncProfile({ ...userProfile, autoCachePlayed: next });
                }}
                className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  userProfile.autoCachePlayed ? 'bg-[#ff6b1a]' : 'bg-white/20'
                }`}
                aria-label="Toggle Auto Cache"
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                    userProfile.autoCachePlayed ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Sub-setting: Auto-Cache Quality */}
            {userProfile.autoCachePlayed && (
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white/90">Auto-Cache Audio Quality:</span>
                  <p className="text-[11px] text-white/40">Balanced 160k is recommended for fast streaming.</p>
                </div>

                <div className="flex items-center justify-center bg-black/50 p-1.5 rounded-xl border border-white/10 gap-1.5 w-full sm:w-80">
                  {[
                    { id: 'stable', label: 'Balanced', sub: '160k' },
                    { id: 'high', label: 'High', sub: '320k' },
                    { id: 'saver', label: 'Saver', sub: '96k' },
                  ].map((opt) => {
                    const current = userProfile.autoCacheQuality || 'stable';
                    const isSelected = current === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          syncProfile({ ...userProfile, autoCacheQuality: opt.id as any });
                        }}
                        className={`flex-1 text-center py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#ff6b1a] text-black shadow-md font-extrabold scale-[1.02]'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span>{opt.label}</span>{' '}
                        <span className={`text-[10px] ${isSelected ? 'text-black/70 font-bold' : 'text-white/40'}`}>
                          ({opt.sub})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Unified Offline Features Card (Artwork + Lyrics) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Offline Lyrics */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <Mic2 className="w-3.5 h-3.5 text-[#ff6b1a]" />
                  <h4 className="font-bold text-xs text-white">Offline Karaoke Lyrics</h4>
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Saves synced lyrics with downloaded songs for full offline karaoke.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !userProfile.downloadLyricsOffline;
                  syncProfile({ ...userProfile, downloadLyricsOffline: next });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  userProfile.downloadLyricsOffline ? 'bg-[#ff6b1a]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    userProfile.downloadLyricsOffline ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Offline Artwork */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#ff6b1a]" />
                    <h4 className="font-bold text-xs text-white">Offline Song Pictures</h4>
                  </div>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    Saves artwork so covers remain visible offline.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const current = userProfile.downloadArtOffline !== false;
                    syncProfile({ ...userProfile, downloadArtOffline: !current });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                    userProfile.downloadArtOffline !== false ? 'bg-[#ff6b1a]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      userProfile.downloadArtOffline !== false ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {userProfile.downloadArtOffline !== false && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                  <span className="text-white/50 font-medium">Cover Quality:</span>
                  <div className="flex gap-1">
                    {[
                      { id: 'low', label: 'Fast (150px)' },
                      { id: 'med', label: 'Crisp (300px)' },
                      { id: 'high', label: 'HD (500px)' },
                    ].map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => syncProfile({ ...userProfile, artQualityOffline: sz.id as any })}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          (userProfile.artQualityOffline || 'low') === sz.id
                            ? 'bg-[#ff6b1a] text-black'
                            : 'bg-white/5 text-white/60 hover:text-white'
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 2. THEMES & VISUALS */}
      {showAppearance && (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-1 border-b border-white/10">
            <Palette className="w-4 h-4 text-[#ff6b1a]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white/70">
              Theme & Interface Styling
            </h3>
          </div>

          {/* Curated 1-Tap Themes */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">One-Tap Curated Themes</h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Instantly transform the colors, glass effects, and atmosphere.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {PRESETS.map((p) => {
                const isSelected = userProfile.activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#ff6b1a] bg-[#ff6b1a]/15 shadow-md shadow-[#ff6b1a]/10'
                        : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: p.accentHex }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-xs text-white block truncate">{p.name}</span>
                      <span className="text-[10px] text-white/40 block truncate">{p.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Global Interface Display Scaling (Centered buttons) */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-[#ff6b1a]" />
                <h4 className="font-bold text-xs text-white">Global Display Scale</h4>
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">
                Adjust typography sizing, layout density, and component scales.
              </p>
            </div>

            <div className="flex items-center justify-center bg-black/50 p-1.5 rounded-xl border border-white/10 gap-1.5 w-full sm:w-72">
              {[
                { id: 'small', label: 'Small' },
                { id: 'default', label: 'Default' },
                { id: 'large', label: 'Large' },
              ].map((preset) => {
                const isSelected = (userProfile.uiScale || 'default') === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      syncProfile({ ...userProfile, uiScale: preset.id as any });
                    }}
                    className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#ff6b1a] text-black shadow-md font-extrabold scale-[1.02]'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interface Switches (Liquid Glass & Dark/Light) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#ff6b1a]" />
                  <h4 className="font-bold text-xs text-white">Liquid Glass Blur</h4>
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Translucent frosted glass styling on panels and overlays.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  syncProfile({ ...userProfile, liquidGlass: !userProfile.liquidGlass });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  userProfile.liquidGlass ? 'bg-[#ff6b1a]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    userProfile.liquidGlass ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  {userProfile.theme === 'light' ? (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-[#ff6b1a]" />
                  )}
                  <h4 className="font-bold text-xs text-white">Light / Dark Theme</h4>
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {userProfile.theme === 'light' ? 'Daylight Light Mode' : 'OLED Dark Mode'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextTheme = userProfile.theme === 'light' ? 'dark' : 'light';
                  syncProfile({ ...userProfile, theme: nextTheme });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  userProfile.theme === 'light' ? 'bg-[#ff6b1a]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    userProfile.theme === 'light' ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Color Palettes Grid (Curated Signature Colors + Custom Color Picker) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Accent Color Swatches */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">App Highlight Accent Color</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">Colors player bars, active icons and buttons.</p>
                </div>
                {userProfile.customAccentHex && (
                  <span className="text-[10px] font-mono text-[#ff6b1a] bg-[#ff6b1a]/10 px-2 py-0.5 rounded-md border border-[#ff6b1a]/20">
                    {userProfile.customAccentHex.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {ACCENTS.slice(0, 6).map((acc) => {
                  const isSelected = userProfile.accentColor === acc.id && !userProfile.customAccentHex;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() =>
                        syncProfile({
                          ...userProfile,
                          accentColor: acc.id,
                          customAccentHex: undefined,
                        })
                      }
                      style={{ backgroundColor: acc.color }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer ${
                        isSelected ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={acc.name}
                    >
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                      )}
                    </button>
                  );
                })}

                {/* Custom Color Picker Button */}
                <label
                  className={`relative w-7 h-7 rounded-full flex items-center justify-center border cursor-pointer overflow-hidden shadow-sm transition-all hover:scale-110 ${
                    userProfile.customAccentHex
                      ? 'ring-2 ring-white scale-110 border-transparent'
                      : 'border-white/30 hover:border-white'
                  }`}
                  style={{
                    background: userProfile.customAccentHex || 'conic-gradient(from 0deg, #ff6b1a, #a259ff, #3b9dff, #28c76f, #d4af37, #ff6b1a)',
                  }}
                  title="Pick Any Custom Color"
                >
                  <input
                    type="color"
                    value={userProfile.customAccentHex || '#ff6b1a'}
                    onChange={(e) => {
                      const hex = e.target.value;
                      syncProfile({
                        ...userProfile,
                        accentColor: hex,
                        customAccentHex: hex,
                      });
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {userProfile.customAccentHex ? (
                    <Check className="w-3.5 h-3.5 text-black stroke-[3] drop-shadow" />
                  ) : (
                    <Palette className="w-3 h-3 text-white drop-shadow pointer-events-none" />
                  )}
                </label>
              </div>
            </div>

            {/* Lyrics Karaoke Highlight Color with Custom Color Wheel */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">Karaoke Lyrics Glowing Color</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">Colors active singing lyric lines.</p>
                </div>
                {userProfile.customLyricsHex && (
                  <span className="text-[10px] font-mono text-[#ff6b1a] bg-[#ff6b1a]/10 px-2 py-0.5 rounded-md border border-[#ff6b1a]/20">
                    {userProfile.customLyricsHex.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {LYRICS_COLORS.slice(0, 6).map((lyr) => {
                  const isSelected = userProfile.lyricsColor === lyr.id && !userProfile.customLyricsHex;
                  return (
                    <button
                      key={lyr.id}
                      type="button"
                      onClick={() =>
                        syncProfile({
                          ...userProfile,
                          lyricsColor: lyr.id,
                          customLyricsHex: undefined,
                        })
                      }
                      style={{ backgroundColor: lyr.color }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer ${
                        isSelected ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={lyr.name}
                    >
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                      )}
                    </button>
                  );
                })}

                {/* Custom Lyrics Color Wheel Picker */}
                <label
                  className={`relative w-7 h-7 rounded-full flex items-center justify-center border cursor-pointer overflow-hidden shadow-sm transition-all hover:scale-110 ${
                    userProfile.customLyricsHex
                      ? 'ring-2 ring-white scale-110 border-transparent'
                      : 'border-white/30 hover:border-white'
                  }`}
                  style={{
                    background: userProfile.customLyricsHex || 'conic-gradient(from 0deg, #ff007a, #9d4edd, #00f0ff, #00ff88, #ffeb3b, #ff007a)',
                  }}
                  title="Pick Custom Lyrics Color Wheel"
                >
                  <input
                    type="color"
                    value={userProfile.customLyricsHex || '#ff6b1a'}
                    onChange={(e) => {
                      const hex = e.target.value;
                      syncProfile({
                        ...userProfile,
                        lyricsColor: 'orange',
                        customLyricsHex: hex,
                      });
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {userProfile.customLyricsHex ? (
                    <Check className="w-3.5 h-3.5 text-black stroke-[3] drop-shadow" />
                  ) : (
                    <Palette className="w-3 h-3 text-white drop-shadow pointer-events-none" />
                  )}
                </label>
              </div>
            </div>

            {/* Karaoke Lyrics Glow Effect (Off / Default / Strong) */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">Karaoke Lyrics Glow Effect</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    Control the intensity of the glowing aura around singing lyrics.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff6b1a] bg-[#ff6b1a]/10 px-2 py-0.5 rounded-md border border-[#ff6b1a]/20">
                  {userProfile.lyricsGlow || 'default'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'off', label: 'Off', desc: 'No glow aura', previewStyle: {} },
                  {
                    id: 'default',
                    label: 'Default',
                    desc: 'Smooth aura',
                    previewStyle: {
                      textShadow: 'rgba(255, 107, 26, 0.65) 0 0 12px',
                      filter: 'drop-shadow(0 0 8px rgba(255, 107, 26, 0.55))',
                    },
                  },
                  {
                    id: 'strong',
                    label: 'Strong',
                    desc: 'Vibrant neon halo',
                    previewStyle: {
                      textShadow:
                        'rgba(255, 107, 26, 0.95) 0 0 8px, rgba(255, 107, 26, 0.75) 0 0 20px',
                      filter:
                        'drop-shadow(0 0 6px rgba(255, 107, 26, 0.95)) drop-shadow(0 0 16px rgba(255, 107, 26, 0.7))',
                    },
                  },
                ].map((opt) => {
                  const isSelected = (userProfile.lyricsGlow || 'default') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        syncProfile({ ...userProfile, lyricsGlow: opt.id as any });
                      }}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#ff6b1a]/15 border-[#ff6b1a] text-white shadow-md'
                          : 'bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span
                        style={opt.previewStyle}
                        className="text-sm sm:text-base font-black tracking-wide"
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-white/40 leading-tight">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Key Moments / Highlights Display (Off / Rectangle Markers / Full Parts) */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">Song Key Moments & Highlights</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    Display bookmarks for famous choruses and main drops on the player scrubber.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff6b1a] bg-[#ff6b1a]/10 px-2 py-0.5 rounded-md border border-[#ff6b1a]/20">
                  {userProfile.keyPartsDisplay || 'dots'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'off', label: 'Off', desc: 'Turn everything off' },
                  { id: 'dots', label: 'Rectangles Only', desc: 'Sleek timeline rectangles' },
                  { id: 'full', label: 'Full Parts', desc: 'Rectangles + top badges' },
                ].map((opt) => {
                  const isSelected = (userProfile.keyPartsDisplay || 'dots') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        syncProfile({ ...userProfile, keyPartsDisplay: opt.id as any });
                      }}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#ff6b1a]/15 border-[#ff6b1a] text-white shadow-md'
                          : 'bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-black tracking-wide">
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-white/40 leading-tight">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Player Progress Bar Style (Default / Thick Bar / Sine Wave / Neon Laser) */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">Player Progress Bar Style</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    Changes both the normal player and the full-screen stage player.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff6b1a] bg-[#ff6b1a]/10 px-2 py-0.5 rounded-md border border-[#ff6b1a]/20">
                  {userProfile.progressBarStyle || 'default'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  { id: 'default', label: 'Classic Slim', desc: 'Default thin line & dot' },
                  { id: 'block', label: 'Thick Bar', desc: 'Advancing full rectangle' },
                  { id: 'wave', label: 'Sine Wave', desc: 'Animated zigzag squiggle' },
                  { id: 'neon', label: 'Neon Laser', desc: 'Radiant beam & laser head' },
                ].map((opt) => {
                  const isSelected = (userProfile.progressBarStyle || 'default') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        syncProfile({ ...userProfile, progressBarStyle: opt.id as any });
                      }}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#ff6b1a]/15 border-[#ff6b1a] text-white shadow-md'
                          : 'bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-black tracking-wide">
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-white/40 leading-tight">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Karaoke Lyrics Typography & Distinct Font Personalities */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-white">Karaoke Lyrics Font Style</h4>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Choose your preferred typography for synchronized karaoke lyrics.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {[
                { id: 'bebas', label: 'Bold Impact', preview: 'LYRICS', font: "'Bebas Neue', sans-serif" },
                { id: 'caveat', label: 'Handwritten', preview: 'Singing', font: "'Caveat', cursive" },
                { id: 'righteous', label: 'Retro Neon', preview: 'Groove', font: "'Righteous', cursive" },
                { id: 'playfair', label: 'Classic Serif', preview: 'Harmony', font: "'Playfair Display', serif" },
                { id: 'jetbrains', label: 'Code Mono', preview: '01:23', font: "'JetBrains Mono', monospace" },
                { id: 'nunito', label: 'Soft Rounded', preview: 'Vibes', font: "'Nunito', sans-serif" },
                { id: 'poppins', label: 'Modern Sans', preview: 'Modern', font: "'Poppins', sans-serif" },
                { id: 'inter', label: 'Clean System', preview: 'Clean', font: "'Inter', sans-serif" },
              ].map((f) => {
                const isSelected = (userProfile.lyricsFont || 'poppins') === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      syncProfile({ ...userProfile, lyricsFont: f.id as any });
                    }}
                    className={`p-3 rounded-xl border text-center flex flex-col items-center justify-between gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#ff6b1a] bg-[#ff6b1a]/15 shadow-md shadow-[#ff6b1a]/10 scale-[1.02]'
                        : 'border-white/5 bg-black/40 hover:bg-white/5'
                    }`}
                  >
                    <span style={{ fontFamily: f.font }} className="text-xl sm:text-2xl font-black text-white leading-none my-1">
                      {f.preview}
                    </span>
                    <span className="text-[10px] font-bold text-white/70 truncate w-full">
                      {f.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. APP LOGO & SHORTCUT IDENTITY */}
      {showApp && (
        <section id="logo-customizer-section" className="flex flex-col gap-3.5 scroll-mt-20">
          <div className="flex items-center gap-2 pb-1 border-b border-white/10">
            <Smartphone className="w-4 h-4 text-[#ff6b1a]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white/70">
              App Logo & Home Screen Identity
            </h3>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">Customize Home Screen Name & Icon</h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Personalize the shortcut title and emblem for your phone or desktop.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFileGuide(!showFileGuide)}
                className="text-xs text-[#ff6b1a] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Source Files</span>
              </button>
            </div>

            {/* Custom App Name Field */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[#ff6b1a]" />
                  <span>Shortcut Name on Home Screen</span>
                </label>
                <span className="text-[10px] text-white/40">Syncs without reinstalling</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
                <input
                  type="text"
                  value={appNameInput}
                  onChange={(e) => setAppNameInput(e.target.value)}
                  placeholder="e.g. MOUZIKETNA, Habib's Music..."
                  maxLength={30}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 focus:border-[#ff6b1a] text-white text-xs font-semibold placeholder:text-white/30 focus:outline-none transition-colors"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveAppName(appNameInput)}
                    className="px-4 py-2 rounded-xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#ff6b1a]/20 transition-all cursor-pointer flex-shrink-0"
                  >
                    {nameSavedSuccess ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{nameSavedSuccess ? 'Saved!' : 'Save Name'}</span>
                  </button>
                  {appNameInput !== DEFAULT_APP_NAME && (
                    <button
                      type="button"
                      onClick={() => handleSaveAppName(DEFAULT_APP_NAME)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-semibold border border-white/10 transition-colors cursor-pointer flex-shrink-0"
                      title="Reset name"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Logo Presets */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-white/80">
                Choose App Icon Emblem:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LOGO_PRESETS.map((preset) => {
                  const current = userProfile.appLogo || 'default';
                  const isSelected = current === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={async () => {
                        try {
                          showToast(`Switching emblem to "${preset.name}"…`);
                          await applyCustomAppLogo(preset.id);
                          syncProfile({ ...userProfile, appLogo: preset.id });
                          sessionStorage.setItem(
                            'mouzika_restore_after_logo',
                            JSON.stringify({ tab: 'app', anchor: 'logo-customizer-section', name: preset.name })
                          );
                          setTimeout(() => {
                            window.location.reload();
                          }, 180);
                        } catch {
                          showToast(`Failed to switch emblem`, true);
                        }
                      }}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'border-[#ff6b1a] bg-[#ff6b1a]/15 shadow-md shadow-[#ff6b1a]/10'
                          : 'border-white/10 bg-black/40 hover:bg-white/5'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/15 bg-black flex-shrink-0 flex items-center justify-center">
                        <img
                          src={preset.svgDataUri}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{preset.name}</div>
                        <div className="text-[10px] text-white/40 truncate">
                          {isSelected ? '✓ Active' : preset.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Upload Button */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCropperOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-[#ff6b1a]" />
                <span>Upload & Crop Custom Picture...</span>
              </button>
              {userProfile.appLogo && userProfile.appLogo.startsWith('data:') && (
                <span className="text-xs text-[#28c76f] font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Custom Cropped Image Active
                </span>
              )}
            </div>

            {showFileGuide && (
              <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white/70 space-y-1.5">
                <div className="font-bold text-[#ff6b1a]">To permanently replace app icon files in source code:</div>
                <p>Place your PNG/ICO images at these exact paths in the project:</p>
                <code className="block bg-white/5 p-2 rounded text-white font-mono text-[11px] leading-relaxed">
                  /public/icon-512.png (512x512 PWA splash &amp; icon)<br />
                  /public/icon-192.png (192x192 Android home screen)<br />
                  /public/apple-touch-icon.png (180x180 iOS home screen)<br />
                  /public/favicon.ico &amp; /public/favicon.png (browser tab icon)
                </code>
              </div>
            )}
          </div>

          {/* Installation Banner */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
                <img
                  src={getAppLogoSrc(userProfile.appLogo)}
                  alt="App Icon"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">Install MOUZIKETNA as an App</h4>
                  {isStandalone && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Installed
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  {isStandalone
                    ? 'Running in standalone native window. Custom names and logos sync directly to your app.'
                    : 'Install directly to your Android, iPhone, or Desktop to run with no address bar or tabs.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTriggerInstall}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-95 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-[#ff6b1a]/20 transition-all cursor-pointer flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{isStandalone ? 'View App Info' : 'Install App'}</span>
            </button>
          </div>
        </section>
      )}

      {/* 4. STORAGE & SYSTEM */}
      {showSystem && (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-1 border-b border-white/10">
            <HardDrive className="w-4 h-4 text-[#ff6b1a]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white/70">
              Storage & System Diagnostics
            </h3>
          </div>

          {/* Storage Management */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div
              onClick={() => openCollection('downloads')}
              className="cursor-pointer group flex-1"
            >
              <h4 className="font-bold text-sm text-white group-hover:text-[#ff6b1a] transition-colors flex items-center gap-1.5">
                <span>Manage Offline Songs</span>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </h4>
              <p className="text-xs text-white/50 mt-0.5">
                {downloadedSet.size} offline tracks stored • <strong className="text-white">{downloadSize}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setModalConfirm({
                  title: 'Clear all offline music?',
                  text: 'This will delete all downloaded audio files from your browser storage.',
                  onConfirm: async () => {
                    await clearAllDownloads();
                    showToast('All downloads cleared', true);
                  },
                });
              }}
              className="w-full sm:w-auto py-2 px-3 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Downloads</span>
            </button>
          </div>

          {/* Force App Update / Cache Purge */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1 max-w-xl">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-white">Check for Updates & Force Reload</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Safe Refresh
                </span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Purges stale browser code cache and loads the newest release. Downloaded songs and playlists are 100% preserved.
              </p>
            </div>

            <button
              type="button"
              disabled={isRefreshingApp}
              onClick={async () => {
                setIsRefreshingApp(true);
                showToast('Fetching latest update from network...');
                await forceAppUpdateAndRefresh();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer flex-shrink-0"
            >
              {isRefreshingApp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff6b1a]" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-[#ff6b1a]" />
              )}
              <span>{isRefreshingApp ? 'Refreshing...' : 'Force Reload App'}</span>
            </button>
          </div>

          {/* Server Ping Test */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#ff6b1a]" />
                  <span>Streaming Server Latency</span>
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Test connectivity to backend audio servers and video streams.
                </p>
              </div>
              <button
                type="button"
                onClick={runServerDiagnostics}
                disabled={diagnosticsRunning}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {diagnosticsRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wifi className="w-3 h-3 text-[#ff6b1a]" />
                )}
                <span>Ping Servers</span>
              </button>
            </div>

            {Object.keys(serverStats).length > 0 && (
              <div className="flex flex-col gap-1 pt-2 border-t border-white/5">
                {Object.entries(serverStats).map(([name, stat]) => (
                  <div key={name} className="flex items-center justify-between text-xs py-0.5">
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

          {/* Reset Preferences to Default */}
          <button
            type="button"
            onClick={() => {
              setModalConfirm({
                title: 'Reset settings to defaults?',
                text: 'Your theme, quality, and appearance preferences will be restored to defaults. Your saved songs and playlists remain safe.',
                onConfirm: async () => {
                  syncProfile({
                    ...userProfile,
                    dataSaver: false,
                    dataSaverLevel: 'off',
                    downloadQuality: 'stable',
                    autoCacheQuality: 'stable',
                    downloadLyricsOffline: false,
                    downloadArtOffline: true,
                    artQualityOffline: 'low',
                    appLogo: 'default',
                    autoCachePlayed: true,
                    liquidGlass: true,
                    theme: 'dark',
                    accentColor: 'orange',
                    lyricsColor: 'white',
                    presetTint: 'none',
                    activePreset: 'glass',
                  });
                  await applyCustomAppLogo('default');
                  showToast('Settings reset to defaults');
                },
              });
            }}
            className="self-start flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white font-semibold text-xs transition-colors cursor-pointer mt-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Preferences to Defaults</span>
          </button>
        </section>
      )}

      {/* Custom Logo Cropper Modal */}
      <LogoCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        onApply={async (dataUrl) => {
          try {
            showToast('Applying custom image and updating app…');
            await applyCustomAppLogo(dataUrl);
            syncProfile({ ...userProfile, appLogo: dataUrl });
            sessionStorage.setItem(
              'mouzika_restore_after_logo',
              JSON.stringify({ tab: 'app', anchor: 'logo-customizer-section', name: 'Custom Picture' })
            );
            setTimeout(() => {
              window.location.reload();
            }, 180);
          } catch {
            showToast('Failed to apply custom emblem', true);
          }
        }}
        currentLogoSrc={getAppLogoSrc(userProfile.appLogo)}
      />
    </div>
  );
};
