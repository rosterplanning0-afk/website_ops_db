import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
    const supabase = await createClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
        return redirect('/dashboard?error=LogoutFailed')
    }

    return redirect('/')
}
