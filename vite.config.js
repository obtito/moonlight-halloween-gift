import { defineConfig } from 'vite';
export default defineConfig({
  base: '/moonlight-halloween-gift/',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } }
});
