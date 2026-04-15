'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function ForcePasswordRedirect({ force }: { force: boolean }) {
    const router = useRouter()
    const pathname = usePathname()
    
    useEffect(() => {
        if (force && pathname !== '/account/change-password') {
            router.replace('/account/change-password')
        }
    }, [force, pathname, router])
    
    return null
}
