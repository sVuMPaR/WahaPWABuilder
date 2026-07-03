import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import sirv from 'sirv';

const repoBase = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.VITE_BASE ?? (repoBase ? `/${repoBase}/` : '/');

export default defineConfig({
  base,
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  plugins: [
    {
      name: 'serve-data-packs',
      configureServer(server) {
        const serve = sirv(resolve('data/packs'), { dev: true, etag: true });
        server.middlewares.use('/data', (req, res, next) => {
          serve(req, res, next);
        });
      },
      closeBundle() {
        // dist/data is populated by the postbuild script
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Waha PWA Builder',
        short_name: 'WahaBuilder',
        description: 'Warhammer 40k army list builder — powered by Wahapedia data',
        theme_color: '#1a1a2e',
        background_color: '#0f0f1a',
        display: 'standalone',
        start_url: base,
        icons: [
          {
            src: `${base}icons/icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2,json}'],
        globIgnores: ['**/data/wahapedia/factions/**', '**/data/mfm/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/data\//],
        runtimeCaching: [
          {
            urlPattern: /\/data\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'data-packs',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
