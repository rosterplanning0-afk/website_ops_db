import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
    try {
        const rateLimitRes = rateLimit(req, { limit: 60, windowMs: 60000 })
        if (!rateLimitRes.success) return rateLimitRes.response

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // RBAC check
        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || !['admin', 'hod', 'manager', 'cxo'].includes(profile.role.toLowerCase())) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const { employee_id, instruction_id, instruction_title } = body

        if (!employee_id || !instruction_id) {
            return NextResponse.json({ error: 'Missing employee_id or instruction_id' }, { status: 400 })
        }

        // Insert notification
        const { error } = await supabase
            .from('notifications')
            .insert({
                employee_id: employee_id,
                title: 'Pending Assurance Reminder',
                message: `Please review and acknowledge the assurance: ${instruction_title || instruction_id}`,
                is_read: false,
                instruction_id: instruction_id // optional reference
            })

        if (error) {
            console.error('[Remind Insert Error]', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Reminder sent' })

    } catch (error) {
        console.error('[POST /api/instructions/remind]', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
