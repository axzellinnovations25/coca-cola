import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient<any, 'public', any> | null = null;

export function getSupabaseClient() {
  if (client) {
    return client;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  client = createClient<any>(supabaseUrl, supabaseAnonKey);
  return client;
}
