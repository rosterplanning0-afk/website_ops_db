import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { NewInspectionClient } from '@/components/train-operations/new-inspection-client'

export const dynamic = 'force-dynamic'

export default async function NewTOInspectionForm() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    const { data: profile } = await supabase.from('users').select('role, employee_id, full_name').eq('id', user.id).single()
    let userRole = profile?.role || 'employee'
    let isLineInspector = false
    const inspectorName = profile?.full_name || user.email || ''

    if (profile?.employee_id) {
        const { data: emp } = await supabase.from('employees').select('role, is_line_inspector').eq('employee_id', profile.employee_id).single()
        if (emp) {
            userRole = emp.role || userRole
            isLineInspector = !!emp.is_line_inspector
        }
    }

    const allowedRoles = ['admin', 'hod', 'manager']
    const isAuthorized = allowedRoles.includes(userRole.toLowerCase()) || isLineInspector

    // Fetch operators for the dropdown
    const { data: operators } = await supabase
        .from('employees')
        .select('employee_id, name, designation')
        .ilike('designation', '%Train Operator%')
        .order('name')

    return (
        <NewInspectionClient 
            isAuthorized={isAuthorized}
            operators={operators || []}
            inspectorId={user.id}
            inspectorName={inspectorName}
            inspectorRole={userRole}
        />
    )
}
