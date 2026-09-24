import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

// The compact runtime ships its ledger VM as WebAssembly (@midnight-ntwrk/onchain-runtime-v3).
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [wasm()],
  build: { target: 'esnext', outDir: '../dist', emptyOutDir: true },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/onchain-runtime-v3'],
    esbuildOptions: { target: 'esnext' },
  },
  server: { fs: { allow: ['..'] } },
});
