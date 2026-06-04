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
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Check if caller is admin or roster planner
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
        const userRole = profile?.role

        if (userRole !== 'admin' && userRole !== 'roster_planners') {
            return { error: 'Only admins and roster planners can perform this action' }
        }

        if (userRole === 'roster_planners') {
            // Validate against manager_assignment_rights
            const { data: delegations } = await supabase
                .from('manager_assignment_rights')
                .select('department_scope, designation_scope')
                .eq('granted_to', user.id)

            if (!delegations || delegations.length === 0) {
                return { error: 'You do not have any assignment rights configured.' }
            }

            const isAllowed = delegations.some(d => {
                let desigs: string[] = []
                if (d.designation_scope) {
                    if (Array.isArray(d.designation_scope)) desigs = d.designation_scope
                    else if (typeof d.designation_scope === 'string') desigs = d.designation_scope.split(',').map((s: string) => s.trim()).filter(Boolean)
                }
                
                const deptAllowed = !d.department_scope || d.department_scope === input.department
                const desigAllowed = !d.designation_scope || desigs.length === 0 || desigs.includes(input.designation)
                
                return deptAllowed && desigAllowed
            })

            if (!isAllowed) {
                return { error: `You are not authorized to create an employee for Designation: ${input.designation} in Department: ${input.department}.` }
            }
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) {
            return { error: 'Supabase Service Role Key is missing in environment variables (.env.local)' }
        }

        // Use service role to create user bypassing RLS
        const adminSupa = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey
        )

        // 0. Check if employee ID already exists
        const { data: existingEmp } = await adminSupa
            .from('employees')
            .select('employee_id')
            .eq('employee_id', input.employeeId)
            .maybeSingle()
            
        if (existingEmp) {
            return { error: `An employee with ID ${input.employeeId} already exists.` }
        }

        // 1. Create Auth User
        const { data: authData, error: authError } = await adminSupa.auth.admin.createUser({
            email: input.email,
            password: input.password || 'DBrrts@123', // Default password if not provided
            email_confirm: true,
        })

        if (authError) {
            return { error: `Failed to create Auth User: ${authError.message}` }
        }

        const authUserId = authData.user.id

        // 2. Create Employee record (Insert instead of upsert for safety)
        const { error: employeeError } = await adminSupa.from('employees').insert({
            employee_id: input.employeeId,
            name: input.name,
            department: input.department,
            designation: input.designation,
            role: input.role,
            gender: input.gender,
            status: input.status,
            date_joined: input.dateJoined || null,
            manager_id: input.managerId || null,
        })

        if (employeeError) {
            // Rollback Auth User creation
            await adminSupa.auth.admin.deleteUser(authUserId)
            return { error: `Failed to create/update Employee: ${employeeError.message}` }
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
            return { error: `Failed to link User record: ${userError.message}` }
        }

        return { success: true }
    } catch (err: any) {
        return { error: err.message || 'An unexpected error occurred.' }
    }
}
