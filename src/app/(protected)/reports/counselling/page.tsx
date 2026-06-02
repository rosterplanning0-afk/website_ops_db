import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CounsellingReportClient } from '@/components/reports/counselling-report-client'

export const dynamic = 'force-dynamic'

export default async function CounsellingReportPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/')

    // Get user role and employee mapping
    const { data: profile } = await supabase
        .from('users')
        .select('role, employee_id')
        .eq('id', user.id)
        .single()

    if (!profile) redirect('/')

    // Get designation
    let designation = ''
    if (profile.employee_id) {
        const { data: emp } = await supabase
            .from('employees')
            .select('designation')
            .eq('employee_id', profile.employee_id)
            .single()
        if (emp) designation = emp.designation
    }

    const role = profile.role || 'employee'
    const isCrewController = designation === 'Crew Controller'

    // Determine access
    const canViewIndividual = ['admin', 'hod', 'manager'].includes(role)
    const canViewGeneral = canViewIndividual || isCrewController

    if (!canViewIndividual && !canViewGeneral) {
        return (
            <div className="p-8 text-center text-red-600">
                You do not have permission to view Counselling Reports.
            </div>
        )
    }

    // Since we'll let the client fetch data dynamically based on date range, 
    // we don't need to load all records here. We'll just pass access flags.

    // Get department
    let userDept = 'all'
    if (profile.employee_id) {
        const { data: emp } = await supabase
            .from('employees')
            .select('department')
            .eq('employee_id', profile.employee_id)
            .single()
        if (emp) userDept = emp.department || 'all'
    }

    return (
        <CounsellingReportClient 
            canViewIndividual={canViewIndividual} 
            canViewGeneral={canViewGeneral}
            userDept={userDept}
            isAdmin={role === 'admin'}
        />
    )
}
