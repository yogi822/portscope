import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Client runs on 5173. All /api requests are proxied to the Express server on
// 3001, so the browser only ever talks to the Vite origin (no CORS needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
