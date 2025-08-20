import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: './web',
  server: {
    port: 5174,
    host: true,
    strictPort: true
  },
  build: {
    outDir: '../dist',
    sourcemap: true
  },
  base: command === 'build' ? '/veetr/' : '/',
  define: {
    global: 'globalThis',
  }
}))