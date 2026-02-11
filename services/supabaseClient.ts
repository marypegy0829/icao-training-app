
import { createClient } from '@supabase/supabase-js';

// Default credentials from project configuration (.env)
// Used as fallback if environment variables are not loaded correctly in the current environment
const DEFAULT_URL = "https://gffpwwrkojfbzmdeslck.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZnB3d3Jrb2pmYnptZGVzbGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDY2NzksImV4cCI6MjA4NDgyMjY3OX0.rldNOeAsx6d2q-xEAo_uN5ElY94ZBC0dM7uqj5JiEnI";

let supabaseUrl = DEFAULT_URL;
let supabaseKey = DEFAULT_KEY;

try {
  // Attempt to load from Vite environment variables
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
    // @ts-ignore
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  }
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_SUPABASE_KEY) {
    // @ts-ignore
    supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
  }
} catch (e) {
  console.warn("Failed to read env vars from import.meta, using defaults.");
}

// Fallback check for process.env (e.g. if running in a Node-like environment)
if (supabaseUrl === DEFAULT_URL && typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_SUPABASE_URL) supabaseUrl = process.env.VITE_SUPABASE_URL;
    if (process.env.VITE_SUPABASE_KEY) supabaseKey = process.env.VITE_SUPABASE_KEY;
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing! App will likely crash.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'icao5_trainer' 
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
