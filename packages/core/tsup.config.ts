import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ['bin/tracelyx.ts'],
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: true,
  },
]);
