import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Share,
  PlusSquare,
  Smartphone,
  Check,
  X,
  Sparkles,
  SmartphoneNfc,
  Monitor,
  Edit3,
  RotateCcw,
  CheckCircle2,
  Info,
  Palette,
  UploadCloud,
  FileCode,
} from 'lucide-react';
import {
  getStoredAppName,
  applyCustomAppName,
  DEFAULT_APP_NAME,
  LOGO_PRESETS,
  getStoredAppLogo,
  applyCustomAppLogo,
  getAppLogoSrc,
  promptPwaInstall,
} from '../services/pwa';
import { useMusic } from '../context/MusicContext';
import { LogoCropperModal } from './LogoCropperModal';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlatformTab = 'android' | 'ios' | 'desktop';

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, syncProfile } = useMusic();
  const [activeTab, setActiveTab] = useState<PlatformTab>('android');
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [appName, setAppName] = useState<string>(getStoredAppName());
  const [nameSavedToast, setNameSavedToast] = useState(false);
  const [promptNotice, setPromptNotice] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<string>(getStoredAppLogo());
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [showFileGuide, setShowFileGuide] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const ua = navigator.userAgent || '';
    const isIosDevice = /iPhone|iPad|iPod/i.test(ua);
    const isAndroidDevice = /Android/i.test(ua);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIosDevice) {
      setActiveTab('ios');
    } else if (isAndroidDevice) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    setIsInstalled(isStandalone);
    setAppName(getStoredAppName());
    setSelectedLogo(getStoredAppLogo());

    const handleLogoChanged = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setSelectedLogo(customEvent.detail || getStoredAppLogo());
    };

    window.addEventListener('mouzika-logo-changed', handleLogoChanged);
    return () => {
      window.removeEventListener('mouzika-logo-changed', handleLogoChanged);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setAppName(val);
    applyCustomAppName(val);
    syncProfile({ ...userProfile, customAppName: val });
    setNameSavedToast(true);
    setTimeout(() => setNameSavedToast(false), 2000);
  };

  const handleResetName = () => {
    setAppName(DEFAULT_APP_NAME);
    applyCustomAppName(DEFAULT_APP_NAME);
    syncProfile({ ...userProfile, customAppName: DEFAULT_APP_NAME });
    setNameSavedToast(true);
    setTimeout(() => setNameSavedToast(false), 2000);
  };

  const handleSelectPresetLogo = async (presetId: string) => {
    setSelectedLogo(presetId);
    syncProfile({ ...userProfile, appLogo: presetId });
    await applyCustomAppLogo(presetId);
    try {
      sessionStorage.setItem('mouzika_restore_install_modal', 'true');
    } catch {}
    setTimeout(() => {
      window.location.reload();
    }, 120);
  };

  const handleCustomLogoCropped = async (dataUrl: string) => {
    setSelectedLogo(dataUrl);
    syncProfile({ ...userProfile, appLogo: dataUrl });
    await applyCustomAppLogo(dataUrl);
    try {
      sessionStorage.setItem('mouzika_restore_install_modal', 'true');
    } catch {}
    setTimeout(() => {
      window.location.reload();
    }, 120);
  };

  const handleNativeInstall = async () => {
    // Ensure the chosen logo & app name are fully rasterized and cached in the Service Worker prior to the prompt
    try {
      await applyCustomAppLogo(selectedLogo);
      await applyCustomAppName(appName);
    } catch {}

    const result = await promptPwaInstall();
    if (result.outcome === 'accepted') {
      setInstallSuccess(true);
      setTimeout(() => onClose(), 2000);
      return;
    } else if (result.outcome === 'dismissed') {
      setPromptNotice('Installation was dismissed. You can install anytime!');
      return;
    }

    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setActiveTab('ios');
      setPromptNotice('iOS Safari uses the Share menu: Tap Share (⎋) then "Add to Home Screen".');
    } else {
      setPromptNotice('Tap your browser menu (⋮) at the top right and select "Install app" (or "Add to Home screen").');
    }
  };

  const currentLogoSrc = getAppLogoSrc(selectedLogo);

  const modalContent = (
    <div
      id="install-app-modal-backdrop"
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        id="install-app-modal-container"
        className="w-full sm:max-w-md bg-[#161619] border-t sm:border border-white/10 rounded-t-[2rem] sm:rounded-3xl p-5 sm:p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-2xl flex flex-col gap-4 text-white max-h-[90vh] overflow-y-auto transform transition-transform duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Pull indicator */}
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto mb-1 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-lg relative overflow-hidden flex-shrink-0">
              <img
                src={currentLogoSrc}
                alt={appName || DEFAULT_APP_NAME}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-base sm:text-lg text-white leading-tight truncate">
                Install {appName || DEFAULT_APP_NAME}
              </h3>
              <p className="text-[11px] text-[#ff6b1a] font-semibold">
                Standalone App • Offline Ready
              </p>
            </div>
          </div>
          <button
            id="install-modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice banner when prompt clicked without deferred prompt */}
        {promptNotice && (
          <div className="p-3 rounded-xl bg-[#ff6b1a]/15 border border-[#ff6b1a]/30 flex items-start gap-2.5 text-xs text-white">
            <Info className="w-4 h-4 text-[#ff6b1a] flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{promptNotice}</span>
          </div>
        )}

        {/* Success / Installed State */}
        {installSuccess ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-[#28c76f]/20 border border-[#28c76f]/40 flex items-center justify-center text-[#28c76f]">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-lg text-white">{appName} Installed!</h4>
            <p className="text-xs text-white/60 max-w-xs leading-relaxed">
              The app has been added to your phone's home screen. You can now launch it directly
              with no browser tabs or address bar.
            </p>
          </div>
        ) : isInstalled ? (
          <div className="py-6 flex flex-col items-center gap-2 text-center bg-white/[0.03] rounded-2xl p-4 border border-white/5">
            <CheckCircle2 className="w-8 h-8 text-[#28c76f]" />
            <h4 className="font-bold text-sm text-white">App Already Installed</h4>
            <p className="text-xs text-white/50 leading-relaxed">
              You are running {appName} in standalone native mode.
            </p>
          </div>
        ) : (
          <>
            {/* Custom App Name Input */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="custom-app-name-input"
                  className="flex items-center gap-1.5 text-xs font-bold text-white/90"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#ff6b1a]" />
                  <span>Home Screen App Shortcut Name</span>
                </label>
                {appName !== DEFAULT_APP_NAME && (
                  <button
                    type="button"
                    onClick={handleResetName}
                    className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="custom-app-name-input"
                  type="text"
                  value={appName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={`e.g. ${DEFAULT_APP_NAME}, My Music`}
                  maxLength={28}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#ff6b1a] transition-colors"
                />
                {nameSavedToast && (
                  <span className="absolute right-3 top-2.5 text-[11px] font-bold text-[#28c76f]">
                    Saved!
                  </span>
                )}
              </div>
              <p className="text-[10px] text-white/40 leading-snug">
                Sets the title of the app shortcut icon on your phone's home screen.
              </p>
            </div>

            {/* Custom App Logo / Icon Chooser */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-white/90">
                  <Palette className="w-3.5 h-3.5 text-[#ff6b1a]" />
                  <span>App Logo & Icon</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowFileGuide(!showFileGuide)}
                  className="text-[10px] text-white/50 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FileCode className="w-3 h-3" />
                  <span>File Paths</span>
                </button>
              </div>

              {/* Logo Preset Chips */}
              <div className="grid grid-cols-3 gap-2">
                {LOGO_PRESETS.map((preset) => {
                  const isCurrent = selectedLogo === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetLogo(preset.id)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-[#ff6b1a] bg-[#ff6b1a]/15 shadow-md shadow-[#ff6b1a]/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/15 bg-black flex items-center justify-center">
                        <img
                          src={preset.svgDataUri}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-white/80 leading-tight text-center truncate w-full">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Crop Button */}
              <button
                type="button"
                onClick={() => setIsCropperOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/90 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#ff6b1a]" />
                <span>Upload & Crop Custom Picture</span>
              </button>

              {/* File placement instructions (if user wants to download/paste files) */}
              {showFileGuide && (
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-[10px] text-white/70 space-y-1">
                  <div className="font-bold text-[#ff6b1a]">To permanently replace app icon files:</div>
                  <p>Download your desired logo and put files into the project at:</p>
                  <code className="block bg-white/5 p-1.5 rounded text-white font-mono text-[9px] leading-relaxed">
                    /public/icon-512.png<br />
                    /public/icon-192.png<br />
                    /public/apple-touch-icon.png<br />
                    /public/favicon.ico &amp; favicon.png
                  </code>
                </div>
              )}
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'android'
                    ? 'bg-[#ff6b1a] text-black shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android / Chrome</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'ios'
                    ? 'bg-[#ff6b1a] text-black shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <SmartphoneNfc className="w-3.5 h-3.5" />
                <span>iPhone / iOS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('desktop')}
                className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'desktop'
                    ? 'bg-[#ff6b1a] text-black shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>PC / Mac</span>
              </button>
            </div>

            {/* Android Instructions */}
            {activeTab === 'android' && (
              <div className="flex flex-col gap-3">
                <button
                  id="native-pwa-install-action-btn"
                  onClick={handleNativeInstall}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-[0.98] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b1a]/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App Now</span>
                </button>

                <div className="flex flex-col gap-2.5 bg-white/[0.03] border border-white/5 p-3.5 rounded-2xl">
                  <span className="text-xs font-bold text-white/90">
                    If 1-tap install doesn't appear:
                  </span>
                  <div className="flex items-start gap-2.5 text-xs text-white/80">
                    <span className="w-5 h-5 rounded-md bg-[#ff6b1a]/20 text-[#ff6b1a] flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                      1
                    </span>
                    <span>
                      Tap the <strong className="text-white">three dots menu (⋮)</strong> at the top
                      right of Chrome.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-white/80">
                    <span className="w-5 h-5 rounded-md bg-[#ff6b1a]/20 text-[#ff6b1a] flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                      2
                    </span>
                    <span>
                      Tap <strong className="text-white">Install app</strong> or{' '}
                      <strong className="text-white">Add to Home screen</strong>.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* iOS Instructions */}
            {activeTab === 'ios' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2.5 bg-white/[0.03] border border-white/5 p-3.5 rounded-2xl">
                  <span className="text-xs font-bold text-white/90">
                    How to install on iPhone & iPad (Safari):
                  </span>
                  <div className="flex items-start gap-2.5 text-xs text-white/80">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-[#ff6b1a]">
                      <Share className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      1. Tap the <strong className="text-white">Share</strong> button at the bottom
                      bar of Safari.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-white/80">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-[#ff6b1a]">
                      <PlusSquare className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      2. Scroll down and tap{' '}
                      <strong className="text-white">Add to Home Screen</strong>.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-white/80">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-[#ff6b1a]">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      3. Tap the title to change the name, then tap{' '}
                      <strong className="text-white">Add</strong> at top right.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Instructions */}
            {activeTab === 'desktop' && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleNativeInstall}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-[0.98] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b1a]/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Install to Desktop</span>
                </button>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-white/80 flex flex-col gap-2 leading-relaxed">
                  <p>
                    In Chrome or Edge, click the <strong className="text-white">Install (⊕)</strong>{' '}
                    icon on the right side of the address bar.
                  </p>
                  <p className="text-white/50 text-[11px]">
                    Once installed, the app launches as its own standalone window on Windows, Mac,
                    and Linux.
                  </p>
                </div>
              </div>
            )}

            {/* Value Highlights */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#ff6b1a]" />
                <span className="font-bold text-white text-[11px]">Full Screen</span>
                <span className="text-[10px] text-white/50">No browser address bar</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                <Smartphone className="w-3.5 h-3.5 text-[#ff6b1a]" />
                <span className="font-bold text-white text-[11px]">Offline Audio</span>
                <span className="text-[10px] text-white/50">Saved songs without WiFi</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cropper Modal for custom logo uploads */}
      <LogoCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        onApply={handleCustomLogoCropped}
        currentLogoSrc={currentLogoSrc}
      />
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
