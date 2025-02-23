import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["alarm.wav", "*.png"],
      manifest: {
        name: "Alarm Note",
        short_name: "AlarmNote",
        description: "Todo List with Alarm Features",
        theme_color: "#3b82f6",
        icons: [
          {
            src: "/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/tasks/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tasks-cache',
              backgroundSync: {
                name: 'tasks-queue',
                options: {
                  maxRetentionTime: 24 * 60 // 24 hours
                }
              }
            }
          }
        ],
        clientsClaim: true,
        skipWaiting: true
      }
    }),
  ],
  publicDir: "public",
  build: {
    assetsInlineLimit: 0,
  },
});
