import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CounsellingClient } from '@/components/counselling/counselling-client'

export const dynamic = 'force-dynamic'

export default async function CounsellingPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
    let userRole = profile?.role || 'employee'
    let userDept = 'all'

    if (profile?.employee_id) {
        const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
        if (empInfo) {
            userRole = empInfo.role?.toLowerCase() || userRole
            userDept = empInfo.department || 'all'
        }
    }

    let empQuery = supabase.from('employees').select('employee_id, name, designation, department, status, manager_id')
    if (userRole !== 'admin' && userDept !== 'all') {
        const userId = profile?.employee_id || ''
        empQuery = empQuery.or(`department.eq."${userDept}",manager_id.eq."${userId}"`)
    }
    const { data: emps } = await empQuery.order('name')
    const availableEmployees = (emps || []).filter(e => !e.status || e.status === 'Active' || e.status.toLowerCase() === 'active')

    let recordsQuery = supabase.from('employee_counselling').select(`
        id, employee_id, counselling_date, reason, remarks, counselled_by, category, score,
        users:counselled_by (full_name)
    `).order('counselling_date', { ascending: false }).limit(100)
    
    const { data: history } = await recordsQuery
    
    let visibleRecords: any[] = []
    if (history) {
        const empMap = new Map((emps || []).map(e => [e.employee_id, e.name]))
        
        const enriched = history.map(r => ({
            id: r.id,
            employee_id: r.employee_id,
            counselling_date: r.counselling_date,
            reason: r.reason,
            remarks: r.remarks,
            category: r.category || 'Good',
            score: r.score || (r.category === 'Bad' ? -1 : 1),
            emp_name: empMap.get(r.employee_id) || 'Unknown (Out of Dept)',
            counselled_by_name: (r.users as any)?.full_name || 'Admin',
            counselled_by: r.counselled_by
        }))
        
        visibleRecords = userRole === 'admin' 
            ? enriched 
            : enriched.filter(r => empMap.has(r.employee_id))
    }

    return (
        <CounsellingClient 
            initialEmployees={availableEmployees as any[]}
            initialRecords={visibleRecords as any[]}
            userId={user.id}
            userRole={userRole}
        />
    )
}
