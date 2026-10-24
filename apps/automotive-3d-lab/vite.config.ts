import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/three/') || id.includes('\\three\\')) return 'three-engine'
          if (id.includes('@react-three')) return 'react-three'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react-runtime'
        }
      }
    }
  },
  test: { environment: 'node' }
})
