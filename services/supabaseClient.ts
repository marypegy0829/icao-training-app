
import { createClient } from '@supabase/supabase-js';

// User provided credentials
const HARDCODED_URL = 'https://gffpwwrkojfbzmdeslck.supabase.co';
const HARDCODED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZnB3d3Jrb2pmYnptZGVzbGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDY2NzksImV4cCI6MjA4NDgyMjY3OX0.rldNOeAsx6d2q-xEAo_uN5ElY94ZBC0dM7uqj5JiEnI';

// Use process.env which is polyfilled by Vite's define config
// Priority: 1. Environment Variable -> 2. Hardcoded fallback
const supabaseUrl = process.env.VITE_SUPABASE_URL || HARDCODED_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || HARDCODED_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase credentials might be missing or invalid. Attempting to use fallbacks.");
}

export const supabase = createClient(
  supabaseUrl, 
  supabaseKey, 
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
