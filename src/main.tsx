import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import './index.css';

// Early Synchronous Theme & Layout Initialization
// Applies saved theme, liquid glass blur, and RTL language attributes BEFORE React mount to prevent flicker
if (typeof window !== 'undefined') {
  (window as any).__mouzikaLoaded = true;
  (window as any).__MOUZIKETNA_DEV_LOADED__ = true;

  try {
    const rawDev = localStorage.getItem('mouzika_device_settings');
    if (rawDev) {
      const dev = JSON.parse(rawDev);
      if (dev) {
        const theme = dev.theme || 'dark';
        const accent = dev.accentColor || 'orange';
        const lyricsColor = dev.lyricsColor || 'white';
        const presetTint = dev.presetTint || 'none';
        const uiScale = dev.uiScale || 'default';
        const lyricsGlow = dev.lyricsGlow || 'default';
        const lang = dev.language || 'en';
        const glassLevel = dev.liquidGlassLevel || (dev.liquidGlass ? 'medium' : 'off');

        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-accent', accent);
        document.documentElement.setAttribute('data-lyrics-color', lyricsColor);
        document.documentElement.setAttribute('data-preset-tint', presetTint);
        document.documentElement.setAttribute('data-ui-scale', uiScale);
        document.documentElement.setAttribute('data-lyrics-glow', lyricsGlow);
        document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', lang);

        if (dev.customAccentHex) {
          document.documentElement.style.setProperty('--accent', dev.customAccentHex);
          document.documentElement.style.setProperty('--accent-hover', dev.customAccentHex);
          document.documentElement.style.setProperty('--accent-soft', `${dev.customAccentHex}28`);
        }

        const isUltra = glassLevel === 'ultra';
        const isMedium = glassLevel === 'medium' || (glassLevel !== 'off' && dev.liquidGlass !== false);
        document.body.classList.toggle('liquid-glass', isMedium && !isUltra);
        document.body.classList.toggle('liquid-glass-ultra', isUltra);
      }
    }
  } catch (e) {
    console.warn('Early theme initialization error:', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


