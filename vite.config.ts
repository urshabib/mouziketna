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

        // Update sw.js cache name with new timestamp to ensure instant mobile cache invalidation
        const updateSwCacheName = (filePath: string) => {
          if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf-8');
            content = content.replace(/const CACHE_NAME = ['"][^'"]+['"];/, `const CACHE_NAME = 'mouzika-pwa-${buildTimestamp}';`);
            fs.writeFileSync(filePath, content);
          }
        };
        updateSwCacheName('sw.js');
        updateSwCacheName('public/sw.js');

        // Update window.__MOUZIKETNA_BUILD_TIME__ in index.html
        if (fs.existsSync('index.html')) {
          let html = fs.readFileSync('index.html', 'utf-8');
          html = html.replace(/window\.__MOUZIKETNA_BUILD_TIME__\s*=\s*['"][^'"]+['"];/, `window.__MOUZIKETNA_BUILD_TIME__ = '${buildTimestamp}';`);
          fs.writeFileSync('index.html', html);
        }
      } catch (e) {
        console.warn('Could not write version metadata:', e);
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
        if (fs.existsSync('dist/sw.js')) {
          let content = fs.readFileSync('dist/sw.js', 'utf-8');
          content = content.replace(/const CACHE_NAME = ['"][^'"]+['"];/, `const CACHE_NAME = 'mouzika-pwa-${buildTimestamp}';`);
          fs.writeFileSync('dist/sw.js', content);
        }
      } catch (e) {
        console.warn('Could not write dist/version.json:', e);
      }
    }
  };

  const manifestFixPlugin = {
    name: 'mouziketna-manifest-path-fixer',
    enforce: 'post' as const,
    transformIndexHtml(html: string) {
      // Ensure Vite never points link[rel="manifest"] to ./assets/manifest.json
      // This is crucial: Chrome uses the manifest URL to resolve start_url and scope!
      return html
        .replace(/href=["']\.\/assets\/manifest\.json["']/g, 'href="./manifest.json"')
        .replace(/href=["']assets\/manifest\.json["']/g, 'href="./manifest.json"')
        .replace(/href=["']\.\/assets\/(favicon[^"']*)["']/g, 'href="./$1"')
        .replace(/href=["']\.\/assets\/(icon[^"']*)["']/g, 'href="./$1"')
        .replace(/href=["']\.\/assets\/(apple-touch-icon\.png)["']/g, 'href="./$1"')
        .replace(/content=["']\.\/assets\/(icon-512\.png)["']/g, 'content="./$1"');
    },
    closeBundle() {
      try {
        // 1. Post-process dist/index.html to ensure clean root links
        if (fs.existsSync('dist/index.html')) {
          let html = fs.readFileSync('dist/index.html', 'utf-8');
          html = html
            .replace(/href=["']\.\/assets\/manifest\.json["']/g, 'href="./manifest.json"')
            .replace(/href=["']assets\/manifest\.json["']/g, 'href="./manifest.json"')
            .replace(/href=["']\.\/assets\/(favicon[^"']*)["']/g, 'href="./$1"')
            .replace(/href=["']\.\/assets\/(icon[^"']*)["']/g, 'href="./$1"')
            .replace(/href=["']\.\/assets\/(apple-touch-icon\.png)["']/g, 'href="./$1"')
            .replace(/content=["']\.\/assets\/(icon-512\.png)["']/g, 'content="./$1"');
          fs.writeFileSync('dist/index.html', html);
        }

        // 2. Write assets/index.html redirector inside dist/assets/
        const redirectHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MOUZIKETNA</title>
    <script>
      (function() {
        var l = window.location;
        var p = l.pathname;
        var cleanTarget = p.replace(/\\/assets\\/?$/, '/');
        l.replace(l.origin + cleanTarget + l.search + l.hash);
      })();
    </script>
    <meta http-equiv="refresh" content="0; url=../" />
  </head>
  <body style="background-color: #000000; color: #ffffff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif;">
    <div style="text-align: center;">
      <p style="font-size: 16px; font-weight: bold;">Loading MOUZIKETNA...</p>
      <a href="../" style="color: #ff6b1a; text-decoration: none; font-size: 14px;">Open Player</a>
    </div>
  </body>
</html>`;
        if (fs.existsSync('dist/assets')) {
          fs.writeFileSync('dist/assets/index.html', redirectHtml);
        }

        // 3. If dist/assets/manifest.json exists, update start_url to "../" so it points back to root
        if (fs.existsSync('dist/assets/manifest.json')) {
          try {
            const m = JSON.parse(fs.readFileSync('dist/assets/manifest.json', 'utf-8'));
            m.start_url = '../';
            m.scope = '../';
            if (Array.isArray(m.icons)) {
              m.icons = m.icons.map((ic: any) => ({
                ...ic,
                src: ic.src.startsWith('./') ? '../' + ic.src.slice(2) : ic.src
              }));
            }
            fs.writeFileSync('dist/assets/manifest.json', JSON.stringify(m, null, 2));
          } catch {}
        }
      } catch (err) {
        console.warn('Could not post-process manifest/assets:', err);
      }
    }
  };

  return {
    base: basePath,
    define: {
      __APP_BUILD_TIME__: JSON.stringify(buildTimestamp),
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [react(), tailwindcss(), versionPlugin, manifestFixPlugin],
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
