'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

interface CreateCredentialsInput {
    employeeId: string
    name: string
    email: string
    password?: string
    role: string
    department: string
    designation: string
    gender: string
    status: string
    dateJoined: string
    managerId?: string
}

export async function createCredentials(input: CreateCredentialsInput) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if caller is admin
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
        throw new Error('Only admins can perform this action')
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        throw new Error('Supabase Service Role Key is missing in environment variables (.env.local)')
    }

    // Use service role to create user bypassing RLS
    const adminSupa = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey
    )

    // 1. Create Auth User
    const { data: authData, error: authError } = await adminSupa.auth.admin.createUser({
        email: input.email,
        password: input.password || 'DBrrts@123', // Default password if not provided
        email_confirm: true,
    })

    if (authError) {
        throw new Error(`Failed to create Auth User: ${authError.message}`)
    }

    const authUserId = authData.user.id

    // 2. Upsert Employee record
    const { error: employeeError } = await adminSupa.from('employees').upsert({
        employee_id: input.employeeId,
        name: input.name,
        department: input.department,
        designation: input.designation,
        role: input.role,
        gender: input.gender,
        status: input.status,
        date_joined: input.dateJoined || null,
        manager_id: input.managerId || null,
    }, { onConflict: 'employee_id' })

    if (employeeError) {
        // Rollback Auth User creation
        await adminSupa.auth.admin.deleteUser(authUserId)
        throw new Error(`Failed to create/update Employee: ${employeeError.message}`)
    }

    // 3. Upsert User record
    const { error: userError } = await adminSupa.from('users').upsert({
        id: authUserId,
        employee_id: input.employeeId,
        email: input.email,
        full_name: input.name,
        role: input.role,
        force_password_change: true,
    }, { onConflict: 'id' })

    if (userError) {
        // Wait, if users upsert fails but we already created an employee...
        // We shouldn't delete employee as it might have existed. 
        // We should delete the auth user though.
        await adminSupa.auth.admin.deleteUser(authUserId)
        throw new Error(`Failed to link User record: ${userError.message}`)
    }

    return { success: true }
}
