import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output goes to client/dist, which the Express server serves in prod.
// In dev, API calls are proxied to the backend. The port follows the server's
// own default but can be pointed anywhere — `API_PORT=3004 npm run client:dev`
// — for when :3000 is taken by something else.
const api = `http://localhost:${process.env.API_PORT || process.env.PORT || 3000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/sources': api,
      '/health': api,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
