import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { InstructionAckSheetClient } from '@/components/reports/instruction-ack-sheet-client'

export const dynamic = 'force-dynamic'

export default async function InstructionAckSheetPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
    let userRole = 'employee'
    let userDept = ''
    let employeeId = profile?.employee_id || ''

    if (profile?.employee_id) {
        const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
        userRole = (empInfo?.role || profile.role || '').toLowerCase()
        userDept = empInfo?.department || ''
    } else if (profile) {
        userRole = (profile.role || '').toLowerCase()
    }

    const userContext = { role: userRole, dept: userDept, employeeId }

    let allowedDesigs = new Set<string>()
    if (userRole !== 'admin' && userDept) {
        let query = supabase.from('employees').select('designation')
        if (userRole === 'manager') {
            query = query.or(`department.eq.${userDept},manager_id.eq.${employeeId}`)
        } else {
            query = query.eq('department', userDept)
        }
        const { data: dData } = await query
        dData?.forEach(d => { if (d.designation) allowedDesigs.add(d.designation) })
    }

    const { data } = await supabase
        .from('instructions')
        .select('id, title, created_at, instruction_designation_assignments(designation)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    let filtered = data || []
    if (userRole !== 'admin' && allowedDesigs.size > 0) {
        filtered = filtered.filter(inst => {
            return inst.instruction_designation_assignments?.some((a: any) => 
                a.designation === 'All Staff' || allowedDesigs.has(a.designation)
            )
        })
    }

    const initialInstructions = filtered.map(i => ({
        id: i.id,
        title: i.title,
        created_at: i.created_at
    }))

    return (
        <InstructionAckSheetClient 
            initialInstructions={initialInstructions}
            userContext={userContext}
        />
    )
}
