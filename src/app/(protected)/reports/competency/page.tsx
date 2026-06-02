import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CompetencyClient } from '@/components/reports/competency-client'

export const dynamic = 'force-dynamic'

export default async function CompetencyReportPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
    let userRole = profile?.role || 'employee'
    let userDept = ''

    if (profile?.employee_id) {
        const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
        if (empInfo) {
            userRole = empInfo.role?.toLowerCase() || userRole
            userDept = empInfo.department || ''
        }
    }

    let empQuery = supabase.from('employees').select('employee_id, name').order('name')
    if (userRole !== 'admin' && userDept) {
        empQuery = empQuery.eq('department', userDept)
    }
    const { data: emps } = await empQuery
    const allEmployees = emps || []

    let allowedEmpIds: string[] | null = null
    if (userRole !== 'admin' && userDept) {
        allowedEmpIds = allEmployees.map(e => e.employee_id)
    }

    return (
        <CompetencyClient 
            userRole={userRole}
            userDept={userDept}
            allEmployees={allEmployees}
            allowedEmpIds={allowedEmpIds}
        />
    )
}
