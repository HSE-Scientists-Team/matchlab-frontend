import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: '/admin/',
    plugins: [react()],
    server: {
      proxy: {
        '/docs': {
          target:
            env.MATCHLAB_DOCS_PROXY_TARGET ||
            env.MATCHLAB_API_PROXY_TARGET ||
            'http://localhost:8084',
          changeOrigin: true,
        },
        '/api': {
          target: env.MATCHLAB_API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  }
})
