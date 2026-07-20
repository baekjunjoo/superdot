import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',            // tw-app 하위 경로 배포 대비 상대 경로
  build: { outDir: 'dist' }
});
