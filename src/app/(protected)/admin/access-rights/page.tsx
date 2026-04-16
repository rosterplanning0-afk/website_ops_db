'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldCheck, CheckCircle2, Save } from 'lucide-react'
import { sidebarConfig, type UserRole } from '@/lib/rbac'
import type { SidebarItem } from '@/lib/rbac'

const CONFIGURABLE_ROLES: { key: UserRole; label: string }[] = [
    { key: 'hod', label: 'HoD' },
    { key: 'manager', label: 'Manager' },
    { key: 'cxo', label: 'CXO' },
    { key: 'roster_planners', label: 'Roster Planner' },
]

// Build a flat list of all navigable items from the sidebar config
function flattenSidebar(items: SidebarItem[], prefix = ''): { key: string; label: string; hasParent: boolean }[] {
    const result: { key: string; label: string; hasParent: boolean }[] = []
    for (const item of items) {
        if (!item.href && item.children) {
            // Parent group
            result.push({ key: item.label, label: item.label, hasParent: false })
            for (const child of item.children) {
                if (child.href) {
                    result.push({ key: child.href, label: `  ↳ ${child.label}`, hasParent: true })
                }
            }
        } else if (item.href) {
            result.push({ key: item.href, label: item.label, hasParent: false })
        }
    }
    return result
}

const ALL_ITEMS = flattenSidebar(sidebarConfig)
const STORAGE_KEY = 'access_rights_overrides'

// Default: derive from sidebarConfig which roles are allowed
function getDefaultAccess(itemKey: string, role: UserRole): boolean {
    for (const item of sidebarConfig) {
        if ((item.href === itemKey || item.label === itemKey)) {
            return item.roles === '*' || (item.roles as UserRole[]).includes(role)
        }
        if (item.children) {
            for (const child of item.children) {
                if (child.href === itemKey) {
                    const parentAllowed = item.roles === '*' || (item.roles as UserRole[]).includes(role)
                    const childAllowed = child.roles === '*' || (child.roles as UserRole[]).includes(role)
                    return parentAllowed && childAllowed
                }
            }
        }
    }
    return false
}

type AccessMap = Record<string, Record<string, boolean>>

export default function AccessRightsPage() {
    const supabase = createClient()
    const [accessMap, setAccessMap] = useState<AccessMap>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [userRole, setUserRole] = useState<string>('')

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('users').select('role, employee_id').eq('id', user.id).single()
            let role = profile?.role || 'employee'

            if (profile?.employee_id) {
                const { data: empInfo } = await supabase.from('employees').select('role').eq('employee_id', profile.employee_id).single()
                if (empInfo?.role) role = empInfo.role.toLowerCase()
            }
            setUserRole(role)

            // Load existing overrides from DB
            const { data: rows } = await supabase
                .from('access_rights_overrides')
                .select('role, item_key, is_visible')

            const map: AccessMap = {}
            // Initialize defaults
            for (const item of ALL_ITEMS) {
                map[item.key] = {}
                for (const r of CONFIGURABLE_ROLES) {
                    map[item.key][r.key] = getDefaultAccess(item.key, r.key)
                }
            }
            // Apply saved overrides
            if (rows) {
                for (const row of rows) {
                    if (!map[row.item_key]) map[row.item_key] = {}
                    map[row.item_key][row.role] = row.is_visible
                }
            }

            setAccessMap(map)
            setLoading(false)
        }
        init()
    }, [])

    function toggleAccess(itemKey: string, role: string) {
        setAccessMap(prev => ({
            ...prev,
            [itemKey]: {
                ...prev[itemKey],
                [role]: !prev[itemKey]?.[role],
            }
        }))
    }

    async function saveChanges() {
        setSaving(true)
        setSaved(false)

        // We'll upsert all overrides into the table
        const upserts = []
        for (const [itemKey, roleMap] of Object.entries(accessMap)) {
            for (const [role, isVisible] of Object.entries(roleMap)) {
                upserts.push({ role, item_key: itemKey, is_visible: isVisible })
            }
        }

        const { error } = await supabase
            .from('access_rights_overrides')
            .upsert(upserts, { onConflict: 'role,item_key' })

        setSaving(false)
        if (!error) {
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } else {
            alert('Failed to save: ' + error.message)
        }
    }

    if (userRole && userRole !== 'admin') {
        return (
            <div className="p-8 text-center text-red-600 font-semibold">
                Access Denied. Only admins can manage access rights.
            </div>
        )
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading access rights...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ShieldCheck className="h-7 w-7 text-red-600" /> Access Rights Management
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Control which sidebar sections are visible for each role. Changes take effect on next login or page refresh.
                    </p>
                </div>
                <Button
                    onClick={saveChanges}
                    disabled={saving}
                    className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
                >
                    {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base">
                        Sidebar Visibility Matrix
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                        ✓ = Visible to role &nbsp;|&nbsp; Grey = Hidden &nbsp;|&nbsp; Admin always has full access and cannot be restricted.
                    </p>
                </CardHeader>
                <CardContent className="pt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-3 px-2 font-semibold text-slate-700 min-w-[200px]">Sidebar Item</th>
                                {CONFIGURABLE_ROLES.map(r => (
                                    <th key={r.key} className="text-center py-3 px-4 font-semibold text-slate-700 min-w-[100px]">
                                        {r.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ALL_ITEMS.map(item => (
                                <tr
                                    key={item.key}
                                    className={`border-b hover:bg-slate-50 transition-colors ${item.hasParent ? 'bg-slate-50/50' : 'bg-white'}`}
                                >
                                    <td className={`py-2.5 px-2 font-medium ${item.hasParent ? 'text-slate-500 text-xs pl-6' : 'text-slate-800'}`}>
                                        {item.label}
                                    </td>
                                    {CONFIGURABLE_ROLES.map(role => {
                                        const isOn = accessMap[item.key]?.[role.key] ?? false
                                        return (
                                            <td key={role.key} className="text-center py-2.5 px-4">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAccess(item.key, role.key)}
                                                    className={`
                                                        w-10 h-6 rounded-full transition-all duration-200 relative
                                                        ${isOn ? 'bg-green-500' : 'bg-slate-300'}
                                                    `}
                                                    title={isOn ? `Hide from ${role.label}` : `Show to ${role.label}`}
                                                >
                                                    <span
                                                        className={`
                                                            absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200
                                                            ${isOn ? 'left-5' : 'left-1'}
                                                        `}
                                                    />
                                                </button>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <strong>⚠️ Important:</strong> This page saves your preferences to the <code>access_rights_overrides</code> table in Supabase.
                You must run the migration below to create this table first. The sidebar will read these overrides to control visibility.
            </div>
        </div>
    )
}
