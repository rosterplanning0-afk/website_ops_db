'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function updateGeneralCounsellingRecord(
    recordId: string,
    sessionId: string,
    updates: {
        employee_id: string;
        counselling_date: string;
        time_from: string;
        time_to: string;
        place: string;
        areas_for_improvement: string;
    }
) {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    const isAdmin = profile?.role === 'admin'

    // Verify ownership to ensure they can only edit their own records
    const { data: record } = await supabaseAdmin
        .from('general_counselling_records')
        .select('created_by')
        .eq('id', recordId)
        .single()

    if (!isAdmin && (!record || record.created_by !== user.id)) {
        throw new Error('Unauthorized: You can only edit records you added.')
    }

    // Use admin client to bypass potential RLS update restrictions
    const { error } = await supabaseAdmin
        .from('general_counselling_records')
        .update(updates)
        .eq('id', recordId)

    if (error) throw new Error(error.message)
    return { success: true }
}
