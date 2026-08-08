import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    build: {
      target: ['es2015', 'chrome64', 'safari12'],
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild' as const,
    },
    server: {
      host: "0.0.0.0",
      hmr: {
        clientPort: 443,
        protocol: "wss"
      },
      watch: {
        usePolling: true
      },
    },
  };
});
