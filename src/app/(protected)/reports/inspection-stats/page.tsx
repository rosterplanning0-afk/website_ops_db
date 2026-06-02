import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { InspectionStatsClient } from '@/components/reports/inspection-stats-client'

export const dynamic = 'force-dynamic'

export default async function InspectionStatsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
    let userRole = (profile?.role || 'employee') as string
    let userDept = ''
    let isLineInspector = false

    if (profile?.employee_id) {
        const { data: empInfo } = await supabase.from('employees').select('role, department, is_line_inspector').eq('employee_id', profile.employee_id).single()
        if (empInfo) {
            userRole = (empInfo.role?.toLowerCase() || userRole)
            userDept = empInfo.department || ''
            isLineInspector = !!empInfo.is_line_inspector
        }
    }

    let empQuery = supabase.from('employees').select('employee_id, name, designation, department')
    if (userRole !== 'admin' && userDept && userDept !== 'all') {
        empQuery = empQuery.eq('department', userDept)
    }
    const { data: empList } = await empQuery
    const filteredEmpIds = (empList || []).map(e => e.employee_id)

    let inspQuery = supabase.from('footplate_inspections').select('id, employee_id, inspection_date, part_a_total, part_b_total, part_c_total, part_d_total, overall_total, inspected_by_name, inspected_by_role').order('inspection_date', { ascending: false })
    if (userRole !== 'admin' && userDept && userDept !== 'all') {
        inspQuery = inspQuery.in('employee_id', filteredEmpIds)
    }
    const { data: inspList } = await inspQuery

    return (
        <InspectionStatsClient 
            initialInspections={(inspList || []) as any[]} 
            initialEmployees={(empList || []) as any[]} 
            userRole={userRole}
            userDept={userDept}
            isLineInspector={isLineInspector}
        />
    )
}
