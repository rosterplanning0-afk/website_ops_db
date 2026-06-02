'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { Sidebar } from '@/components/sidebar'
import { Menu, Bell, Check } from 'lucide-react'
import type { UserRole } from '@/lib/rbac'

interface Notification {
    id: string
    title: string
    message: string
    is_read: boolean
    created_at: string
}

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
    const [showNotifications, setShowNotifications] = useState(false)
    const notifRef = useRef<HTMLDivElement>(null)

    const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data || [])
    const { data: notifications = [], mutate } = useSWR<Notification[]>('/api/notifications', fetcher, { 
        refreshInterval: 60000 // auto-refresh every minute
    })

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifications(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const markAsRead = async (id: string) => {
        // Optimistic update
        mutate(notifications.map(n => n.id === id ? { ...n, is_read: true } : n), false)
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_read: true })
            })
            mutate() // revalidate
        } catch (err) {
            console.error('Failed to mark read', err)
        }
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

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
                    <div className="flex items-center gap-4">
                        
                        {/* Notifications */}
                        <div className="relative" ref={notifRef}>
                            <button 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-1.5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <Bell className="h-5 w-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-yellow-400 rounded-full border border-[#EC0016]"></span>
                                )}
                            </button>
                            
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden text-slate-800">
                                    <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                        <h3 className="font-semibold text-sm">Notifications</h3>
                                        <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full">{unreadCount} new</span>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="px-4 py-6 text-center text-sm text-slate-500">No notifications</div>
                                        ) : (
                                            <div className="divide-y divide-slate-100">
                                                {notifications.map(notif => (
                                                    <div 
                                                        key={notif.id} 
                                                        className={`p-4 hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/50' : ''}`}
                                                    >
                                                        <div className="flex justify-between gap-2">
                                                            <div>
                                                                <p className="text-sm font-medium">{notif.title}</p>
                                                                <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                                                                <p className="text-[10px] text-slate-400 mt-2">
                                                                    {new Date(notif.created_at).toLocaleString('en-IN')}
                                                                </p>
                                                            </div>
                                                            {!notif.is_read && (
                                                                <button 
                                                                    onClick={() => markAsRead(notif.id)}
                                                                    className="shrink-0 text-slate-400 hover:text-blue-600 self-start p-1"
                                                                    title="Mark as read"
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="hidden sm:flex items-center gap-3 border-l border-white/20 pl-4">
                            <span className="text-sm font-medium">{userName}</span>
                            <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold uppercase rounded">
                                {userDesignation}
                            </span>
                        </div>
                    </div>
                </header>
                <div className="flex-1 p-6 print:p-0">
                    {children}
                </div>
            </main>
        </div>
    )
}
