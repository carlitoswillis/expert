import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output goes to client/dist, which the Express server serves in prod.
// In dev, API calls are proxied to the backend on :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/sources': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
