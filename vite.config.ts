
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, process.cwd(), '');
    
    // SECURITY: API Key Configuration
    // We map VITE_GEMINI_API_KEY to process.env.API_KEY for the GenAI SDK
    const googleApiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.API_KEY || '';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Securely inject env vars at build time. 
        // We only explicitly define API_KEY to map it from VITE_ names.
        // VITE_* variables are automatically available on import.meta.env
        'process.env.API_KEY': JSON.stringify(googleApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(googleApiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
