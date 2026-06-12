import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: './server',
  server: {
    // Honor a port assigned via PORT (e.g. the preview harness's autoPort);
    // otherwise fall back to Vite's default 5173.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
})
