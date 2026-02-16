
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
    const googleApiKey = env.GEMINI_API_KEY || env.API_KEY || 'AIzaSyAL93ejSujySzpvmU5kyQdlmoZQnVRJ6Zg';
    
    // Supabase Configuration
    // Priority: 1. Env Var -> 2. Hardcoded User Credentials
    const supabaseUrl = env.VITE_SUPABASE_URL || 'https://gffpwwrkojfbzmdeslck.supabase.co';
    const supabaseKey = env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZnB3d3Jrb2pmYnptZGVzbGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDY2NzksImV4cCI6MjA4NDgyMjY3OX0.rldNOeAsx6d2q-xEAo_uN5ElY94ZBC0dM7uqj5JiEnI';

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
