import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The author panel page (docs/system/cartridge.md#author-preview). `/__author/*` goes to
// `bin/loka dev --watch`'s API (kernel/ts/play/live.ts); the Book preview is framed from its own
// port, so this page carries the isolation headers the framed Book's worker needs.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The Book's port, the one name every tool reads (bin/author.sh, preview-server.cjs).
  define: { 'import.meta.env.VITE_LOKA_PREVIEW_PORT': JSON.stringify(process.env.LOKA_PREVIEW_PORT || '19006') },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    port: Number(process.env.LOKA_PANEL_PORT || 19009),
    strictPort: true,
    headers: {
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    },
    proxy: {
      '/__author': {
        target: `http://localhost:${process.env.LOKA_AUTHOR_PORT || 19008}`,
        rewrite: (url) => url.slice('/__author'.length),
      },
    },
  },
});
