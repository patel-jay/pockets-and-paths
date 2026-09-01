import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { sites } from '@openai/sites-vite-plugin';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo-mark.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pockets & Paths',
        short_name: 'Pockets',
        description: 'A multi-currency budget planner for everyday life and temporary journeys.',
        theme_color: '#173b36',
        background_color: '#f3f0e9',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/graphql',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
    cloudflare(),
    sites(),
  ],
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
});
