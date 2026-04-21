import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  outDir: 'dist',
  tsconfig: 'tsconfig.json',
  cjsInterop: true,
  shims: true,
  banner: {
    js: '// simple-authz-v2 — lightweight authorization engine (Apache 2.0)',
  },
  esbuildOptions(options) {
    options.conditions = ['import', 'require']
  },
})
