'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Menu } from 'lucide-react'
import type { UserRole } from '@/lib/rbac'

interface ProtectedShellProps {
    userRole: UserRole
    userDepartment: string
    userName: string
    userEmail: string
    userDesignation: string
    accessOverrides?: Record<string, boolean>
    children: React.ReactNode
}

export function ProtectedShell({
    userRole, userDepartment, userName, userEmail, userDesignation, accessOverrides, children
}: ProtectedShellProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    return (
        <div className="min-h-screen bg-gray-50 flex print:block print:bg-white print:min-h-0">
            <Sidebar
                userRole={userRole}
                userDepartment={userDepartment}
                userName={userName}
                userEmail={userEmail}
                userDesignation={userDesignation}
                accessOverrides={accessOverrides}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden md:ml-0 print:block print:min-h-0 print:overflow-visible">
                {/* Top Header (legacy-style with hamburger toggle) */}
                <header
                    className="text-white shadow-sm sticky top-0 z-10 print:hidden"
                    style={{ backgroundColor: '#EC0016', height: '60px', padding: '0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', borderRadius: '4px', border: 'none', background: 'none', color: 'white', cursor: 'pointer' }}
                            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/deutsche-bahn-logo.png" alt="DB" style={{ height: '24px', objectFit: 'contain' }} />
                            <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.5px' }}>Operations</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium hidden sm:inline">{userName}</span>
                        <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold uppercase rounded">
                            {userDesignation}
                        </span>
                    </div>
                </header>
                <div className="flex-1 p-6 print:p-0">
                    {children}
                </div>
            </main>
        </div>
    )
}
