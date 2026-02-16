
import { createClient } from '@supabase/supabase-js';

// Use import.meta.env which is the standard Vite way to access env vars
// Fallback to process.env for compatibility if needed
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Supabase credentials missing! Check your .env file.");
  console.error("Required: VITE_SUPABASE_URL, VITE_SUPABASE_KEY");
}

// Ensure we don't pass undefined/empty string to createClient to avoid "supabaseUrl is required" crash
// If missing, we pass a dummy URL to allow app to load (requests will fail gracefully instead of white screen)
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
