// Corrected nuxt.config.ts
import { resolve } from 'path'

export default defineNuxtConfig({
  compatibilityDate: '2024-05-15',
  devtools: { enabled: true },
  devServer: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 3000
  },
  nitro: {
    preset: 'node-server'
  },
  // Workaround for Vite import analysis failing to resolve Nuxt's virtual module
  // "#app-manifest" in dev. We alias it to a local stub so analysis succeeds.
  vite: {
    resolve: {
      alias: {
        '#app-manifest': resolve(__dirname, 'stubs/app-manifest.ts')
      }
    },
    build: {
      cssMinify: 'lightningcss',
      rollupOptions: {
        onwarn(warning, warn) {
          // Suppress CSS minification warnings from Tailwind
          if (warning.code === 'CSS_SYNTAX_ERROR') return
          warn(warning)
        }
      }
    },
    css: {
      postcss: {
        plugins: []
      }
    }
  },
  runtimeConfig: {
    mongodbUri: process.env.MONGO_CONNECTION_STRING,
    jwtSecret: process.env.JWT_SECRET,
    jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    // SMTP configuration (private - server-only)
    // Azure uses EMAIL_* variables, fallback to SMTP_* for local dev
    smtpHost: process.env.SMTP_HOST || process.env.EMAIL_HOST || process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT || process.env.EMAIL_PORT || '587',
    smtpUser: process.env.SMTP_USER || process.env.EMAIL_USER,
    smtpPass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    emailFrom: process.env.EMAIL_FROM || 'noreply@easemycargo.com',
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3000',
      baseUrl: process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    }
  },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config',
    viewer: true,
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'EaseMyCargo',
      short_name: 'EMC',
      description: 'Cargo Management System',
      theme_color: '#2563eb',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      // Clean old caches on activation
      cleanupOutdatedCaches: true,
      // Skip waiting and immediately activate new service worker
      skipWaiting: true,
      clientsClaim: true,
      runtimeCaching: [
        // Cache HTML pages with NetworkFirst strategy
        {
          urlPattern: ({ request, url }) => 
            request.destination === 'document' || 
            url.pathname.match(/^\/(profile-pwa|dashboard|login)/) !== null,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 86400 // 24 hours
            },
            networkTimeoutSeconds: 3, // Fallback to cache after 3s timeout
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        // Cache API calls with NetworkFirst
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 300 // 5 minutes
            },
            networkTimeoutSeconds: 5,
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        // Cache static assets with CacheFirst
        {
          urlPattern: ({ request }) => 
            request.destination === 'style' ||
            request.destination === 'script' ||
            request.destination === 'image' ||
            request.destination === 'font',
          handler: 'CacheFirst',
          options: {
            cacheName: 'assets-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 2592000 // 30 days
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600 // Check for updates every hour
    },
    devOptions: {
      enabled: true,
      type: 'module'
    }
  }
});