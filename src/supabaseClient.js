import { createClient } from '@supabase/supabase-js';

// Supabase Project Configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dpaylubvupjjokpukuxy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_uDVtjc0J1dGBgS510tpphg_oSrmPUTu';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
