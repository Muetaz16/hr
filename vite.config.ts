import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Stamps every build so the translation files can be cache-busted. i18next-http-backend
    // fetches /locales/<lng>/translation.json as an ordinary request, which the browser caches
    // happily — so newly added keys kept rendering as their English fallback until someone
    // thought to hard-refresh, and there is no way to tell that apart from a missing translation.
    __I18N_BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  server: {
    port: 5174,
    allowedHosts: true,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'recharts', 'sonner'],
          'vendor-utils': ['axios', 'xlsx', 'i18next'],
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
