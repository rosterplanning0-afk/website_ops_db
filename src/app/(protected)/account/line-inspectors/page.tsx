import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { LineInspectorDelegationClient } from './client'

export const dynamic = 'force-dynamic'

export default async function LineInspectorDelegationPage() {
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

    // Check permissions: Only 'admin' or (manager/hod of 'Train Operations') can access
    const isTrainOpsAdmin = (userRole === 'manager' || userRole === 'hod') && userDept.toLowerCase() === 'train operations'
    const isAdmin = userRole === 'admin'

    if (!isAdmin && !isTrainOpsAdmin) {
        redirect('/dashboard')
    }

    return <LineInspectorDelegationClient />
}
