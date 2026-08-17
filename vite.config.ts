import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const deploymentEnvDir = fileURLToPath(
  new URL('../PERSONAL-harness-deployment/', import.meta.url),
)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, deploymentEnvDir, 'VITE_')

  return {
    envDir: deploymentEnvDir,
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/orchestrator': {
          target: env.VITE_ORCHESTRATOR_PROXY_TARGET || 'http://127.0.0.1:1421',
          changeOrigin: true,
        },
      },
    },
  }
})
