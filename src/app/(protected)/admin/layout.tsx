import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/lib/rbac'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/')
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role, employee_id')
        .eq('id', user.id)
        .single()

    const { data: empData } = profile?.employee_id
        ? await supabase.from('employees').select('role').eq('employee_id', profile.employee_id).single()
        : { data: null }

    const userRole = (empData?.role?.toLowerCase() || profile?.role?.toLowerCase() || 'employee') as UserRole

    if (userRole !== 'admin') {
        redirect('/dashboard')
    }

    return <>{children}</>
}
