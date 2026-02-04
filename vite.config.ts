import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@ecs': resolve(__dirname, 'src/ecs'),
      '@rendering': resolve(__dirname, 'src/rendering'),
      '@physics': resolve(__dirname, 'src/physics'),
      '@ai': resolve(__dirname, 'src/ai'),
      '@weapons': resolve(__dirname, 'src/weapons'),
      '@combat': resolve(__dirname, 'src/combat'),
      '@networking': resolve(__dirname, 'src/networking'),
      '@procedural': resolve(__dirname, 'src/procedural'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@meta': resolve(__dirname, 'src/meta'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@entities': resolve(__dirname, 'src/entities'),
      '@data': resolve(__dirname, 'data'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          bitecs: ['bitecs'],
          nakama: ['@heroiclabs/nakama-js'],
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
});
