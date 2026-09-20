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
  Image as ImageIcon,
  UploadCloud,
  FileCode,
  RefreshCw,
  Edit3,
  CheckCircle2,
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
  getStoredAppLogo,
  applyCustomAppName,
  getStoredAppName,
  DEFAULT_APP_NAME,
  forceAppUpdateAndRefresh,
} from '../services/pwa';
import { LogoCropperModal } from '../components/LogoCropperModal';

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
  { id: 'classic', name: 'Classic', desc: 'Minimal Dark & Orange', accentColor: 'orange', accentHex: '#ff6b1a', glass: false, theme: 'dark', tint: 'none', lyrics: 'white' },
  { id: 'glass', name: 'Liquid Glass', desc: 'Frosted Translucent Blur', accentColor: 'orange', accentHex: '#ff8b47', glass: true, theme: 'dark', tint: 'none', lyrics: 'white' },
  { id: 'monochrome', name: 'Monochrome', desc: 'Clean White & Gray', accentColor: 'mono', accentHex: '#d8d8d8', glass: false, theme: 'dark', tint: 'none', lyrics: 'mono' },
  { id: 'daylight', name: 'Daylight', desc: 'Crisp Modern Light Mode', accentColor: 'blue', accentHex: '#3b9dff', glass: false, theme: 'light', tint: 'none', lyrics: 'white' },
  { id: 'gold', name: 'Gold Luxury', desc: 'Warm Amber & Brass Glow', accentColor: 'gold', accentHex: '#d4af37', glass: false, theme: 'dark', tint: 'gold', lyrics: 'gold' },
  { id: 'midnight', name: 'Midnight', desc: 'Deep Violet & Cyber Glow', accentColor: 'purple', accentHex: '#a259ff', glass: true, theme: 'dark', tint: 'purple', lyrics: 'purple' },
  { id: 'ocean', name: 'Ocean Wave', desc: 'Cyan & Deep Sea Azure', accentColor: 'ocean', accentHex: '#06b6d4', glass: false, theme: 'dark', tint: 'ocean', lyrics: 'ocean' },
  { id: 'emerald', name: 'Emerald', desc: 'Forest Green Atmosphere', accentColor: 'emerald', accentHex: '#10b981', glass: false, theme: 'dark', tint: 'emerald', lyrics: 'emerald' },
  { id: 'crimson', name: 'Crimson Night', desc: 'Velvet Ruby & Frosted Glass', accentColor: 'crimson', accentHex: '#e11d48', glass: true, theme: 'dark', tint: 'crimson', lyrics: 'crimson' },
  { id: 'sunset', name: 'Sunset Bloom', desc: 'Peach & Coral Dusk', accentColor: 'sunset', accentHex: '#fb7185', glass: false, theme: 'dark', tint: 'sunset', lyrics: 'sunset' },
];

export const SettingsView: React.FC = () => {
  const {
    userProfile,
    syncProfile,
    openCollection,
    downloadedSet,
    setModalConfirm,
    showToast,
    setIsInstallModalOpen,
  } = useMusic();

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

  useEffect(() => {
    if (userProfile.customAppName) {
      setAppNameInput(userProfile.customAppName);
    }
  }, [userProfile.customAppName]);

  const handleSaveAppName = (nameToSave: string) => {
    const clean = nameToSave.trim() || DEFAULT_APP_NAME;
    setAppNameInput(clean);
    applyCustomAppName(clean);
    syncProfile({ ...userProfile, customAppName: clean });
    setNameSavedSuccess(true);
    showToast(`App title updated to "${clean}"`);
    setTimeout(() => setNameSavedSuccess(false), 2500);
  };

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
      accentColor: preset.accentColor,
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
              { id: 'stable', label: 'Stable (160 kbps) • Default' },
              { id: 'high', label: 'High (320 kbps)' },
              { id: 'saver', label: 'Saver (96 kbps)' },
              { id: 'ultra', label: 'Ultra (48 kbps)' },
            ].map((opt) => {
              const current = userProfile.downloadQuality || 'stable';
              const isSelected = current === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    syncProfile({
                      ...userProfile,
                      downloadQuality: opt.id as any,
                      dataSaverLevel: opt.id === 'high' ? 'off' : (opt.id as any),
                      dataSaver: opt.id !== 'high' && opt.id !== 'stable',
                    });
                  }}
                  className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
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
                  <span className="text-xs font-bold text-white/90">Auto-Cache Audio Quality</span>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    Stable 160 kbps is the fast default balance. Select High Quality (320 kbps) to automatically cache in full studio fidelity.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 bg-black/40 p-1 rounded-xl border border-white/5 gap-1 max-w-lg">
                {[
                  { id: 'stable', label: 'Stable (160k) • Default' },
                  { id: 'high', label: 'High (320 kbps)' },
                  { id: 'saver', label: 'Saver (96 kbps)' },
                  { id: 'ultra', label: 'Ultra (48 kbps)' },
                ].map((opt) => {
                  const current = userProfile.autoCacheQuality || 'stable';
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
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
                        isSelected
                          ? 'bg-[#ff6b1a] text-black shadow-md'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
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

        {/* Offline Song Artwork */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-white">Save Song Pictures for Offline Use</h4>
                <span className="text-[11px] font-semibold text-[#ff6b1a] bg-[#ff6b1a]/10 px-2 py-0.5 rounded-full border border-[#ff6b1a]/20">
                  Always Visible
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Saves album & song artwork locally so you can always see pictures while playing offline songs.
              </p>
            </div>
            <button
              onClick={() => {
                syncProfile({
                  ...userProfile,
                  downloadArtOffline: userProfile.downloadArtOffline === false ? true : false,
                });
              }}
              className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${
                userProfile.downloadArtOffline !== false ? 'bg-[#ff6b1a]' : 'bg-white/20'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                  userProfile.downloadArtOffline !== false ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {userProfile.downloadArtOffline !== false && (
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/90">Offline Image Quality</span>
                <span className="text-[11px] text-white/40">Low (150px) is fast and saves disk space</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 bg-black/40 p-1 rounded-xl border border-white/5 gap-1 max-w-lg">
                {[
                  { id: 'low', label: 'Low (150px) • Default' },
                  { id: 'med', label: 'Medium (300px)' },
                  { id: 'high', label: 'High (500px)' },
                  { id: 'orig', label: 'Original HD' },
                ].map((opt) => {
                  const current = userProfile.artQualityOffline || 'low';
                  const isSelected = current === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        syncProfile({
                          ...userProfile,
                          artQualityOffline: opt.id as any,
                        });
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                        isSelected
                          ? 'bg-[#ff6b1a] text-black shadow-md'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
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
      </section>

      {/* 2. APPEARANCE & THEME */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-1 border-b border-white/10">
          <Palette className="w-4 h-4 text-[#ff6b1a]" />
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-white/70">
            Appearance & Themes
          </h3>
        </div>

        {/* Custom App Identity: Name & Logo */}
        <div className="p-4 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-white">App Identity & Home Screen Customization</h4>
                {isStandalone && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Standalone PWA
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Directly change the app name and icon without having to reinstall.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFileGuide(!showFileGuide)}
              className="text-xs text-[#ff6b1a] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>File Paths</span>
            </button>
          </div>

          {/* 1. App Name Customization Field */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-[#ff6b1a]" />
                <span>Home Screen App Shortcut Name</span>
              </label>
              <span className="text-[10px] text-white/40">Android & iOS Home Screen</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
              <input
                type="text"
                value={appNameInput}
                onChange={(e) => setAppNameInput(e.target.value)}
                placeholder="e.g. MOUZIKETNA, Habib's Music..."
                maxLength={32}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 focus:border-[#ff6b1a] text-white text-xs font-semibold placeholder:text-white/30 focus:outline-none transition-colors"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveAppName(appNameInput)}
                  className="px-4 py-2.5 rounded-xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#ff6b1a]/20 transition-all cursor-pointer flex-shrink-0"
                >
                  {nameSavedSuccess ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{nameSavedSuccess ? 'Saved!' : 'Save Name'}</span>
                </button>
                {appNameInput !== DEFAULT_APP_NAME && (
                  <button
                    type="button"
                    onClick={() => handleSaveAppName(DEFAULT_APP_NAME)}
                    className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-semibold border border-white/10 transition-colors cursor-pointer flex-shrink-0"
                    title="Reset to default MOUZIKETNA"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Real-time Header Preview */}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 mt-0.5">
              <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Home Icon Preview:</span>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md overflow-hidden bg-black border border-white/10 flex-shrink-0">
                  <img
                    src={getAppLogoSrc(userProfile.appLogo)}
                    alt="Icon preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs font-black tracking-tight text-white flex items-center gap-1">
                  {appNameInput.trim() || DEFAULT_APP_NAME}
                  <span className="text-[9px] font-normal text-white/40">app shortcut</span>
                </span>
              </div>
            </div>
            <p className="text-[10px] text-white/40 leading-normal">
              {isStandalone
                ? 'Sets your home screen icon title and application shortcut label without modifying the website brand.'
                : 'Configures the title used when adding the app to your Home Screen / Desktop without altering website domain titles.'}
            </p>
          </div>

          {/* 2. App Logo & Icon Presets */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-white/80">
              Select Logo Preset (Pulse Waveforms & Authentic Spotify):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {LOGO_PRESETS.map((preset) => {
                const current = userProfile.appLogo || 'default';
                const isSelected = current === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      applyCustomAppLogo(preset.id);
                      syncProfile({ ...userProfile, appLogo: preset.id });
                      showToast(`Logo switched to ${preset.name}`);
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
                      <div className="text-[10px] text-white/40 truncate">{isSelected ? 'Active' : 'Select'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <button
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
                  style={{ backgroundColor: p.accentHex }}
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
            Install MOUZIKETNA to Device
          </h3>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
              <img
                src={getAppLogoSrc(userProfile.appLogo)}
                alt="App Icon"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-white">Full Screen App Experience</h4>
                {isStandalone && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Installed
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50 mt-0.5 max-w-sm">
                {isStandalone
                  ? 'App is currently running in installed standalone mode. Name and icon customizations sync automatically without needing to reinstall.'
                  : 'Install directly onto your Android, iPhone, or Desktop to run standalone without browser tabs or URL bars.'}
              </p>
            </div>
          </div>

          <button
            id="settings-install-app-btn"
            onClick={() => setIsInstallModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-95 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b1a]/20 transition-all cursor-pointer flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{isStandalone ? 'Shortcut Guide' : 'Install App'}</span>
          </button>
        </div>
      </section>

      {/* 6. APP UPDATES & NETWORK CACHE */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-1 border-b border-white/10">
          <RefreshCw className="w-4 h-4 text-[#ff6b1a]" />
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-white/70">
            App Updates & Network Cache
          </h3>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.04] glass-panel border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 max-w-xl">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-white">Check for Updates & Force Reload</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Safe Refresh
              </span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed mt-0.5">
              Mobile and desktop browsers aggressively cache website code. If an update was pushed or a feature is stuck, this forces the browser to discard stale scripts and fetch the fresh version from the network.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-[#28c76f] font-semibold mt-1">
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Your downloaded songs, playlists, favorites, and login will NOT be affected.</span>
            </div>
          </div>

          <button
            id="force-refresh-app-btn"
            disabled={isRefreshingApp}
            onClick={async () => {
              setIsRefreshingApp(true);
              showToast('Purging stale code cache & fetching latest update...');
              await forceAppUpdateAndRefresh();
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer flex-shrink-0"
          >
            {isRefreshingApp ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#ff6b1a]" />
            ) : (
              <RefreshCw className="w-4 h-4 text-[#ff6b1a]" />
            )}
            <span>{isRefreshingApp ? 'Refreshing...' : 'Check for Updates & Force Reload'}</span>
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
              applyCustomAppLogo('default');
              showToast('Settings reset to defaults');
            },
          });
        }}
        className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset Preferences to Default</span>
      </button>

      {/* Custom Logo Cropper Modal */}
      <LogoCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        onApply={(dataUrl) => {
          applyCustomAppLogo(dataUrl);
          syncProfile({ ...userProfile, appLogo: dataUrl });
          showToast('Custom app logo applied!');
        }}
        currentLogoSrc={getAppLogoSrc(userProfile.appLogo)}
      />
    </div>
  );
};
