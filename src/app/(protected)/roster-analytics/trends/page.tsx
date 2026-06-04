import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TrendsClient } from '@/components/roster-analytics/trends-client'
import type { HistoricalMetricsRow, DailyRosterRow } from '@/lib/roster-utils'
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

export default async function HistoricalTrendsPage({ searchParams }: { searchParams: Promise<{ from?: string, to?: string, dept?: string, desig?: string, leaveType?: string }> }) {
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

    const resolvedParams = await searchParams;
    const fromDate = resolvedParams.from || getDefaultFrom()
    const toDate = resolvedParams.to || formatDate(new Date())
    const deptParam = resolvedParams.dept || ''
    const desigParam = resolvedParams.desig || ''
    const leaveTypeParam = resolvedParams.leaveType || ''

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

    const leaveTypeArray = leaveTypeParam ? leaveTypeParam.split(',') : []

    // Leave report query
    let leaveQuery = supabase
        .from('v_daily_roster_summary')
        .select('date, emp_id, name, department, designation, duty_category')
        .gte('date', fromDate)
        .lte('date', toDate)

    if (leaveTypeArray.length > 0) {
        leaveQuery = leaveQuery.in('duty_category', leaveTypeArray)
    } else {
        leaveQuery = leaveQuery.in('duty_category', [
            'Casual Leave', 'Earned Leave', 'Sick Leave', 
            'Public Holiday', 'Optional Holiday', 'Compensatory OFF', 
            'Absent'
        ])
    }

    // Apply RBAC or URL filters
    if ((userRole === 'manager' || userRole === 'hod') && userDept) {
        leaveQuery = leaveQuery.eq('department', userDept)
    } else if (deptParam) {
        leaveQuery = leaveQuery.eq('department', deptParam)
    }

    const desigArray = desigParam ? desigParam.split(',') : []
    if (desigArray.length > 0) {
        leaveQuery = leaveQuery.in('designation', desigArray)
    }

    // Fetch master list of departments & designations for filters
    const [{ data: rows }, { data: leaveRows }, { data: empMeta }] = await Promise.all([
        query,
        leaveQuery,
        supabase.from('employees').select('department, designation')
    ])

    const departments = Array.from(new Set(empMeta?.map(e => e.department).filter(Boolean))) as string[]
    const designations = Array.from(new Set(empMeta?.map(e => e.designation).filter(Boolean))) as string[]

    return (
        <TrendsClient 
            initialData={(rows as HistoricalMetricsRow[]) || []} 
            initialLeaveData={(leaveRows as Partial<DailyRosterRow>[]) || []}
            initialFromDate={fromDate} 
            initialToDate={toDate}
            initialDept={deptParam}
            initialDesig={desigParam}
            initialLeaveType={leaveTypeParam}
            departments={departments}
            designations={designations}
            userRole={userRole}
            userDept={userDept}
        />
    )
}
