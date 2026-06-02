import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { LineDefectsClient } from '@/components/train-operations/line-defects-client'

export const dynamic = 'force-dynamic'

export default async function LineDefectPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    let empId = ''
    let empName = ''

    const { data: profile } = await supabase
        .from('users')
        .select('employee_id, full_name')
        .eq('id', user.id)
        .single()

    if (profile?.employee_id) {
        empId = profile.employee_id
        const { data: emp } = await supabase
            .from('employees')
            .select('name')
            .eq('employee_id', profile.employee_id)
            .single()
        empName = emp?.name || profile.full_name || ''
    } else {
        empName = profile?.full_name || ''
    }

    const { data } = await supabase
        .from('line_defects')
        .select('*')
        .order('reported_at', { ascending: false })
        .limit(50)

    return (
        <LineDefectsClient 
            initialDefects={data || []}
            empId={empId}
            empName={empName}
            userId={user.id}
        />
    )
}
