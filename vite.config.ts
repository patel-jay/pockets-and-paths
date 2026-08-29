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
      includeAssets: ['favicon.svg'],
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
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
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
    port: 4173,
    strictPort: true,
  },
});
