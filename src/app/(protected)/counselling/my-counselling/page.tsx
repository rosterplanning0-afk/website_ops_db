import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { MyCounsellingClient } from '@/components/counselling/my-counselling-client'

export const dynamic = 'force-dynamic'

export default async function MyCounsellingPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/')
    }

    const { data: profile } = await supabase
        .from('users')
        .select('employee_id, role, full_name')
        .eq('id', user.id)
        .single()

    if (!profile || !profile.employee_id) {
        return (
            <div className="p-8 text-center text-red-600">
                <p>Employee record not found or not mapped to your user account.</p>
            </div>
        )
    }

    // Fetch all counselling records for the logged-in user
    const { data: counsellingData, error } = await supabase
        .from('employee_counselling')
        .select(`
            id,
            counselling_date,
            category,
            reason,
            score,
            remarks,
            counselled_by,
            users:counselled_by (full_name)
        `)
        .eq('employee_id', profile.employee_id)
        .order('counselling_date', { ascending: false })

    if (error) {
        return <div className="p-8 text-red-600">Failed to load counselling records: {error.message}</div>
    }

    return (
        <MyCounsellingClient 
            records={(counsellingData as any) || []} 
            employeeName={profile.full_name || 'Employee'} 
        />
    )
}
