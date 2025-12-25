import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor_react: ['react', 'react-dom', 'react-router'],
              vendor_antd: ['antd', '@ant-design/icons'],
              vendor_refine: ['@refinedev/core', '@refinedev/antd', '@refinedev/supabase'],
              vendor_utils: ['browser-image-compression', '@supabase/supabase-js']
            }
          }
        }
      }
    };
});
