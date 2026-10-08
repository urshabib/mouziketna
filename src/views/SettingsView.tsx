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
  Maximize2,
  Globe,
  X,
  SlidersHorizontal,
  Type,
  Radio,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Lock,
  Mail,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import { AccountSettingsModal } from '../components/AccountSettingsModal';
import {
  getTotalDownloadedSize,
  formatBytes,
  deleteAllDownloads,
  saveProgressBarStyle,
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
  checkForAppUpdates,
  hasPwaInstallPrompt,
  promptPwaInstall,
} from '../services/pwa';
import { APP_VERSION } from '../version';
import { LogoCropperModal } from '../components/LogoCropperModal';

const MiniProgressBarPreview: React.FC<{ style: string; isSelected: boolean; customColor?: string }> = ({
  style,
  isSelected,
  customColor,
}) => {
  const color = customColor || 'var(--accent, #ff6b1a)';

  if (style === 'wave') {
    return (
      <div className="w-full h-7 flex items-center justify-center overflow-hidden relative px-1">
        <svg viewBox="0 0 100 24" className="w-full h-5 overflow-visible">
          <path
            d="M 50,12 Q 62.5,5 75,12 T 100,12"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 0,12 Q 12.5,5 25,12 T 50,12"
            fill="none"
            stroke={color}
            strokeWidth="3.8"
            strokeLinecap="round"
          >
            <animate
              attributeName="d"
              dur="1.6s"
              repeatCount="indefinite"
              values="
                M 0,12 Q 12.5,5 25,12 T 50,12;
                M 0,12 Q 12.5,19 25,12 T 50,12;
                M 0,12 Q 12.5,5 25,12 T 50,12
              "
            />
          </path>
        </svg>
      </div>
    );
  }
  if (style === 'aurora' || style === 'neon') {
    return (
      <div className="w-full h-7 flex items-center justify-center px-1">
        <div className="w-full h-3 bg-black/60 rounded-full relative overflow-visible flex items-center border border-white/10 shadow-[0_0_8px_rgba(255,107,26,0.3)]">
          <div
            className="h-full w-1/2 rounded-full relative"
            style={{
              background: `linear-gradient(90deg, ${color}80 0%, ${color} 70%, #ffffff 100%)`,
              boxShadow: `0 0 8px ${color}`,
            }}
          >
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center"
              style={{ boxShadow: `0 0 8px ${color}` }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (style === 'block') {
    return (
      <div className="w-full h-7 flex items-center justify-center px-1">
        <div className="w-full h-4 bg-white/10 rounded-md overflow-hidden p-0.5 border border-white/10">
          <div className="h-full w-1/2 rounded-sm shadow-sm" style={{ backgroundColor: color }} />
        </div>
      </div>
    );
  }
  // default
  return (
    <div className="w-full h-7 flex items-center justify-center px-1">
      <div className="w-full h-1.5 bg-white/15 rounded-full relative flex items-center">
        <div className="h-full w-1/2 rounded-full" style={{ backgroundColor: color }} />
        <div className="w-3 h-3 rounded-full bg-white shadow-md border border-black/20 -ml-1.5" />
      </div>
    </div>
  );
};

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

const PRESETS = [
  {
    id: 'flame',
    name: 'Obsidian Flame',
    desc: 'Deep Obsidian & Neon Flame',
    accentColor: 'orange',
    accentHex: '#ff6b1a',
    glass: false,
    glassLevel: 'off',
    theme: 'dark',
    tint: 'none',
    lyrics: 'white',
  },
  {
    id: 'violet',
    name: 'Cosmic Violet',
    desc: 'Deep Violet Cyber Glow',
    accentColor: 'purple',
    accentHex: '#a259ff',
    glass: true,
    glassLevel: 'medium',
    theme: 'dark',
    tint: 'purple',
    lyrics: 'purple',
  },
  {
    id: 'cyan',
    name: 'Ocean Cyan',
    desc: 'Deep Marine Bioluminescence',
    accentColor: 'ocean',
    accentHex: '#06b6d4',
    glass: true,
    glassLevel: 'medium',
    theme: 'dark',
    tint: 'ocean',
    lyrics: 'ocean',
  },
  {
    id: 'neon',
    name: 'Cyber Neon',
    desc: 'Electric Green Synth Atmosphere',
    accentColor: 'green',
    accentHex: '#28c76f',
    glass: true,
    glassLevel: 'medium',
    theme: 'dark',
    tint: 'green',
    lyrics: 'green',
  },
  {
    id: 'gold',
    name: 'Royal Gold',
    desc: 'Warm Velvet & Champagne Luxury',
    accentColor: 'gold',
    accentHex: '#d4af37',
    glass: true,
    glassLevel: 'medium',
    theme: 'dark',
    tint: 'gold',
    lyrics: 'gold',
  },
  {
    id: 'sunset',
    name: 'Sunset Rose',
    desc: 'Vibrant Sunset Glow',
    accentColor: 'sunset',
    accentHex: '#fb7185',
    glass: true,
    glassLevel: 'medium',
    theme: 'dark',
    tint: 'sunset',
    lyrics: 'sunset',
  },
  {
    id: 'crimson',
    name: 'Velvet Crimson',
    desc: 'Intense Crimson Velvet',
    accentColor: 'crimson',
    accentHex: '#e11d48',
    glass: true,
    glassLevel: 'medium',
    theme: 'dark',
    tint: 'crimson',
    lyrics: 'crimson',
  },
  {
    id: 'electric',
    name: 'Electric Blue',
    desc: 'High Voltage Pulse',
    accentColor: 'blue',
    accentHex: '#3b9dff',
    glass: true,
    glassLevel: 'medium',
    theme: 'dark',
    tint: 'none',
    lyrics: 'blue',
  },
  {
    id: 'emerald',
    name: 'Deep Emerald',
    desc: 'Lush Forest Emerald',
    accentColor: 'emerald',
    accentHex: '#10b981',
    glass: true,
    glassLevel: 'medium',
    theme: 'dark',
    tint: 'emerald',
    lyrics: 'emerald',
  },
  {
    id: 'mono',
    name: 'Minimal Silver',
    desc: 'Pure Monochromatic Stealth',
    accentColor: 'mono',
    accentHex: '#d8d8d8',
    glass: false,
    glassLevel: 'off',
    theme: 'dark',
    tint: 'none',
    lyrics: 'mono',
  },
];

const LYRICS_FONTS_ALL = [
  { id: 'poppins', label: 'Default Modern', preview: 'Modern', font: "'Poppins', sans-serif", desc: 'Balanced geometric studio typeface (Default)' },
  { id: 'inter', label: 'Clean System', preview: 'Clean', font: "'Inter', sans-serif", desc: 'Neutral modern standard interface font' },
  { id: 'bebas', label: 'Bold Impact', preview: 'LYRICS', font: "'Bebas Neue', sans-serif", desc: 'Tall punchy condensed uppercase' },
  { id: 'caveat', label: 'Handwritten', preview: 'Singing', font: "'Caveat', cursive", desc: 'Artistic smooth cursive handwriting' },
  { id: 'righteous', label: 'Retro Neon', preview: 'Groove', font: "'Righteous', cursive", desc: '1980s retro sci-fi rounded display' },
  { id: 'playfair', label: 'Classic Serif', preview: 'Harmony', font: "'Playfair Display', serif", desc: 'Editorial high-contrast luxury serif' },
  { id: 'jetbrains', label: 'Code Mono', preview: '01:23', font: "'JetBrains Mono', monospace", desc: 'Developer monospace with clean alignment' },
  { id: 'nunito', label: 'Soft Rounded', preview: 'Vibes', font: "'Nunito', sans-serif", desc: 'Friendly ultra-smooth rounded curves' },
];

const COLOR_SWATCH_PRESETS = [
  { id: 'white', name: 'Default White', color: '#ffffff' },
  { id: 'orange', name: 'Flame Orange', color: '#ff6b1a' },
  { id: 'purple', name: 'Cosmic Purple', color: '#a259ff' },
  { id: 'blue', name: 'Electric Blue', color: '#3b9dff' },
  { id: 'green', name: 'Neon Green', color: '#28c76f' },
  { id: 'emerald', name: 'Emerald', color: '#10b981' },
  { id: 'pink', name: 'Hot Pink', color: '#ff5fa2' },
  { id: 'gold', name: 'Luxury Gold', color: '#d4af37' },
  { id: 'cyan', name: 'Ocean Cyan', color: '#06b6d4' },
  { id: 'yellow', name: 'Sun Yellow', color: '#facc15' },
];

type SettingsTab = 'all' | 'audio' | 'appearance' | 'app' | 'system';

export const SettingsView: React.FC = () => {
  const {
    globalUser,
    setActivePane,
    userProfile,
    syncProfile,
    openCollection,
    downloadedSet,
    clearAllDownloads,
    setModalConfirm,
    showToast,
    setIsInstallModalOpen,
    language,
    setLanguage,
    t,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<SettingsTab>('all');
  const [downloadSize, setDownloadSize] = useState('0 MB');
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [serverStats, setServerStats] = useState<Array<{ name: string; status: string; latency?: number }>>([]);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isAccountSettingsModalOpen, setIsAccountSettingsModalOpen] = useState(false);
  const [contactAdminModal, setContactAdminModal] = useState<{
    type: 'password' | 'email';
    title: string;
    description: string;
  } | null>(null);
  const [showFileGuide, setShowFileGuide] = useState(false);
  const [appNameInput, setAppNameInput] = useState<string>(
    userProfile.customAppName || getStoredAppName() || DEFAULT_APP_NAME
  );
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isRefreshingApp, setIsRefreshingApp] = useState(false);

  // Modals for Custom Swatches & Lyrics Gallery
  const [isProgressBarColorModalOpen, setIsProgressBarColorModalOpen] = useState(false);
  const [isLyricsColorModalOpen, setIsLyricsColorModalOpen] = useState(false);
  const [isLyricsGalleryModalOpen, setIsLyricsGalleryModalOpen] = useState(false);

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
    setIsServerModalOpen(true);
    setServerStats([]);

    const endpoints = [
      { id: 1, url: `${NEW_HUB_BACKEND}/api/list-users` },
      { id: 2, url: 'https://saavn.me/modules?language=english', altUrl: 'https://fast-saavn.vercel.app/api?title=test&artist=test' },
      { id: 3, url: 'https://yt.omada.cafe/api/v1/stats' },
      { id: 4, url: 'https://invidious.schenkel.eti.br/api/v1/stats' },
      { id: 5, url: 'https://invidious.kemonomimi.nl/api/v1/stats' },
      { id: 6, url: 'https://echostreamz.com/api/v1/stats' },
      { id: 7, url: 'https://api.piped.private.coffee/trending?region=US' },
      { id: 8, url: 'https://lrclib.net/api/get?track_name=test&artist_name=test' },
    ];

    const results: Array<{ name: string; status: string; latency?: number }> = [];

    await Promise.all(
      endpoints.map(async (t, idx) => {
        const serverLabel = `Server ${idx + 1}`;
        const start = Date.now();
        try {
          const r = await fetchWithTimeout(t.url, 3500);
          const lat = Date.now() - start;
          results.push({
            name: serverLabel,
            status: r.status < 500 ? 'Reachable' : `HTTP ${r.status}`,
            latency: lat,
          });
        } catch {
          try {
            const probeTarget = (t as any).altUrl || t.url;
            const startNoCors = Date.now();
            await fetch(probeTarget, { mode: 'no-cors', signal: AbortSignal.timeout(3000) });
            const latNoCors = Date.now() - startNoCors;
            results.push({
              name: serverLabel,
              status: 'Reachable',
              latency: latNoCors,
            });
          } catch {
            results.push({
              name: serverLabel,
              status: 'Unreachable',
            });
          }
        }
      })
    );

    // Sort by server number
    results.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setServerStats(results);
    setDiagnosticsRunning(false);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    syncProfile({
      ...userProfile,
      liquidGlass: preset.glass,
      liquidGlassLevel: preset.glassLevel as any,
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

  const currentProgressBarColor =
    userProfile.customProgressBarHex || userProfile.progressBarColor || '#ffffff';
  const currentLyricsColor =
    userProfile.customLyricsHex ||
    (userProfile.lyricsColor && userProfile.lyricsColor.startsWith('#')
      ? userProfile.lyricsColor
      : '#ffffff');

  const showAudio = activeTab === 'all' || activeTab === 'audio';
  const showAppearance = activeTab === 'all' || activeTab === 'appearance';
  const showApp = !isStandalone && (activeTab === 'all' || activeTab === 'app');
  const showSystem = activeTab === 'all' || activeTab === 'system';

  return (
    <div className="flex flex-col gap-6 max-w-4xl pb-24 select-none">
      {/* Header & Category Navigation */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {t('settings.title', 'Settings')}
          </h2>
          <p className="text-xs text-white/50 font-medium mt-0.5">
            {t('settings.subtitle', 'Manage audio quality, interface styling, home screen shortcuts, and offline storage.')}
          </p>
        </div>

        {/* Quick Category Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: t('settings.all', 'All Settings'), icon: Sliders },
            { id: 'audio', label: t('settings.audio', 'Audio & Downloads'), icon: Volume2 },
            { id: 'appearance', label: t('settings.appearance', 'Themes & Style'), icon: Palette },
            ...(!isStandalone ? [{ id: 'app', label: t('settings.app', 'App & Shortcuts'), icon: Smartphone }] : []),
            { id: 'system', label: t('settings.system', 'Storage & System'), icon: HardDrive },
          ].map((cat) => {
            const isCurrent = activeTab === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id as SettingsTab)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                  isCurrent
                    ? 'bg-[var(--accent,#ff6b1a)] text-black shadow-md shadow-[var(--accent,#ff6b1a)]/20 font-extrabold'
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
            <Volume2 className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white/70">
              {t('settings.audio', 'Audio & Offline Downloads')}
            </h3>
          </div>

          {/* Manual Download Quality Card - ASCENDING ORDER */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>{t('settings.downloadQuality', 'Download Audio Quality')}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {t('settings.offlineTracks', 'Offline Tracks')}
                  </span>
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  {t('settings.downloadQualityDesc', 'Choose audio fidelity when downloading tracks to your offline library.')}
                </p>
              </div>
            </div>

            {/* Ascending Order Quality Grid (Lowest data-saver to highest studio master) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                {
                  id: 'ultra',
                  title: 'Ultra Saver',
                  kbps: '48 kbps',
                  desc: 'Minimal data & storage',
                  badge: '48k',
                },
                {
                  id: 'saver',
                  title: 'Data Saver',
                  kbps: '96 kbps',
                  desc: 'Fast cellular download',
                  badge: '96k',
                },
                {
                  id: 'stable',
                  title: 'Standard',
                  kbps: '160 kbps',
                  desc: 'Balanced studio sound',
                  badge: '160k',
                },
                {
                  id: 'high',
                  title: 'Studio High',
                  kbps: '320 kbps',
                  desc: 'Maximum master fidelity',
                  badge: '320k',
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
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 shadow-md shadow-[var(--accent)]/10'
                        : 'border-white/5 bg-black/40 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-bold text-xs text-white leading-tight">{tier.title}</div>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-[var(--accent)] stroke-[3] flex-shrink-0" />
                      ) : (
                        <span className="text-[10px] text-white/30 font-medium">{tier.kbps}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/50 leading-snug line-clamp-1">{tier.desc}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                      <span className="text-[var(--accent)] font-semibold">{tier.kbps}</span>
                      <span className="text-white/40">{tier.badge}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automatic Download As You Play */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">
                    {t('settings.autoDownloadPlayed', 'Download Songs as You Play')}
                  </h4>
                  <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                    {t('settings.autoDownloadPlayedBadge', 'Seamless Replay')}
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  {t(
                    'settings.autoDownloadPlayedDesc',
                    'Automatically keeps songs in offline storage while playing so replays do not consume cellular data.'
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !userProfile.autoCachePlayed;
                  syncProfile({ ...userProfile, autoCachePlayed: next });
                }}
                className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  userProfile.autoCachePlayed ? 'bg-[var(--accent)]' : 'bg-white/20'
                }`}
                aria-label={t('settings.autoDownloadPlayed', 'Download Songs as You Play')}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                    userProfile.autoCachePlayed ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Sub-setting: Auto-Download Quality in Ascending Order */}
            {userProfile.autoCachePlayed && (
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white/90">
                    {t('settings.autoCacheQuality', 'Auto-Download Quality:')}
                  </span>
                  <p className="text-[11px] text-white/40">
                    Order from lowest data usage to highest fidelity
                  </p>
                </div>

                <div className="flex items-center justify-center bg-black/50 p-1.5 rounded-xl border border-white/10 gap-1.5 w-full sm:w-80">
                  {[
                    { id: 'saver', label: 'Data Saver', sub: '96k' },
                    { id: 'stable', label: 'Standard', sub: '160k' },
                    { id: 'high', label: 'High', sub: '320k' },
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
                            ? 'bg-[var(--accent)] text-black shadow-md font-extrabold scale-[1.02]'
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

          {/* Unified Offline Features Card (Artwork + Lyrics) with Renamed Clear Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Offline Lyrics */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <Mic2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <h4 className="font-bold text-xs text-white">
                    {t('settings.offlineLyrics', 'Offline Lyrics')}
                  </h4>
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {t('settings.offlineLyricsDesc', 'Saves synced lyrics with downloaded songs for full offline lyrics.')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !userProfile.downloadLyricsOffline;
                  syncProfile({ ...userProfile, downloadLyricsOffline: next });
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                  userProfile.downloadLyricsOffline ? 'bg-[var(--accent)]' : 'bg-white/20'
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
                    <ImageIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <h4 className="font-bold text-xs text-white">
                      {t('settings.offlinePictures', 'Offline Song Pictures')}
                    </h4>
                  </div>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {t('settings.offlinePicturesDesc', 'Saves artwork so covers remain visible offline.')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const current = userProfile.downloadArtOffline !== false;
                    syncProfile({ ...userProfile, downloadArtOffline: !current });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                    userProfile.downloadArtOffline !== false ? 'bg-[var(--accent)]' : 'bg-white/20'
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
                  <span className="text-white/50 font-medium">
                    {t('settings.coverQuality', 'Cover Quality:')}
                  </span>
                  <div className="flex gap-1">
                    {[
                      { id: 'low', label: 'Data Saver (150px)' },
                      { id: 'med', label: 'Standard (300px)' },
                      { id: 'high', label: 'High Quality (500px)' },
                    ].map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => syncProfile({ ...userProfile, artQualityOffline: sz.id as any })}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          (userProfile.artQualityOffline || 'low') === sz.id
                            ? 'bg-[var(--accent)] text-black font-extrabold'
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
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-1 border-b border-white/10">
            <Palette className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white/70">
              {t('settings.appearance', 'Themes & Visual Customization')}
            </h3>
          </div>

          {/* Liquid Glass Blur (Clean 3-Box Selector) */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            {/* Container with background element/graphic showcasing refractive blur */}
            <div className="relative rounded-2xl p-3 overflow-hidden border border-white/10 bg-[#09090c]">
              {/* Refractive background graphic elements */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
                <div className="absolute -top-6 -left-6 w-36 h-36 rounded-full bg-gradient-to-br from-[#ff6b1a] to-rose-500 blur-2xl opacity-70" />
                <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-32 h-32 rounded-full bg-gradient-to-tr from-cyan-400 to-indigo-600 blur-xl opacity-60" />
                <div className="absolute -bottom-6 -right-6 w-40 h-40 rounded-full bg-gradient-to-tl from-emerald-400 to-amber-500 blur-2xl opacity-65" />
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff12_1px,transparent_1px)] [background-size:10px_10px] opacity-40" />
              </div>

              {/* 3 Clean Preview Box Selectors */}
              <div className="relative z-10 grid grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'off',
                    label: 'Off',
                    cardClass: 'bg-[#141418] border-zinc-700/70 shadow-md',
                    previewText: 'Solid',
                  },
                  {
                    id: 'medium',
                    label: 'Medium',
                    cardClass: 'bg-zinc-900/55 backdrop-blur-xl border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)]',
                    previewText: 'Glass',
                  },
                  {
                    id: 'ultra',
                    label: 'Ultra',
                    cardClass: 'bg-white/10 backdrop-blur-3xl border-white/35 shadow-[0_12px_32px_rgba(0,0,0,0.7),inset_0_1.5px_2px_rgba(255,255,255,0.5)] ring-1 ring-white/20',
                    previewText: 'Hyper Blur',
                  },
                ].map((opt) => {
                  const currentLevel = userProfile.liquidGlassLevel || (userProfile.liquidGlass ? 'medium' : 'off');
                  const isSelected = currentLevel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        syncProfile({
                          ...userProfile,
                          liquidGlass: opt.id !== 'off',
                          liquidGlassLevel: opt.id as any,
                        });
                        showToast(`Liquid glass set to ${opt.label}`);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)] bg-black/45 scale-[1.02] shadow-xl'
                          : 'border-white/10 bg-black/55 hover:bg-black/35'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-white">{opt.label}</span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Live glass card preview demonstrating refractive depth */}
                      <div className={`w-full h-10 rounded-lg flex items-center justify-center text-[10px] font-black text-white border ${opt.cardClass} relative overflow-hidden`}>
                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                        <span className="relative z-10 drop-shadow-md">{opt.previewText}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Visual Theme Color-Swatch Tiles (Compact 2-Row Grid) */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-white">
                  {t('settings.curatedThemes', 'Color Palette & Themes')}
                </h4>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Select a curated colorway across accents, progress bars, and glowing UI elements.
                </p>
              </div>
            </div>

            {/* Compact 2-row grid with 5 minimal, textless color swatch tiles per row */}
            <div className="grid grid-cols-5 gap-2 pt-1">
              {PRESETS.map((p) => {
                const isSelected = userProfile.activePreset === p.id || userProfile.accentColor === p.accentColor;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-preset-swatch="true"
                    onClick={() => applyPreset(p)}
                    title={p.name}
                    className={`relative aspect-square rounded-xl flex items-center justify-center transition-all cursor-pointer group overflow-hidden border ${
                      isSelected
                        ? 'ring-2 ring-white scale-105 shadow-lg border-white/40'
                        : 'border-white/10 hover:border-white/30 hover:scale-102 opacity-85 hover:opacity-100'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${p.accentHex} 0%, ${p.accentHex}bb 45%, #0f0f13 100%) !important`,
                      backgroundColor: p.accentHex,
                      boxShadow: isSelected ? `0 0 16px ${p.accentHex}66` : undefined,
                    }}
                  >
                    {/* Glossy corner highlight */}
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none rounded-t-xl" />

                    {/* Active checkmark */}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Player Progress Bar Style with Circular Color Swatch in Top-Right */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3 relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 pr-2">
                <h4 className="font-bold text-xs text-white">{t('settings.progressBarStyle', 'Player Progress Bar Style')}</h4>
                <p className="text-[11px] text-white/50 mt-0.5 truncate sm:whitespace-normal">
                  Neon with intense glow, Thick rectangular bar, and Sine Wave without playhead dot.
                </p>
              </div>

              {/* Circular Default-White Color Swatch in Top-Right (No clipping / flex-shrink-0) */}
              <button
                type="button"
                onClick={() => setIsProgressBarColorModalOpen(true)}
                className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center shadow-md border-2 border-white hover:scale-110 active:scale-95 transition-all cursor-pointer overflow-visible"
                style={{ backgroundColor: currentProgressBarColor }}
                title="Change Progress Bar Color"
              >
                <div className="w-2 h-2 rounded-full bg-black/20" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { id: 'default', label: 'Classic Slim' },
                { id: 'block', label: 'Thick Bar' },
                { id: 'wave', label: 'Sine Wave' },
                { id: 'aurora', label: 'Neon Glow' },
              ].map((opt) => {
                const isSelected = (userProfile.progressBarStyle || 'default') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      saveProgressBarStyle(opt.id);
                      syncProfile({ ...userProfile, progressBarStyle: opt.id as any });
                    }}
                    className={`p-3 rounded-xl border text-center flex flex-col items-center justify-between gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-white shadow-md scale-[1.02]'
                        : 'bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-black tracking-wide">
                      {opt.label}
                    </span>
                    {/* Live preview */}
                    <MiniProgressBarPreview
                      style={opt.id}
                      isSelected={isSelected}
                      customColor={currentProgressBarColor}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lyrics Settings with Top-Right Swatch and Bottom-Right Show More */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-3 relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 pr-2">
                <h4 className="font-bold text-xs text-white">{t('settings.lyricsFontStyle', 'Lyrics Typography & Color')}</h4>
                <p className="text-[11px] text-white/50 mt-0.5 truncate sm:whitespace-normal">
                  Visual preview scaled evenly across all font variants.
                </p>
              </div>

              {/* Circular Default-White Color Swatch in Top-Right (No clipping / flex-shrink-0) */}
              <button
                type="button"
                onClick={() => setIsLyricsColorModalOpen(true)}
                className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center shadow-md border-2 border-white hover:scale-110 active:scale-95 transition-all cursor-pointer overflow-visible"
                style={{ backgroundColor: currentLyricsColor }}
                title="Change Lyrics Highlight Color"
              >
                <div className="w-2 h-2 rounded-full bg-black/20" />
              </button>
            </div>

            {/* Quick 4-item preview grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {LYRICS_FONTS_ALL.slice(0, 4).map((f) => {
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
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 shadow-md scale-[1.02]'
                        : 'border-white/5 bg-black/40 hover:bg-white/5'
                    }`}
                  >
                    <span
                      style={{ fontFamily: f.font, color: currentLyricsColor }}
                      className="text-2xl font-black leading-none my-1 tracking-wide"
                    >
                      {f.preview}
                    </span>
                    <span className="text-[10px] font-bold text-white/80 truncate w-full">
                      {f.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom-Right "Show More" Button Opening Full Gallery */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsLyricsGalleryModalOpen(true)}
                className="flex items-center gap-1 text-xs font-extrabold text-[var(--accent)] hover:underline cursor-pointer px-2 py-1 rounded-lg bg-[var(--accent-soft)]"
              >
                <Type className="w-3.5 h-3.5" />
                <span>Show More Styles Gallery...</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. APP LOGO & SHORTCUT IDENTITY */}
      {showApp && (
        <section id="logo-customizer-section" className="flex flex-col gap-3.5 scroll-mt-20">
          <div className="flex items-center gap-2 pb-1 border-b border-white/10">
            <Smartphone className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white/70">
              {t('settings.appIdentity', 'App Logo & Home Screen Identity')}
            </h3>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">
                  {t('settings.customizeNameIcon', 'Customize Home Screen Name & Icon')}
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  {t('settings.customizeNameIconDesc', 'Personalize the shortcut title and emblem for your phone or desktop.')}
                </p>
              </div>
            </div>

            {/* Custom App Name Field */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>{t('settings.shortcutName', 'Shortcut Name on Home Screen')}</span>
                </label>
                <span className="text-[10px] text-white/40">{t('settings.shortcutNameDesc', 'Syncs without reinstalling')}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
                <input
                  type="text"
                  value={appNameInput}
                  onChange={(e) => setAppNameInput(e.target.value)}
                  placeholder="e.g. MOUZIKETNA, Habib's Music..."
                  maxLength={30}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/15 focus:border-[var(--accent)] text-white text-xs font-semibold placeholder:text-white/30 focus:outline-none transition-colors"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveAppName(appNameInput)}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer flex-shrink-0"
                  >
                    {nameSavedSuccess ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{nameSavedSuccess ? t('settings.saved', 'Saved!') : t('settings.saveName', 'Save Name')}</span>
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
                {t('settings.chooseEmblem', 'Choose App Icon Emblem:')}
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
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 shadow-md shadow-[var(--accent)]/10'
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
                <UploadCloud className="w-4 h-4 text-[var(--accent)]" />
                <span>{t('settings.uploadCustomPic', 'Upload & Crop Custom Picture...')}</span>
              </button>
              {userProfile.appLogo && userProfile.appLogo.startsWith('data:') && (
                <span className="text-xs text-[#28c76f] font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Custom Cropped Image Active
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. STORAGE & SYSTEM - CONSOLIDATED 4-SQUARE GRID */}
      {showSystem && (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2 pb-1 border-b border-white/10">
            <HardDrive className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-white/70">
              {t('settings.system', 'Storage, System & Server Dashboard')}
            </h3>
          </div>

          {/* Consolidated 4-Square Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Square 1: Offline Storage Size + Clear */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Offline Cache</span>
                  <HardDrive className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="text-2xl font-black text-white mt-1">{downloadSize}</div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {downloadedSet.size} offline tracks stored in browser
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openCollection('downloads')}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer text-center"
                >
                  Manage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalConfirm({
                      title: t('settings.clearDownloadsConfirmTitle', 'Clear all offline music?'),
                      text: t('settings.clearDownloadsConfirmDesc', 'This will delete all downloaded audio files from your browser storage.'),
                      onConfirm: async () => {
                        await clearAllDownloads();
                        showToast('All downloads cleared', true);
                      },
                    });
                  }}
                  className="py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Square 2: Check for Updates */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Release Updates</span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-base font-extrabold text-white mt-1 flex items-center gap-2">
                  <span>Check for Updates</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    v{APP_VERSION}
                  </span>
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Detects newest releases, syncs service workers, and busts stale mobile cache
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={isRefreshingApp}
                  onClick={async () => {
                    setIsRefreshingApp(true);
                    showToast('Checking for application updates...');
                    try {
                      const res = await checkForAppUpdates({ forceCheck: true });
                      if (res.hasUpdate) {
                        showToast(`⚡ New version found (v${res.latestVersion || 'latest'})! Updating app...`, true);
                        setTimeout(async () => {
                          await forceAppUpdateAndRefresh();
                        }, 800);
                      } else {
                        showToast(`✓ MOUZIKETNA is up to date (v${APP_VERSION})`, true);
                        setIsRefreshingApp(false);
                      }
                    } catch {
                      await forceAppUpdateAndRefresh();
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isRefreshingApp ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" /> : <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />}
                  <span>{isRefreshingApp ? 'Checking...' : 'Check for Updates'}</span>
                </button>

                <button
                  type="button"
                  disabled={isRefreshingApp}
                  onClick={async () => {
                    setIsRefreshingApp(true);
                    showToast('Purging cache & forcing clean network update...', true);
                    await forceAppUpdateAndRefresh();
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-transparent hover:bg-white/5 text-white/40 hover:text-white/80 font-semibold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Force Network Refresh</span>
                </button>
              </div>
            </div>

            {/* Square 3: Safe Reload (with helper text reassuring data safety) */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Safe Reload</span>
                  <RotateCcw className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-base font-extrabold text-white mt-1">Fast Safe Reload</div>
                <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                  ✓ Playlists, offline songs & preferences remain 100% safe.
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                <span>Safe Reload</span>
              </button>
            </div>

            {/* Square 4: Server Status Launcher */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Infrastructure</span>
                  <Activity className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="text-base font-extrabold text-white mt-1">Streaming Server Health</div>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Test latency & reachable status across all music mirror clusters
                </p>
              </div>

              <button
                type="button"
                onClick={runServerDiagnostics}
                className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Launch Server Status</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Account Settings Section (At the bottom of settings as requested) */}
      {(activeTab === 'all' || activeTab === 'app' || activeTab === 'system') && (
        <section className="flex flex-col gap-4 p-5 rounded-3xl bg-white/[0.03] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-[var(--accent)]" />
              <div>
                <h3 className="font-extrabold text-sm text-white">Account Settings & Credentials</h3>
                <p className="text-[11px] text-white/50">
                  Manage your linked email address, security credentials, and cloud synchronization.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-white/80">
              {globalUser ? `@${globalUser}` : 'Guest'}
            </span>
          </div>

          <div className="flex flex-col gap-3.5 p-4 rounded-2xl bg-black/40 border border-white/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs text-white">Email & Authentication Security</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {userProfile.email ? `Linked: ${userProfile.email}` : 'No email address linked yet'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAccountSettingsModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-all hover:brightness-110 active:scale-95 shadow-md shadow-[var(--accent)]/20 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Open Account Settings</span>
              </button>
            </div>

            {/* Quick Actions: Reset Password & Change Email */}
            <div className="pt-2.5 border-t border-white/5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setContactAdminModal({
                    type: 'password',
                    title: 'Reset Password Unavailable',
                    description:
                      'Self-service password reset is currently unavailable. Please contact the administrator to reset or recover your account password.',
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reset account password"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Password</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setContactAdminModal({
                    type: 'email',
                    title: 'Changing Email Unavailable',
                    description:
                      'Direct email address changing is currently unavailable. Please contact the administrator to update or change your registered email address.',
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Change registered email address"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Change Email</span>
              </button>

              {(globalUser === 'admin' || userProfile.isAdmin) && (
                <button
                  type="button"
                  onClick={() => setActivePane('admin')}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer sm:ml-auto"
                  title="Open Administrator Console"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Admin Console</span>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Generous Bottom Clearance Spacer so all buttons scroll far above the floating mini player and nav bar */}
      <div className="w-full h-40 md:h-24 flex-shrink-0" />

      {/* SERVER STATUS MODAL (Centered Rounded Blur Modal with Masked Hostnames) */}
      {isServerModalOpen && (
        <div
          onClick={() => setIsServerModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#16161a] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-[var(--accent)]" />
                <div>
                  <h3 className="font-black text-base text-white">Server Network Status</h3>
                  <p className="text-[10px] text-white/50">Real-time mirror latency & reachability</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsServerModalOpen(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {diagnosticsRunning ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                <span className="text-xs font-bold text-white/70">Pinging audio servers…</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
                {serverStats.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          item.status === 'Reachable' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-400'
                        }`}
                      />
                      <span className="font-extrabold text-xs text-white">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-extrabold ${
                          item.status === 'Reachable' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.latency !== undefined && (
                        <span className="text-xs font-mono text-white/40 tabular-nums">
                          {item.latency} ms
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={runServerDiagnostics}
                disabled={diagnosticsRunning}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Re-Test All</span>
              </button>

              <button
                type="button"
                onClick={() => setIsServerModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-all hover:brightness-110 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROGRESS BAR COLOR SWATCH MODAL */}
      {isProgressBarColorModalOpen && (
        <div
          onClick={() => setIsProgressBarColorModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#16161a] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-black text-base text-white">Progress Bar Color</h3>
              <button
                type="button"
                onClick={() => setIsProgressBarColorModalOpen(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Pick a preset color or choose any custom hex color for your progress bar.
            </p>

            {/* Presets Grid */}
            <div className="grid grid-cols-5 gap-2.5 py-1">
              {COLOR_SWATCH_PRESETS.map((swatch) => {
                const isSelected =
                  currentProgressBarColor.toLowerCase() === swatch.color.toLowerCase();
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => {
                      syncProfile({
                        ...userProfile,
                        progressBarColor: swatch.color,
                        customProgressBarHex: swatch.color,
                      });
                    }}
                    style={{ backgroundColor: swatch.color }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 cursor-pointer ${
                      isSelected ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    title={swatch.name}
                  >
                    {isSelected && <Check className="w-4 h-4 text-black stroke-[3]" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 mt-1">
              <span className="text-xs font-bold text-white">Custom Color Wheel</span>
              <input
                type="color"
                value={currentProgressBarColor}
                onChange={(e) => {
                  const hex = e.target.value;
                  syncProfile({
                    ...userProfile,
                    progressBarColor: hex,
                    customProgressBarHex: hex,
                  });
                }}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsProgressBarColorModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-all hover:brightness-110 cursor-pointer mt-1"
            >
              Apply Color
            </button>
          </div>
        </div>
      )}

      {/* LYRICS COLOR SWATCH MODAL */}
      {isLyricsColorModalOpen && (
        <div
          onClick={() => setIsLyricsColorModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#16161a] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-black text-base text-white">Lyrics Highlight Color</h3>
              <button
                type="button"
                onClick={() => setIsLyricsColorModalOpen(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Choose the glow color that illuminates singing synchronized lyrics.
            </p>

            {/* Presets Grid */}
            <div className="grid grid-cols-5 gap-2.5 py-1">
              {COLOR_SWATCH_PRESETS.map((swatch) => {
                const isSelected =
                  currentLyricsColor.toLowerCase() === swatch.color.toLowerCase();
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => {
                      syncProfile({
                        ...userProfile,
                        lyricsColor: swatch.id,
                        customLyricsHex: swatch.color,
                      });
                    }}
                    style={{ backgroundColor: swatch.color }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 cursor-pointer ${
                      isSelected ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    title={swatch.name}
                  >
                    {isSelected && <Check className="w-4 h-4 text-black stroke-[3]" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 mt-1">
              <span className="text-xs font-bold text-white">Custom Color Wheel</span>
              <input
                type="color"
                value={currentLyricsColor}
                onChange={(e) => {
                  const hex = e.target.value;
                  syncProfile({
                    ...userProfile,
                    lyricsColor: hex,
                    customLyricsHex: hex,
                  });
                }}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsLyricsColorModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-all hover:brightness-110 cursor-pointer mt-1"
            >
              Apply Color
            </button>
          </div>
        </div>
      )}

      {/* FULL LYRICS STYLES GALLERY MODAL */}
      {isLyricsGalleryModalOpen && (
        <div
          onClick={() => setIsLyricsGalleryModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#16161a] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-hidden"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="font-black text-base text-white">Lyrics Typography Gallery</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLyricsGalleryModalOpen(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60 flex-shrink-0">
              Select your synchronized lyrics typography. Sized consistently for comfortable stage reading.
            </p>

            <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1">
              {LYRICS_FONTS_ALL.map((f) => {
                const isSelected = (userProfile.lyricsFont || 'poppins') === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      syncProfile({ ...userProfile, lyricsFont: f.id as any });
                      showToast(`Typography set to ${f.label}`);
                    }}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent)]/15 shadow-lg shadow-[var(--accent)]/15 scale-[1.02]'
                        : 'border-white/10 bg-black/40 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white/80">{f.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent)] stroke-[3]" />}
                    </div>

                    <div
                      style={{ fontFamily: f.font, color: currentLyricsColor }}
                      className="text-xl sm:text-2xl font-bold leading-normal my-1 tracking-wide text-center truncate w-full px-1"
                    >
                      {f.preview}
                    </div>

                    <span className="text-[10px] text-white/40 leading-snug">
                      {f.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsLyricsGalleryModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-all hover:brightness-110 cursor-pointer flex-shrink-0 mt-1"
            >
              Done
            </button>
          </div>
        </div>
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

      {/* Contact Admin Modal for Unavailable Reset Password & Change Email */}
      {contactAdminModal && (
        <div
          onClick={() => setContactAdminModal(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#16161a] border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200"
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                contactAdminModal.type === 'password'
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-amber-500/10'
                  : 'bg-sky-500/15 border border-sky-500/30 text-sky-400 shadow-sky-500/10'
              }`}
            >
              {contactAdminModal.type === 'password' ? (
                <Lock className="w-6 h-6" />
              ) : (
                <Mail className="w-6 h-6" />
              )}
            </div>

            <div>
              <h4 className="font-black text-base text-white">{contactAdminModal.title}</h4>
              <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                {contactAdminModal.description}
              </p>
            </div>

            {(globalUser === 'admin' || userProfile.isAdmin) && (
              <div className="p-3 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[11px] text-[var(--accent)] font-semibold w-full text-left flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  As an administrator, you have access to modify all passwords and user credentials in the Admin Console.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2 w-full pt-1">
              {(globalUser === 'admin' || userProfile.isAdmin) && (
                <button
                  type="button"
                  onClick={() => {
                    setContactAdminModal(null);
                    setActivePane('admin');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-black font-extrabold text-xs transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer shadow-md"
                >
                  Open Admin Console
                </button>
              )}

              <button
                type="button"
                onClick={() => setContactAdminModal(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={isAccountSettingsModalOpen}
        onClose={() => setIsAccountSettingsModalOpen(false)}
      />
    </div>
  );
};
