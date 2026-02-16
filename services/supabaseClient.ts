
import { createClient } from '@supabase/supabase-js';

// Use process.env which is polyfilled by Vite's define config
// Credentials must be provided via environment variables (.env)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase credentials might be missing or invalid. Please check your environment variables.");
}

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseKey || '', 
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
