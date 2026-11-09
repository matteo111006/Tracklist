import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { createApiMiddleware } from './server/api.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'APP_URL', 'GEMINI_API_KEY', 'GEMINI_MODEL']) if (!process.env[key] && env[key]) process.env[key] = env[key];
  const api = createApiMiddleware();
  return {
    plugins: [react(), tailwindcss(), {
      name: 'tracklist-api',
      configureServer(server) { server.middlewares.use(api); },
      configurePreviewServer(server) { server.middlewares.use(api); },
    }],
    resolve: { alias: { '@': path.resolve(process.cwd(), '.') } },
    server: { host: '127.0.0.1', port: 3000, strictPort: true },
    preview: { host: '127.0.0.1', port: 3000, strictPort: true },
  };
});
