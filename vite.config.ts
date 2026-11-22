import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0 }, // no data: URIs, keeps the strict CSP
  test: { environment: 'node' },
} as never);
