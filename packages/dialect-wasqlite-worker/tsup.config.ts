import { copyFile } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    worker: 'src/worker/index.ts',
  },
  clean: true,
  format: ['cjs', 'esm'],
  shims: true,
  dts: true,
  external: ['kysely'],
  treeshake: true,
  plugins: [
    {
      name: 'classic worker',
      renderChunk(code) {
        if (this.format === 'cjs') {
          return { code: code.replaceAll('import.meta.url', 'self.location.href') }
        }
      },
    },
    {
      name: 'copy',
      buildEnd(this) {
        if (this.format === 'esm') {
          Promise.all([
            copyFile(
              './node_modules/@subframe7536/sqlite-wasm/dist/wa-sqlite.wasm',
              './dist/wa-sqlite.wasm',
            ),
            copyFile(
              './node_modules/@subframe7536/sqlite-wasm/dist/wa-sqlite-async.wasm',
              './dist/wa-sqlite-async.wasm',
            ),
          ])
        }
      },
    },
  ],
})
