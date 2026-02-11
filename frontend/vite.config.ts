import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['story-sign.jpg'],
      manifest: {
        name: 'StorySign',
        short_name: 'StorySign',
        description: 'AI-Powered Accessible Learning & Therapy',
        theme_color: '#050505',
        background_color: '#050505',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'story-sign.jpg',
            sizes: '512x512', // Assuming it's large enough, or use 'any'
            type: 'image/jpeg',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/history': {
        target: 'http://0.0.0.0:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://0.0.0.0:8000',
        ws: true,
        changeOrigin: true
      },
      '/analyze_session': {
        target: 'http://0.0.0.0:8000',
        changeOrigin: true
      },
      '/session': {
        target: 'http://0.0.0.0:8000',
        changeOrigin: true
      },
      '/plan': {
        target: 'http://0.0.0.0:8000',
        changeOrigin: true
      },
      '/tools': {
        target: 'http://0.0.0.0:8000',
        changeOrigin: true
      }
    }
  }
})
