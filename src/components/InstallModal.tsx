import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, Smartphone, Check, X, Sparkles } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const isIosDevice = /iPhone|iPad|iPod/i.test(ua);
    const isAndroidDevice = /Android/i.test(ua);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);
    setIsInstalled(isStandalone);

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    };

    window.addEventListener('pwa-installed', handleInstalled);
    return () => window.removeEventListener('pwa-installed', handleInstalled);
  }, [onClose]);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    const promptEvent = (window as unknown as { __deferredPrompt?: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } }).__deferredPrompt;

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallSuccess(true);
          setTimeout(() => onClose(), 1500);
        }
      } catch (err) {
        console.warn('Install prompt failed:', err);
      }
    }
  };

  return (
    <div
      id="install-app-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="install-app-modal-container"
        className="w-full max-w-md bg-[#161619] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-lg relative overflow-hidden">
              <img
                src="./apple-touch-icon.png"
                alt="MOUZIKA"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h3 className="font-black text-lg text-white leading-tight">Install MOUZIKA</h3>
              <p className="text-xs text-[#ff6b1a] font-medium">Standalone Native Experience</p>
            </div>
          </div>
          <button
            id="install-modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status / Success */}
        {installSuccess ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-[#28c76f]/20 border border-[#28c76f]/40 flex items-center justify-center text-[#28c76f]">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-lg text-white">MOUZIKA Installed!</h4>
            <p className="text-xs text-white/60 max-w-xs">
              MOUZIKA has been added to your phone's home screen. You can now launch it like any native app.
            </p>
          </div>
        ) : isInstalled ? (
          <div className="py-6 flex flex-col items-center gap-2 text-center bg-white/[0.02] rounded-2xl p-4 border border-white/5">
            <Check className="w-6 h-6 text-[#28c76f]" />
            <h4 className="font-bold text-sm text-white">Already Installed</h4>
            <p className="text-xs text-white/50">
              You are currently running the installed version of MOUZIKA.
            </p>
          </div>
        ) : (
          <>
            {/* Value props */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1">
                <Sparkles className="w-4 h-4 text-[#ff6b1a]" />
                <span className="font-bold text-white">Full Screen</span>
                <span className="text-[11px] text-white/50">No browser address bar</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1">
                <Smartphone className="w-4 h-4 text-[#ff6b1a]" />
                <span className="font-bold text-white">Offline Ready</span>
                <span className="text-[11px] text-white/50">Cached player & songs</span>
              </div>
            </div>

            {/* Platform Instructions */}
            {isIOS ? (
              <div className="flex flex-col gap-3 bg-white/[0.03] border border-white/5 p-4 rounded-2xl">
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">
                  How to install on iOS Safari:
                </span>
                <div className="flex items-start gap-3 text-xs text-white/80">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-[#ff6b1a]">
                    <Share className="w-3.5 h-3.5" />
                  </div>
                  <span>
                    1. Tap the <strong className="text-white">Share</strong> button at the bottom of Safari.
                  </span>
                </div>
                <div className="flex items-start gap-3 text-xs text-white/80">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-[#ff6b1a]">
                    <PlusSquare className="w-3.5 h-3.5" />
                  </div>
                  <span>
                    2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-3 text-xs text-white/80">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-[#ff6b1a]">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>
                    3. Tap <strong className="text-white">Add</strong> in the top-right corner.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  id="native-pwa-install-action-btn"
                  onClick={handleNativeInstall}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#ff6b1a] hover:bg-[#ff7d33] active:scale-[0.98] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b1a]/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App Now</span>
                </button>

                <p className="text-[11px] text-center text-white/50">
                  {isAndroid
                    ? "Tap 'Install App Now' or tap the 3 dots in Chrome and select 'Install app'."
                    : "Installs MOUZIKA natively to your applications menu and desktop."}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
