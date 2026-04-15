import { createClient } from '@/utils/supabase/server'
import InstructionMasterClient from '@/components/instructions/instruction-master-client'

export default async function InstructionMasterPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user?.id).single()
    const { data: empData } = profile?.employee_id
        ? await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
        : { data: null }

    const userRole = empData?.role?.toLowerCase() || profile?.role?.toLowerCase() || 'employee'
    const canCreate = ['admin', 'hod', 'manager'].includes(userRole)

    // Default fallback designations
    let availableDesignations = ['Train Operator', 'Crew Controller', 'Station Controller', 'OCC Controller']

    if (userRole === 'admin') {
        // Find ALL active designations for admins
        const { data: desigs } = await supabase.from('employees').select('designation').eq('status', 'Active')
        if (desigs && desigs.length > 0) {
            availableDesignations = Array.from(new Set(desigs.map(d => String(d.designation)).filter(Boolean)))
        }
    } else if (empData?.department) {
        // Fetch unique designations for this department for regular HOD/Managers
        const { data: desigs } = await supabase
            .from('employees')
            .select('designation')
            .eq('department', empData.department)
            .eq('status', 'Active')

        if (desigs && desigs.length > 0) {
            availableDesignations = Array.from(new Set(desigs.map(d => String(d.designation)).filter(Boolean)))
        }
    }

    if (!availableDesignations.includes('All Staff')) {
        availableDesignations.push('All Staff')
    }

    const { data: instructions } = await supabase
        .from('instructions')
        .select('*, instruction_designation_assignments(designation)')
        .order('created_at', { ascending: false })

    return <InstructionMasterClient initialInstructions={instructions || []} canCreate={canCreate} availableDesignations={availableDesignations} />
}
