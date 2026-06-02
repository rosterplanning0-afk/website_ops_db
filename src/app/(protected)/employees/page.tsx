import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { EmployeeListClient } from '@/components/employees/employee-list-client'

export const dynamic = 'force-dynamic'

export default async function EmployeeListPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
    let userRole = (profile?.role || 'employee') as string
    let userDept = 'all'

    if (profile?.employee_id) {
        const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
        if (empInfo) {
            userRole = (empInfo.role?.toLowerCase() || userRole)
            userDept = empInfo.department || 'all'
        }
    }

    const canEdit = userRole === 'admin' || userRole === 'roster_planners'
    const isAdmin = userRole === 'admin'

    // Fetch delegations for roster planners
    let userDelegations: any[] = []
    if (userRole === 'roster_planners') {
        const { data: delData } = await supabase
            .from('manager_assignment_rights')
            .select('department_scope, designation_scope')
            .eq('granted_to', user.id)
        userDelegations = delData || []
    }

    let query = supabase.from('employees').select('*').order('name', { ascending: true })

    // Apply department filter for non-admins
    if (userRole !== 'admin' && userDept !== 'all') {
        query = query.eq('department', userDept)
    }

    const { data: employees } = await query

    return (
        <EmployeeListClient
            initialEmployees={employees || []}
            userRoleState={userRole}
            userDept={userDept}
            isAdmin={isAdmin}
            canEdit={canEdit}
            userDelegations={userDelegations}
        />
    )
}
