import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // SmartCut.Pro API (обход CORS в dev)
      '/smartcut-api': {
        target: 'https://smartcut.pro',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/smartcut-api/, '/api/v1'),
      },
    },
  },
})
