import { createClient } from '@/utils/supabase/server'
import { ForcePasswordRedirect } from '@/components/force-password-redirect'
import { redirect } from 'next/navigation'
import { ProtectedShell } from '@/components/protected-shell'
import type { UserRole } from '@/lib/rbac'

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        redirect('/')
    }

    // Fetch user profile from custom users table
    const { data: profile } = await supabase
        .from('users')
        .select('full_name, role, employee_id, force_password_change')
        .eq('id', user.id)
        .single()

    // Fetch employee details directly from employees table using employee_id
    const { data: empData } = profile?.employee_id
        ? await supabase.from('employees').select('name, designation, role, department').eq('employee_id', profile.employee_id).single()
        : { data: null }

    const userRole = (empData?.role?.toLowerCase() || profile?.role?.toLowerCase() || 'employee') as UserRole
    const userDesignation = empData?.designation || profile?.role || 'User'
    const userDepartment = empData?.department || ''
    const userName = empData?.name || profile?.full_name || user.email || 'User'
    const userEmail = user.email || ''

    return (
        <>
            <ForcePasswordRedirect force={!!profile?.force_password_change} />
            <ProtectedShell
                userRole={userRole}
                userDepartment={userDepartment}
                userName={userName}
                userEmail={userEmail}
                userDesignation={userDesignation}
            >
                {children}
            </ProtectedShell>
        </>
    )
}
