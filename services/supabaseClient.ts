
import { createClient } from '@supabase/supabase-js';

// Access environment variables via process.env
// These are replaced by string literals at build time via vite.config.ts define
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Supabase credentials missing! Check your .env file.");
  console.error("Required: VITE_SUPABASE_URL, VITE_SUPABASE_KEY");
}

// Fallback to avoid crash if env vars are strictly missing, though connection will fail
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseKey || 'placeholder-key';

export const supabase = createClient(
  validUrl, 
  validKey, 
  {
    db: {
      schema: 'icao5_trainer' 
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
