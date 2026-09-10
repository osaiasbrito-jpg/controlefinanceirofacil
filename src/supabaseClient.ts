/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase Project Configuration Sanitizer
function sanitizeSupabaseUrl(raw?: string): string {
  const fallback = 'https://dpaylubvupjjokpukuxy.supabase.co';
  if (!raw || typeof raw !== 'string') return fallback;
  const match = raw.match(/https?:\/\/[^\s)\]"']+/);
  if (match && match[0]) return match[0];
  if (raw.trim().startsWith('http://') || raw.trim().startsWith('https://')) return raw.trim();
  return fallback;
}

function sanitizeSupabaseKey(raw?: string): string {
  const fallback = 'sb_publishable_uDVtjc0J1dGBgS510tpphg_oSrmPUTu';
  if (!raw || typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().replace(/^["']|["']$/g, '');
  return cleaned || fallback;
}

const rawUrl = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined;
const rawKey = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined;

const supabaseUrl: string = sanitizeSupabaseUrl(rawUrl);
const supabaseAnonKey: string = sanitizeSupabaseKey(rawKey);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
