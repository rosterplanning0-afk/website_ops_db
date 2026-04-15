'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type SidebarItem, type UserRole, getFilteredSidebar } from '@/lib/rbac'
import {
    LayoutDashboard, Users, List, UserCircle, Train, ClipboardCheck,
    BarChart3, MessageCircle, FileText, Radio, Building2, FileBarChart,
    FileCheck, PieChart, TrendingUp, ChevronDown, ChevronRight, Menu, X, LogOut,
    ShieldCheck, UserCog, KeyRound, Key, CalendarDays, ShieldAlert, UserPlus,
    PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'

const iconMap: Record<string, React.ElementType> = {
    LayoutDashboard, Users, List, UserCircle, Train, ClipboardCheck,
    BarChart3, MessageCircle, FileText, Radio, Building2, FileBarChart,
    FileCheck, PieChart, TrendingUp, ShieldCheck, UserCog, KeyRound, Key,
    CalendarDays, ShieldAlert, UserPlus,
}

interface SidebarProps {
    userRole: UserRole
    userDepartment?: string
    userName: string
    userEmail: string
    userDesignation?: string
    collapsed: boolean
    onToggleCollapse: () => void
}

export function Sidebar({ userRole, userDepartment, userName, userEmail, collapsed, onToggleCollapse }: SidebarProps) {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const menuItems = getFilteredSidebar(userRole, userDepartment)

    function toggleGroup(label: string) {
        setExpandedGroups((prev) => {
            const next = new Set(prev)
            if (next.has(label)) next.delete(label)
            else next.add(label)
            return next
        })
    }

    function isActive(href?: string) {
        if (!href) return false
        return pathname === href || pathname.startsWith(href + '/')
    }

    function renderItem(item: SidebarItem, depth = 0) {
        const Icon = iconMap[item.icon] || FileText
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expandedGroups.has(item.label)
        const active = isActive(item.href)

        // Auto-expand if a child is active
        const childActive = item.children?.some((c) => isActive(c.href))

        if (hasChildren) {
            const open = isExpanded || childActive
            return (
                <li key={item.label}>
                    <button
                        onClick={() => toggleGroup(item.label)}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors hover:bg-slate-800 ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                            } ${childActive ? 'text-red-400' : 'text-slate-300'}`}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                            <>
                                <span className="flex-1 text-left">{item.label}</span>
                                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </>
                        )}
                    </button>
                    {open && !collapsed && (
                        <ul className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
                            {item.children!.map((child) => renderItem(child, depth + 1))}
                        </ul>
                    )}
                </li>
            )
        }

        return (
            <li key={item.label}>
                <Link
                    href={item.href || '#'}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                        } ${active
                            ? 'bg-red-600/20 text-red-400 border-l-2 border-red-500'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                </Link>
            </li>
        )
    }

    const sidebarContent = (
        <>
            {/* Brand + Collapse Toggle */}
            <div className={`border-b border-slate-800 flex items-center ${collapsed ? 'justify-center p-3' : 'p-4 gap-3'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/deutsche-bahn-logo.png" alt="DB" className="h-8 w-8 object-contain shrink-0" />
                {!collapsed && (
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-white leading-tight">Operations</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">DB RRTS</p>
                    </div>
                )}
            </div>

            {/* User Info */}
            {!collapsed ? (
                <div className="px-4 py-3 border-b border-slate-800">
                    <p className="text-sm font-semibold text-white truncate">{userName}</p>
                    <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-red-600/20 text-red-400 text-[10px] font-bold uppercase rounded">
                        {userRole}
                    </span>
                </div>
            ) : (
                <div className="py-3 border-b border-slate-800 flex justify-center" title={userName}>
                    <UserCircle className="h-6 w-6 text-red-400" />
                </div>
            )}

            {/* Nav Items */}
            <nav className="flex-1 overflow-y-auto p-3">
                <ul className="space-y-1">
                    {menuItems.map((item) => renderItem(item))}
                </ul>
            </nav>

            {/* Logout */}
            <div className="p-3 border-t border-slate-800">
                <form action="/auth/signout" method="post">
                    <button
                        type="submit"
                        title={collapsed ? 'Sign Out' : undefined}
                        className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-600/10 transition-colors ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                            }`}
                    >
                        <LogOut className="h-4 w-4" />
                        {!collapsed && <span>Sign Out</span>}
                    </button>
                </form>
            </div>
        </>
    )

    return (
        <>
            {/* Mobile Toggle */}
            <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden fixed top-4 left-4 z-50 bg-slate-900 text-white p-2 rounded-lg shadow-lg"
            >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                style={{ width: collapsed ? '70px' : '260px' }}
                className={`
                    fixed md:sticky top-0 left-0 z-40 h-screen bg-slate-900 text-white flex flex-col
                    transition-all duration-300 ease-in-out shrink-0
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}
            >
                {sidebarContent}

                {/* Desktop Collapse Toggle - Bottom */}
                <button
                    onClick={onToggleCollapse}
                    className="hidden md:flex items-center justify-center p-2 border-t border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
            </aside>
        </>
    )
}
