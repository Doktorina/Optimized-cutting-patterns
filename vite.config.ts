import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const cutOrigin = (env.CUT_API_ORIGIN || '').trim()

  return {
    plugins: [react()],
    server: {
      proxy: cutOrigin
        ? {
            '/cut-api': {
              target: cutOrigin,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/cut-api/, '/api/v1'),
            },
          }
        : undefined,
    },
  }
})
