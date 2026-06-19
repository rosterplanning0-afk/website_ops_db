import { createClient } from '@/utils/supabase/server'
import { ForcePasswordRedirect } from '@/components/force-password-redirect'
import { redirect } from 'next/navigation'
import { ProtectedShell } from '@/components/protected-shell'
import { InstructionBlocker } from '@/components/instruction-blocker'
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

    // Fetch employee details and route overrides concurrently
    const [empDataRes, routeOverridesRes] = await Promise.all([
        profile?.employee_id 
            ? supabase.from('employees').select('name, designation, role, department, is_line_inspector').eq('employee_id', profile.employee_id).single()
            : Promise.resolve({ data: null }),
        // We can fetch overrides for both possible roles, or wait, we need the final userRole.
        // But role is usually profile.role unless employee has a different role.
        // Let's fetch both if they differ, or just fetch for profile.role and employee.role
        // Actually, to fully optimize without risking missing data, we can query for ALL overrides for this user's possible roles in one go:
        supabase
            .from('access_rights_overrides')
            .select('item_key, is_visible, role')
            // Using in filter for both possible roles
            .in('role', [profile?.role || 'employee', 'employee'])
    ])

    const empData = empDataRes.data
    const allOverrides = routeOverridesRes.data

    const userRole = (empData?.role?.toLowerCase() || profile?.role?.toLowerCase() || 'employee') as UserRole
    const userDesignation = empData?.designation || profile?.role || 'User'
    const userDepartment = empData?.department || ''
    const userName = empData?.name || profile?.full_name || user.email || 'User'
    const userEmail = user.email || ''

    const accessOverrides: Record<string, boolean> = {}
    if (allOverrides) {
        // Filter overrides for the final userRole
        allOverrides.filter(row => row.role.toLowerCase() === userRole).forEach(row => {
            accessOverrides[row.item_key] = row.is_visible
        })
    }

    // Force overrides for Line Inspectors and Crew Controllers
    const isLineInspector = !!empData?.is_line_inspector
    const isCrewController = userDesignation === 'Crew Controller'
    
    if (isLineInspector) {
        accessOverrides['Reports'] = true
        accessOverrides['/reports/inspection-stats'] = true
        accessOverrides['/train-operations/new-inspection'] = true
    }

    if (isLineInspector || isCrewController) {
        accessOverrides['Counselling'] = true
        accessOverrides['/counselling/general'] = true
        accessOverrides['/counselling'] = false
    }

    // Hide Line Inspectors delegation from non-Train Ops managers/HODs
    if ((userRole === 'manager' || userRole === 'hod') && userDepartment.toLowerCase() !== 'train operations') {
        accessOverrides['/account/line-inspectors'] = false
    }

    // InstructionBlocker handles checking pending instructions and redirecting internally
    const excludeRoles = ['admin', 'manager', 'hod', 'cxo']
    const shouldShowInstructionBlocker = !profile?.force_password_change && !excludeRoles.includes(userRole)
    
    return (
        <>
            <ForcePasswordRedirect force={!!profile?.force_password_change} />
            {shouldShowInstructionBlocker && <InstructionBlocker userId={user.id} />}
            <ProtectedShell
                userRole={userRole}
                userDepartment={userDepartment}
                userName={userName}
                userEmail={userEmail}
                userDesignation={userDesignation}
                accessOverrides={accessOverrides}
            >
                {children}
            </ProtectedShell>
        </>
    )
}
