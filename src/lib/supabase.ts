import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type EnvSource = Record<string, string | boolean | undefined>;

export type SupabaseRuntimeConfig = {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  missing: Array<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'>;
};

let browserClient: SupabaseClient | undefined;

function readEnvValue(env: EnvSource, key: string) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function getSupabaseConfig(env: EnvSource = import.meta.env): SupabaseRuntimeConfig {
  const url = readEnvValue(env, 'VITE_SUPABASE_URL');
  const anonKey = readEnvValue(env, 'VITE_SUPABASE_ANON_KEY');
  const missing: SupabaseRuntimeConfig['missing'] = [];

  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY');

  return {
    url,
    anonKey,
    isConfigured: missing.length === 0,
    missing,
  };
}

export function getSupabaseClient() {
  const config = getSupabaseConfig();

  if (!config.isConfigured) {
    return undefined;
  }

  if (!browserClient) {
    browserClient = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  }

  return browserClient;
}
