import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { FatigueClient } from '@/components/roster-analytics/fatigue-client'
import type { DailyRosterRow } from '@/lib/roster-utils'
import { DEPT_CREW_MAPPING } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

function formatDate(d: Date): string { return d.toISOString().split('T')[0] }
function getMonthStart(): string {
    const d = new Date(); d.setDate(1); return formatDate(d)
}

export default async function FatigueManagementPage({ searchParams }: { searchParams: { from?: string, to?: string } }) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/signin')

    const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
    let userRole = (profile?.role || 'employee') as string
    let userDept = ''

    if (profile?.employee_id) {
        const { data: empInfo } = await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
        if (empInfo) {
            userRole = (empInfo.role?.toLowerCase() || userRole)
            userDept = empInfo.department || ''
        }
    }

    if (userRole !== 'admin' && userRole !== 'roster_planners') {
        redirect('/dashboard')
    }

    const fromDate = searchParams.from || getMonthStart()
    const toDate = searchParams.to || formatDate(new Date())

    let allRows: DailyRosterRow[] = []
    let offset = 0
    const limit = 1000
    let hasMore = true

    while (hasMore) {
        let query = supabase
            .from('v_daily_roster_summary')
            .select('*')
            .gte('date', fromDate)
            .lte('date', toDate)
            .order('date', { ascending: true })
            .range(offset, offset + limit - 1)

        const { data: rows, error } = await query

        if (error || !rows) {
            hasMore = false
        } else {
            allRows = [...allRows, ...(rows as DailyRosterRow[])]
            if (rows.length < limit) {
                hasMore = false
            } else {
                offset += limit
            }
        }
    }

    // Server side filtering based on department if roster_planner (or other roles if they were allowed)
    // Currently only admin and roster_planners can access this page
    if (userRole === 'roster_planners' && userDept) {
        const allowedCrews = DEPT_CREW_MAPPING[userDept] || []
        if (allowedCrews.length > 0) {
            allRows = allRows.filter(r => allowedCrews.includes(r.crew_type))
        }
    }

    return (
        <FatigueClient 
            initialData={allRows} 
            initialFromDate={fromDate} 
            initialToDate={toDate} 
        />
    )
}
