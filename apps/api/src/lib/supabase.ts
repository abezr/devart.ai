import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../index';

/**
 * Creates a new Supabase client instance for each request.
 * This is the recommended pattern for serverless environments like Cloudflare Workers.
 * 
 * @param env - The environment context containing Supabase credentials
 * @returns A configured Supabase client with service role privileges
 */
export const createSupabaseClient = (env: Env): SupabaseClient => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
};