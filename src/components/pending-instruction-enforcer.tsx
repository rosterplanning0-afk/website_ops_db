'use client'

import { useState, useEffect } from 'react'
import { InstructionDialog } from './instruction-dialog'
import { useRouter, usePathname } from 'next/navigation'

export function PendingInstructionEnforcer({ 
    instructionId, 
    employeeId 
}: { 
    instructionId: string | null
    employeeId: string | undefined 
}) {
    const [open, setOpen] = useState(!!instructionId)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        setOpen(!!instructionId)
        
        // If there's a pending instruction and we're not on the dashboard, lock them out of other pages
        if (instructionId && pathname !== '/dashboard') {
            router.replace('/dashboard')
        }
    }, [instructionId, pathname, router])

    if (!instructionId) return null

    return (
        <InstructionDialog
            instructionId={instructionId}
            open={open}
            onOpenChange={(val) => {
                // If they try to close it, don't let them
                setOpen(true)
            }}
            employeeId={employeeId}
            mandatory={true}
            onAcknowledged={() => {
                setOpen(false)
                // Refresh the page to clear the enforcer and let them continue
                router.refresh()
            }}
        />
    )
}
