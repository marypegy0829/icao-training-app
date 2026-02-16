
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, '.', '');
    
    // SECURITY: API Key Configuration
    // Logic: 
    // 1. Prioritize VITE_GEMINI_API_KEY (standard .env naming)
    // 2. Fallback to other variants
    // 3. Default to empty string (Do NOT hardcode secrets here to ensure hidden design)
    const googleApiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || env.API_KEY || '';
    
    // Supabase Configuration
    // Rely strictly on environment variables for security
    const supabaseUrl = env.VITE_SUPABASE_URL || '';
    const supabaseKey = env.VITE_SUPABASE_KEY || '';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Securely inject env vars at build time. 
        'process.env.API_KEY': JSON.stringify(googleApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(googleApiKey),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'process.env.VITE_SUPABASE_KEY': JSON.stringify(supabaseKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
