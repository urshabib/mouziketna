import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { getStoredAppName, applyCustomAppName } from '../services/pwa';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlatformTab = 'android' | 'ios' | 'desktop';

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<PlatformTab>('android');
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [appName, setAppName] = useState<string>(getStoredAppName());
  const [nameSavedToast, setNameSavedToast] = useState(false);

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

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    };

    window.addEventListener('pwa-installed', handleInstalled);
    return () => window.removeEventListener('pwa-installed', handleInstalled);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setAppName(val);
    applyCustomAppName(val);
    setNameSavedToast(true);
    setTimeout(() => setNameSavedToast(false), 2000);
  };

  const handleResetName = () => {
    setAppName('MOUZIKA');
    applyCustomAppName('MOUZIKA');
    setNameSavedToast(true);
    setTimeout(() => setNameSavedToast(false), 2000);
  };

  const handleNativeInstall = async () => {
    const promptEvent = (
      window as unknown as {
        __deferredPrompt?: {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string }>;
        };
      }
    ).__deferredPrompt;

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallSuccess(true);
          setTimeout(() => onClose(), 2000);
        }
      } catch (err) {
        console.warn('Install prompt failed:', err);
      }
    }
  };

  return (
    <div
      id="install-app-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="install-app-modal-container"
        className="w-full sm:max-w-md bg-[#161619] border-t sm:border border-white/10 rounded-t-[2rem] sm:rounded-3xl p-5 sm:p-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-2xl flex flex-col gap-4 text-white max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Pull indicator */}
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto mb-1 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-lg relative overflow-hidden flex-shrink-0">
              <img
                src="./apple-touch-icon.png"
                alt={appName || 'MOUZIKA'}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-base sm:text-lg text-white leading-tight truncate">
                Install {appName || 'MOUZIKA'}
              </h3>
              <p className="text-[11px] text-[#ff6b1a] font-semibold">
                Standalone App • Offline Ready
              </p>
            </div>
          </div>
          <button
            id="install-modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
                  <span>Customize App Name</span>
                </label>
                {appName !== 'MOUZIKA' && (
                  <button
                    type="button"
                    onClick={handleResetName}
                    className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white transition-colors"
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
                  placeholder="e.g. MOUZIKA, My Music"
                  maxLength={28}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#ff6b1a] transition-colors"
                />
                {nameSavedToast && (
                  <span className="absolute right-3 top-2.5 text-[11px] font-bold text-[#28c76f] animate-in fade-in">
                    Saved!
                  </span>
                )}
              </div>
              <p className="text-[10px] text-white/40 leading-snug">
                This updates your manifest and shortcut name on your home screen.
              </p>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
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
                className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
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
                className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
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
                    If "Install App" doesn't prompt automatically:
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

                <div className="p-3 rounded-xl bg-[#ff6b1a]/10 border border-[#ff6b1a]/20 text-[11px] text-white/80 leading-relaxed">
                  <strong className="text-[#ff6b1a] block mb-0.5">Android Pro Tip:</strong>
                  Selecting <strong className="text-white">"Add to Home screen"</strong> from
                  Chrome's 3-dot menu opens a dialog where you can change the name right on your
                  screen!
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

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-white/60 leading-relaxed">
                  Apple Safari allows editing the app name directly in the "Add to Home Screen"
                  popup window.
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
                    Once installed, the app launches as its own native window on Windows, Mac, and
                    Linux.
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
    </div>
  );
};
