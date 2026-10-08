import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(({command}) => {
  // Use relative base ('./') for production so assets load on any root, custom domain, or GitHub Pages subpath
  const basePath = process.env.BASE_URL || (command === 'serve' ? '/' : './');
  const buildTimestamp = Date.now();
  const appVersion = '1.2.1';

  const versionPlugin = {
    name: 'mouziketna-version-generator',
    buildStart() {
      const versionPayload = JSON.stringify({
        version: appVersion,
        buildTime: buildTimestamp,
        buildDate: new Date(buildTimestamp).toISOString(),
        appName: 'MOUZIKETNA'
      }, null, 2);
      try {
        if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });
        fs.writeFileSync('public/version.json', versionPayload);
        fs.writeFileSync('version.json', versionPayload);
      } catch (e) {
        console.warn('Could not write public/version.json:', e);
      }
    },
    closeBundle() {
      const versionPayload = JSON.stringify({
        version: appVersion,
        buildTime: buildTimestamp,
        buildDate: new Date(buildTimestamp).toISOString(),
        appName: 'MOUZIKETNA'
      }, null, 2);
      try {
        if (fs.existsSync('dist')) {
          fs.writeFileSync('dist/version.json', versionPayload);
        }
      } catch (e) {
        console.warn('Could not write dist/version.json:', e);
      }
    }
  };

  return {
    base: basePath,
    define: {
      __APP_BUILD_TIME__: JSON.stringify(buildTimestamp),
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [react(), tailwindcss(), versionPlugin],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
