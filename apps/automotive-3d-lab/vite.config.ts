import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { gzipSync } from 'node:zlib'

/**
 * Three.js core is a single large upstream ESM module. Its current production
 * output is about 746 kB minified / 192 kB gzip. Use explicit bounded budgets
 * instead of masking growth with an arbitrary Vite warning suppression.
 */
function enforceThreeBudget(): Plugin {
  return {
    name: 'enforce-three-core-budget',
    apply: 'build',
    generateBundle(_options, bundle) {
      let foundThreeCore = false
      for (const [name, output] of Object.entries(bundle)) {
        if (output.type !== 'chunk' || output.name !== 'three-core') continue
        foundThreeCore = true
        const raw = Buffer.byteLength(output.code, 'utf8')
        const gzip = gzipSync(output.code).byteLength
        if (raw > 800_000 || gzip > 210_000) {
          this.error(`Three.js core exceeds budget: ${raw} bytes raw / ${gzip} bytes gzip (limits 800000 / 210000)`)
        }
        this.info(`Three.js core within budget: ${raw} bytes raw / ${gzip} bytes gzip`)
      }
      if (!foundThreeCore) this.error('Three.js core chunk not found; review bundle naming and budget enforcement')
    }
  }
}

export default defineConfig({
  plugins: [react(), enforceThreeBudget()],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/three/') || id.includes('\\three\\')) return 'three-core'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react-runtime'
        }
      }
    }
  },
  test: { environment: 'node' }
})
