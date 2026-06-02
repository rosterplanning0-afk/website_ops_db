import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { GeneralCounsellingClient } from '@/components/counselling/general-counselling-client'

export const dynamic = 'force-dynamic'

export default async function GeneralCounsellingPage() {
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

    const { data: sessions } = await supabase
        .from('general_counselling_sessions')
        .select('id, topic, details, created_at')
        .order('created_at', { ascending: false })

    return (
        <GeneralCounsellingClient 
            initialEmployees={availableEmployees as any[]}
            initialSessions={sessions || []}
            userId={user.id}
        />
    )
}
