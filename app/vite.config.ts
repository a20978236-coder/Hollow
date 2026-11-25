import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Universal Modder Mobile',
        short_name: 'UModder',
        description: 'AI-powered game modding platform for iPhone',
        theme_color: '#05070b',
        background_color: '#05070b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'cdn.modrinth.com' && /\.(png|jpe?g|webp|gif)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'mod-images', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
})
