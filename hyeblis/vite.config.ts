import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development the Vite server proxies API calls to the Flask backend
    // so you don't have to set VITE_API_BASE_URL or deal with CORS.
    proxy: {
      '/latest': 'http://localhost:5000',
      '/history': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
    },
  },
})
