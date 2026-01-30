import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/nodes': path.resolve(__dirname, './src/nodes'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/i18n': path.resolve(__dirname, './src/i18n'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
  base: './',
  server: {
    port: 5173,
    proxy: {
      // 代理 Google GenAI API 请求（必须放在 /api-proxy 之前，因为更具体）
      '/api-proxy-google': {
        target: 'https://api.openai-proxy.org',
        changeOrigin: true,
        rewrite: (path) => {
          // 将 /api-proxy-google/xxx 转换为 /google/xxx
          const rewritten = path.replace(/^\/api-proxy-google/, '/google');
          console.log('[api-proxy-google] Rewriting path:', path, '->', rewritten);
          return rewritten;
        },
        secure: false,
        timeout: 120000, // 2 分钟超时
        proxyTimeout: 120000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[api-proxy-google] proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            const targetUrl = `${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`;
            console.log('[api-proxy-google] Sending Request:', req.method, req.url, '->', targetUrl);
            // 确保 Content-Length 头被正确转发
            if (req.headers['content-length']) {
              console.log('[api-proxy-google] Content-Length:', req.headers['content-length']);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[api-proxy-google] Received Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // 代理方舟/Volces CDN zip 下载，解决浏览器 CORS（仅开发环境）
      '/api-proxy-ark-zip': {
        target: 'https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy-ark-zip/, ''),
        secure: false,
        timeout: 60000,
        proxyTimeout: 60000,
      },
      // 代理 API 请求以解决 CORS 问题
      '/api-proxy': {
        target: 'https://api.openai-proxy.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
        secure: false, // 忽略 SSL 证书验证
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request:', req.method, req.url, '-> target');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
});
