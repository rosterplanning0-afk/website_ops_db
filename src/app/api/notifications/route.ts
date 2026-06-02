import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(req: Request) {
    try {
        const rateLimitRes = rateLimit(req, { limit: 120, windowMs: 60000 })
        if (!rateLimitRes.success) return rateLimitRes.response

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Get employee_id
        const { data: profile } = await supabase
            .from('users')
            .select('employee_id')
            .eq('id', user.id)
            .single()

        if (!profile?.employee_id) {
            return NextResponse.json({ data: [] })
        }

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('employee_id', profile.employee_id)
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { id, is_read } = body

        if (!id) return NextResponse.json({ error: 'Missing notification id' }, { status: 400 })

        const { error } = await supabase
            .from('notifications')
            .update({ is_read })
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
