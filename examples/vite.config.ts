import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Examples import 'force-gpu' like real users do, but resolve it to the source for live reload.
export default defineConfig({
  resolve: {
    alias: { 'force-gpu': fileURLToPath(new URL('../src/index.ts', import.meta.url)) },
  },
  server: {
    fs: { allow: ['..'] },
  },
})
