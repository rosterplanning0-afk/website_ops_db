import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase admin client using the service_role key.
 * This bypasses Row Level Security (RLS) and should ONLY be used
 * in trusted server-side API routes — never expose this to the client.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Get it from: Supabase Dashboard > Settings > API > service_role
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceRoleKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL environment variable.')
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
