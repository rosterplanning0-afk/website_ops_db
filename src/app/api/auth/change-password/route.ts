import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

const Schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: Request) {
    try {
        const supabase = await createClient()

        // Verify user is authenticated
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const { currentPassword, newPassword } = Schema.parse(body)

        // Re-authenticate with current password to verify it's correct
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email!,
            password: currentPassword,
        })

        if (signInError) {
            return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
        }

        // Update the password
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword,
        })

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        // Un-flag force_password_change for this user if it was true
        await supabase.from('users').update({ force_password_change: false }).eq('id', user.id)

        return NextResponse.json({ message: 'Password updated successfully.' })
    } catch (err: any) {
        if (err?.issues) return NextResponse.json({ error: err.issues[0]?.message || 'Invalid input' }, { status: 400 })
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
