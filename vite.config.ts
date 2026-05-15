import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use generateSW to let Workbox handle the service worker automatically
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true, // Enable SW in dev for testing
        type: 'module',
      },
      includeAssets: ['favicon.svg', 'icons.svg', 'sounds/notifications_Krantos.mp3'],
      manifest: {
        name: 'Krantos — Énergie Renouvelable',
        short_name: 'Krantos',
        description: 'Plateforme premium de solutions énergétiques renouvelables. Fonctionne hors-ligne.',
        theme_color: '#FACC15',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Calculer ma puissance',
            url: '/calculate-power',
            description: 'Calculateur de puissance énergétique'
          },
          {
            name: 'Admin',
            url: '/admin-login',
            description: 'Panneau administrateur Krantos'
          }
        ]
      },
      workbox: {
        // Precache all app shell assets (JS, CSS, HTML, icons)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webp}'],

        // Network-first for navigation (pages) — falls back to cache
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(api|supabase)\//],

        runtimeCaching: [
          // App shell pages — NetworkFirst with offline fallback
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Supabase Auth — NetworkOnly (security: never cache auth tokens)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\//,
            handler: 'NetworkOnly',
          },
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          // Static assets — CacheFirst
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          // JS/CSS bundles — StaleWhileRevalidate
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
    })
  ],
})
