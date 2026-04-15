import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/lib/rbac'

export default async function RosterAnalyticsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        redirect('/')
    }

    // Fetch user profile
    const { data: profile } = await supabase
        .from('users')
        .select('full_name, role, employee_id')
        .eq('id', user.id)
        .single()

    const { data: empData } = profile?.employee_id
        ? await supabase.from('employees').select('name, designation, role, department, manager_id').eq('employee_id', profile.employee_id).single()
        : { data: null }

    const userRole = (empData?.role?.toLowerCase() || profile?.role?.toLowerCase() || 'employee') as UserRole

    // Block employees
    if (userRole === 'employee') {
        redirect('/dashboard')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Roster Analytics</h1>
                    <p className="text-sm text-slate-500 mt-1">Workforce monitoring &amp; compliance dashboard</p>
                </div>
            </div>
            {children}
        </div>
    )
}
