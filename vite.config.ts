import { defineConfig } from 'vitest/config'

// Library build and unit tests. The examples dev server has its own config in examples/.
export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    target: 'es2022',
    minify: false,
    sourcemap: true,
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
