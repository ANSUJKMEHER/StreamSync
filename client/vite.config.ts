import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@monaco-editor')) return 'monaco';
            if (id.includes('yjs') || id.includes('y-protocols') || id.includes('y-monaco')) return 'yjs';
            if (id.includes('konva') || id.includes('react-konva')) return 'konva';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('zustand')) return 'react-vendor';
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
