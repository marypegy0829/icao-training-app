
import { createClient } from '@supabase/supabase-js';

// Credentials provided by user
const SUPABASE_URL = 'https://gffpwwrkojfbzmdeslck.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZnB3d3Jrb2pmYnptZGVzbGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDY2NzksImV4cCI6MjA4NDgyMjY3OX0.rldNOeAsx6d2q-xEAo_uN5ElY94ZBC0dM7uqj5JiEnI';

// Initialize with specific schema option
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: {
    schema: 'icao5_trainer' 
  }
});
