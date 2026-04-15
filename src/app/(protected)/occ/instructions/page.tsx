import { createClient } from '@/utils/supabase/server'
import { InstructionList } from '@/components/instructions/instruction-list'

export default async function OCCInstructionsPage() {
    const supabase = await createClient()
    const { data: profile } = await supabase.from('users').select('role').eq('id', (await supabase.auth.getUser()).data.user?.id).single()
    const canCreate = profile?.role === 'admin' || profile?.role === 'hod'
    const { data: instructions } = await supabase.from('instructions').select('*').order('created_at', { ascending: false })

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">OCC – Instructions</h2>
            <InstructionList instructions={instructions || []} canCreate={canCreate} />
        </div>
    )
}
