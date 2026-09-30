import { InjectionToken } from '@angular/core';
import type { Database } from '@mise/db-types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export type Supabase = SupabaseClient<Database>;

/**
 * The app's one Supabase client. Only repositories inject it (component → store → repository).
 * Sign-in links are handled by the /auth/confirm route, so the client doesn't read sessions from the URL.
 */
export const SUPABASE = new InjectionToken<Supabase>('SUPABASE', {
  providedIn: 'root',
  factory: () => {
    if (!environment.supabaseUrl || !environment.supabaseKey)
      throw new Error(
        'Supabase is not configured: set src/environments/environment.ts',
      );
    return createClient<Database>(
      environment.supabaseUrl,
      environment.supabaseKey,
      {
        auth: { detectSessionInUrl: false },
      },
    );
  },
});
