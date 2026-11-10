import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// two pages, one engine: BAYHEM at / and BAYHEM 2 at /2/ (the single-file build is BAYHEM only)
const pages = { main: new URL('./index.html', import.meta.url).pathname, two: new URL('./2/index.html', import.meta.url).pathname };
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', rollupOptions: mode === 'single' ? {} : { input: pages }, chunkSizeWarningLimit: 4000, assetsInlineLimit: mode === 'single' ? 100000000 : 4096 },
  server: { host: true, port: 5173 },
}));
