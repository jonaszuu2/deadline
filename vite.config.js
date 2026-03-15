import { defineConfig } from 'vite';
export default defineConfig({
  root: '.',
  build: { outDir: 'dist' },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
  },
});
