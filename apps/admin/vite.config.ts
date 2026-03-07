import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT}`,
        changeOrigin: true,
      },
    },
  },
})
