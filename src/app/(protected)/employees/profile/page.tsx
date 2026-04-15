import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserCircle, Calendar, Briefcase, Building2, CreditCard, Mail } from 'lucide-react'

export default async function EmployeeProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/')

    const { data: profile } = await supabase
        .from('users')
        .select('full_name, role, employee_id, email')
        .eq('id', user.id)
        .single()

    // Fetch employee details from employees table
    const { data: employee } = profile?.employee_id
        ? await supabase.from('employees').select('*').eq('employee_id', profile.employee_id).single()
        : { data: null }

    const empName = employee?.name || profile?.full_name || 'User'
    const empRole = employee?.role || profile?.role || 'employee'

    const details = [
        { label: 'Employee ID', value: employee?.employee_id || profile?.employee_id || '—', icon: CreditCard },
        { label: 'Designation', value: employee?.designation || '—', icon: Briefcase },
        { label: 'Department', value: employee?.department || '—', icon: Building2 },
        { label: 'Gender', value: employee?.gender || '—', icon: UserCircle },
        { label: 'Date of Joining', value: employee?.date_joined ? new Date(employee.date_joined).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', icon: Calendar },
        { label: 'Status', value: employee?.status || 'Active', icon: Briefcase },
        { label: 'Email', value: profile?.email || user?.email || '—', icon: Mail },
        { label: 'Role', value: empRole, icon: UserCircle },
    ]

    const initials = (empName !== 'User' ? empName : 'U')
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Employee Profile</h2>

            <Card className="max-w-3xl">
                <CardContent className="pt-6">
                    {/* Profile Header */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 mb-6 border-b">
                        <div className="w-24 h-24 bg-red-600 text-white rounded-full flex items-center justify-center text-3xl font-bold shrink-0">
                            {initials}
                        </div>
                        <div className="text-center sm:text-left">
                            <h3 className="text-2xl font-bold text-slate-800">{empName}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                ID: {employee?.employee_id || profile?.employee_id || '—'} &nbsp;|&nbsp; Department: {employee?.department || '—'}
                            </p>
                            <span className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold uppercase rounded-full">
                                {empRole}
                            </span>
                        </div>
                    </div>

                    {/* Detail Rows */}
                    <div className="divide-y">
                        {details.map(({ label, value, icon: Icon }) => (
                            <div key={label} className="flex items-center py-4">
                                <div className="flex items-center gap-2 w-48 text-sm font-semibold text-slate-700">
                                    <Icon className="h-4 w-4 text-slate-400" />
                                    {label}
                                </div>
                                <div className="flex-1 text-sm text-slate-600">{value}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
