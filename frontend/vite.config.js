// frontend/vite.config.js
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',       // Bind to all interfaces inside container
    port: 5173,
    proxy: {
      '/api': {
        // Use Docker Compose service name, not localhost
        target: 'http://backend:3001',
        changeOrigin: true,
      }
    }
  }
});
