'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function resetEmployeePassword(employeeId: string, newPassword: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if caller is admin
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
        throw new Error('Only admins can perform this action')
    }

    // Find user by employee_id from users table
    const { data: targetUser } = await supabase.from('users').select('id').eq('employee_id', employeeId).single()
    if (!targetUser) {
        throw new Error('User account not found for this employee')
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        throw new Error('Supabase Service Role Key is missing in environment variables (.env.local)')
    }

    // Use service role to update password
    const adminSupa = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey
    )

    const { error } = await adminSupa.auth.admin.updateUserById(targetUser.id, {
        password: newPassword,
    })

    if (error) {
        throw new Error(error.message)
    }

    // Set force_password_change flag
    const { error: flagError } = await adminSupa.from('users').update({
        force_password_change: true
    }).eq('id', targetUser.id)

    if (flagError) {
        throw new Error('Password reset successfully, but failed to enforce password change on next login.')
    }

    return { success: true }
}
