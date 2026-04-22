import { createClient } from '@/utils/supabase/server'
import InstructionMasterClient from '@/components/instructions/instruction-master-client'

export default async function StationControlInstructionsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user?.id).single()
    const { data: empData } = profile?.employee_id
        ? await supabase.from('employees').select('role, department').eq('employee_id', profile.employee_id).single()
        : { data: null }

    const userRole = empData?.role?.toLowerCase() || profile?.role?.toLowerCase() || 'employee'
    const canCreate = ['admin', 'hod', 'manager'].includes(userRole)

    let availableDesignations: string[] = []

    if (userRole === 'admin') {
        const { data: desigs } = await supabase.from('employees').select('designation').eq('status', 'Active')
        if (desigs && desigs.length > 0) {
            availableDesignations = Array.from(new Set(desigs.map(d => String(d.designation)).filter(Boolean)))
        }
    } else if (empData?.department) {
        const { data: desigs } = await supabase
            .from('employees')
            .select('designation')
            .eq('department', empData.department)
            .eq('status', 'Active')

        if (desigs && desigs.length > 0) {
            availableDesignations = Array.from(new Set(desigs.map(d => String(d.designation)).filter(Boolean)))
        }
    }

    if (userRole === 'admin' && !availableDesignations.includes('All Staff')) {
        availableDesignations.push('All Staff')
    }

    const { data: instructions } = await supabase
        .from('instructions')
        .select('*, instruction_designation_assignments(designation)')
        .order('created_at', { ascending: false })

    // Filter displayed instructions so the department only sees what's assigned to it or 'All Staff'
    let filteredInstructions = instructions || []
    if (userRole !== 'admin' && availableDesignations.length > 0) {
        filteredInstructions = filteredInstructions.filter((inst) => {
            return inst.instruction_designation_assignments?.some(a => 
                a.designation === 'All Staff' || availableDesignations.includes(a.designation)
            )
        })
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 border-b pb-2">Station Control – Manage Instructions</h2>
            <InstructionMasterClient 
                initialInstructions={filteredInstructions} 
                canCreate={canCreate} 
                availableDesignations={availableDesignations} 
            />
        </div>
    )
}
