import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Using '.' instead of process.cwd() to avoid "Property 'cwd' does not exist on type 'Process'" error
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    server: {
      port: 3000
    },
    define: {
      // Vital for using process.env.API_KEY in the browser
      'process.env': {
        API_KEY: env.API_KEY,
        FIREBASE_API_KEY: env.FIREBASE_API_KEY,
        FIREBASE_AUTH_DOMAIN: env.FIREBASE_AUTH_DOMAIN,
        FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID,
        FIREBASE_STORAGE_BUCKET: env.FIREBASE_STORAGE_BUCKET,
        FIREBASE_MESSAGING_SENDER_ID: env.FIREBASE_MESSAGING_SENDER_ID,
        FIREBASE_APP_ID: env.FIREBASE_APP_ID
      }
    }
  };
});