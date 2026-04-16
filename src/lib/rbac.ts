export type UserRole = 'admin' | 'cxo' | 'hod' | 'manager' | 'employee' | 'roster_planners'

export interface UserProfile {
    id: string
    email: string
    full_name: string
    role: UserRole
    employee_id: string
}

// Define which routes each role can access
const roleAccessMap: Record<UserRole, string[]> = {
    admin: ['*'], // Full access
    cxo: [
        '/dashboard',
        '/roster-analytics',
    ],
    hod: [
        '/dashboard',
        '/employees',
        '/train-operations',
        '/occ',
        '/station-control',
        '/reports',
        '/instructions',
        '/counselling',
        '/roster-analytics',
    ],
    manager: [
        '/dashboard',
        '/train-operations',
        '/instructions',
        '/reports',
        '/account',
        '/counselling',
        '/roster-analytics',
    ],
    employee: [
        '/dashboard',
        '/instructions',
        '/account',
    ],
    roster_planners: [
        '/dashboard',
        '/employees',
        '/roster-analytics',
        '/account',
    ],
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
    const allowed = roleAccessMap[role]
    if (!allowed) return false
    if (allowed.includes('*')) return true
    return allowed.some((route) => pathname.startsWith(route))
}

// Sidebar menu configuration with role-based visibility
export interface SidebarItem {
    label: string
    href?: string
    icon: string // lucide icon name
    roles: UserRole[] | '*'
    children?: SidebarItem[]
}

export const sidebarConfig: SidebarItem[] = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'LayoutDashboard',
        roles: '*',
    },
    {
        label: 'Employee Master',
        icon: 'Users',
        roles: ['admin', 'cxo', 'roster_planners'],
        children: [
            { label: 'Employee List', href: '/employees', icon: 'List', roles: ['admin', 'cxo', 'roster_planners'] },
            { label: 'Assign Manager', href: '/employees/assign-manager', icon: 'UserPlus', roles: ['admin'] },
            { label: 'Employee Profile', href: '/employees/profile', icon: 'UserCircle', roles: '*' },
        ],
    },
    {
        label: 'Counselling',
        href: '/counselling',
        icon: 'MessageCircle',
        roles: ['admin', 'hod', 'manager'],
    },
    {
        label: 'Train Operations',
        icon: 'Train',
        roles: ['admin', 'hod', 'manager'],
        children: [
            { label: 'TO Inspection', href: '/train-operations/inspection', icon: 'ClipboardCheck', roles: ['admin', 'hod', 'manager'] },
            // DISABLED FOR NOW. To enable, uncomment the following lines:
            // { label: 'TO Performance', href: '/train-operations/performance', icon: 'BarChart3', roles: ['admin', 'hod', 'manager'] },
            { label: 'Instructions', href: '/train-operations/instructions', icon: 'FileText', roles: ['admin', 'hod', 'manager'] },
        ],
    },
    {
        label: 'OCC',
        icon: 'Radio',
        roles: ['admin', 'hod', 'manager'],
        children: [
            { label: 'Instructions', href: '/occ/instructions', icon: 'FileText', roles: ['admin', 'hod', 'manager'] },
        ],
    },
    {
        label: 'Station Control',
        icon: 'Building2',
        roles: ['admin', 'hod', 'manager'],
        children: [
            { label: 'Instructions', href: '/station-control/instructions', icon: 'FileText', roles: ['admin', 'hod', 'manager'] },
        ],
    },
    {
        label: 'Roster Analytics',
        icon: 'BarChart3',
        roles: ['admin', 'cxo', 'hod', 'manager', 'roster_planners'],
        children: [
            { label: 'Daily Overview', href: '/roster-analytics/daily', icon: 'CalendarDays', roles: ['admin', 'cxo', 'hod', 'manager', 'roster_planners'] },
            { label: 'Historical Trends', href: '/roster-analytics/trends', icon: 'TrendingUp', roles: ['admin', 'cxo', 'hod', 'manager', 'roster_planners'] },
            { label: 'Fatigue Management', href: '/roster-analytics/fatigue', icon: 'ShieldAlert', roles: ['admin', 'cxo', 'hod', 'manager', 'roster_planners'] },
        ],
    },
    {
        label: 'Reports',
        icon: 'FileBarChart',
        roles: ['admin', 'hod', 'manager'],
        children: [
            { label: 'Instruction Ack', href: '/reports/instruction-ack', icon: 'FileCheck', roles: ['admin', 'hod', 'manager'] },
            { label: 'Ack Sheet', href: '/reports/instruction-ack-sheet', icon: 'FileText', roles: ['admin', 'hod', 'manager'] },
            { label: 'Role/Section Summary', href: '/reports/role-summary', icon: 'PieChart', roles: ['admin', 'hod'] },
            { label: 'Inspection Statistics', href: '/reports/inspection-stats', icon: 'TrendingUp', roles: ['admin', 'hod', 'manager'] },
        ],
    },
    {
        label: 'Account',
        icon: 'KeyRound',
        roles: '*',
        children: [
            { label: 'Employee Profile', href: '/employees/profile', icon: 'UserCircle', roles: '*' },
            { label: 'Delegation Settings', href: '/admin/delegation', icon: 'ShieldCheck', roles: ['admin'] },
            { label: 'Access Rights', href: '/admin/access-rights', icon: 'ShieldAlert', roles: ['admin'] },
            { label: 'Change Password', href: '/account/change-password', icon: 'Key', roles: '*' },
        ],
    },
]

export const DEPT_CREW_MAPPING: Record<string, string[]> = {
    'OCC': [
        'Traffic Controller',
        'Fault Management Controller',
        'Information Controller',
        'Traction Power Controller',
        'Rolling Stock Controller',
        'Auxiliary System Controller',
        'Depot Controller'
    ],
    'Train Operations': [
        'Train Operators',
        'Train Attendants',
        'Crew Controller'
    ],
    'Station Operations': [
        'Station Controller',
        'Excess Fare Officer'
    ],
    'Station Control': [ // Mapping alias
        'Station Controller',
        'Excess Fare Officer'
    ]
}

export function getFilteredSidebar(
    role: UserRole, 
    department?: string, 
    accessOverrides?: Record<string, boolean>
): SidebarItem[] {
    return sidebarConfig
        .filter((item) => {
            let roleMatch = item.roles === '*' || item.roles.includes(role)
            
            // Apply override if exists, except for admin
            if (role !== 'admin' && accessOverrides) {
                const key = item.href || item.label
                if (accessOverrides[key] !== undefined) {
                    roleMatch = accessOverrides[key]
                }
            }

            if (!roleMatch) return false

            // Department specific logic for HOD and Manager
            if (role === 'manager' || role === 'hod') {
                const dept = (department || '').toLowerCase()
                const label = item.label.toLowerCase()

                if (label === 'train operations' && !dept.includes('train')) return false
                if (label === 'occ' && !dept.includes('occ')) return false
                if (label === 'station control' && !dept.includes('station')) return false
            }

            return true
        })
        .map((item) => ({
            ...item,
            children: item.children?.filter((child) => {
                let roleMatch = child.roles === '*' || child.roles.includes(role)
                
                // Apply override if exists, except for admin
                if (role !== 'admin' && accessOverrides) {
                    const key = child.href || child.label
                    if (accessOverrides[key] !== undefined) {
                        roleMatch = accessOverrides[key]
                    }
                }

                if (!roleMatch) return false

                // Also check children for department consistency
                if (role === 'manager' || role === 'hod') {
                    const dept = (department || '').toLowerCase()
                    const href = (child.href || '').toLowerCase()

                    if (href.startsWith('/train-operations') && !dept.includes('train')) return false
                    if (href.startsWith('/occ') && !dept.includes('occ')) return false
                    if (href.startsWith('/station-control') && !dept.includes('station')) return false
                }

                return true
            }),
        }))
}
