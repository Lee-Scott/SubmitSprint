import { describe, expect, it } from 'vitest';

import { getSupabaseConfig } from '../lib/supabase';

describe('Supabase runtime config', () => {
  it('reports missing Vite env vars without throwing', () => {
    expect(getSupabaseConfig({})).toEqual({
      url: '',
      anonKey: '',
      isConfigured: false,
      missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    });
  });

  it('accepts configured public Supabase env vars', () => {
    expect(
      getSupabaseConfig({
        VITE_SUPABASE_URL: ' https://project.supabase.co ',
        VITE_SUPABASE_ANON_KEY: ' public-anon-key ',
      }),
    ).toEqual({
      url: 'https://project.supabase.co',
      anonKey: 'public-anon-key',
      isConfigured: true,
      missing: [],
    });
  });
});
