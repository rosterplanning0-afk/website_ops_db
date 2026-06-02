import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TrendsClient } from '@/components/roster-analytics/trends-client'
import type { HistoricalMetricsRow } from '@/lib/roster-utils'
import { DEPT_CREW_MAPPING } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
}

function getDefaultFrom(): string {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return formatDate(d)
}

export default async function HistoricalTrendsPage({ searchParams }: { searchParams: { from?: string, to?: string } }) {
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

    const fromDate = searchParams.from || getDefaultFrom()
    const toDate = searchParams.to || formatDate(new Date())

    let query = supabase
        .from('v_historical_metrics')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: true })

    if ((userRole === 'manager' || userRole === 'hod') && userDept) {
        const allowedCrews = DEPT_CREW_MAPPING[userDept] || []
        if (allowedCrews.length > 0) {
            query = query.in('crew_type', allowedCrews)
        }
    }

    const { data: rows } = await query

    return (
        <TrendsClient 
            initialData={(rows as HistoricalMetricsRow[]) || []} 
            initialFromDate={fromDate} 
            initialToDate={toDate} 
        />
    )
}
