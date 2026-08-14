'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Search, FileText } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import * as XLSX from 'xlsx'

interface CounsellingReportClientProps {
    canViewIndividual: boolean
    canViewGeneral: boolean
    userDept: string
    isAdmin: boolean
}

export function CounsellingReportClient({ canViewIndividual, canViewGeneral, userDept, isAdmin }: CounsellingReportClientProps) {
    const [reportType, setReportType] = useState<'individual' | 'general'>(canViewIndividual ? 'individual' : 'general')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [month, setMonth] = useState('')
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any[]>([])
    const [hasSearched, setHasSearched] = useState(false)

    async function generateReport() {
        if (!dateFrom || !dateTo) {
            alert('Please select both From and To dates.')
            return
        }

        setLoading(true)
        const supabase = createClient()

        if (reportType === 'individual') {
            let query = supabase
                .from('employee_counselling')
                .select(`
                    id, counselling_date, category, reason, score, remarks, created_at,
                    employee_id,
                    employees!inner (name, department, designation),
                    users:counselled_by (full_name)
                `)
                .gte('counselling_date', dateFrom)
                .lte('counselling_date', dateTo)
                .order('counselling_date', { ascending: false })

            if (!isAdmin && userDept !== 'all') {
                query = query.eq('employees.department', userDept)
            }

            const { data: records, error } = await query

            if (error) {
                alert('Failed to fetch individual counselling records: ' + error.message)
            } else {
                setData(records || [])
                setHasSearched(true)
            }
        } else {
            let query = supabase
                .from('general_counselling_records')
                .select(`
                    id, counselling_date, time_from, time_to, place, areas_for_improvement, created_at,
                    employee_id,
                    employees!inner (name, department, designation),
                    general_counselling_sessions (topic, created_by)
                `)
                .gte('counselling_date', dateFrom)
                .lte('counselling_date', dateTo)
                .order('counselling_date', { ascending: false })
            
            if (!isAdmin && userDept !== 'all') {
                query = query.eq('employees.department', userDept)
            }

            const { data: records, error } = await query

            if (error) {
                alert('Failed to fetch general counselling records: ' + error.message)
            } else {
                // Fetch users manually to avoid schema relationship errors
                const { data: usersData } = await supabase.from('users').select('id, full_name')
                const userMap: Record<string, string> = {}
                usersData?.forEach(u => {
                    userMap[u.id] = u.full_name
                })
                
                const mappedRecords = records?.map(r => ({
                    ...r,
                    conductor_name: userMap[(r.general_counselling_sessions as any)?.created_by] || 'Admin'
                }))

                setData(mappedRecords || [])
                setHasSearched(true)
            }
        }

        setLoading(false)
    }

    function exportToExcel() {
        if (data.length === 0) return

        let exportData = []

        if (reportType === 'individual') {
            exportData = data.map(r => ({
                'Date': r.counselling_date,
                'Recorded At': new Date(r.created_at).toLocaleString('en-IN'),
                'Employee ID': r.employee_id,
                'Employee Name': r.employees?.name || '-',
                'Department': r.employees?.department || '-',
                'Designation': r.employees?.designation || '-',
                'Category': r.category,
                'Score': r.score || (r.category === 'Bad' ? -1 : 1),
                'Reason': r.reason,
                'Remarks': r.remarks || '-',
                'Counselled By': r.users?.full_name || 'Admin'
            }))
        } else {
            exportData = data.map(r => ({
                'Date': r.counselling_date,
                'Time': `${r.time_from} to ${r.time_to}`,
                'Recorded At': new Date(r.created_at).toLocaleString('en-IN'),
                'Place': r.place || '-',
                'Employee ID': r.employee_id,
                'Employee Name': r.employees?.name || '-',
                'Department': r.employees?.department || '-',
                'Designation': r.employees?.designation || '-',
                'Topic': r.general_counselling_sessions?.topic || '-',
                'Areas for Improvement': r.areas_for_improvement || '-',
                'Conducted By': r.conductor_name || 'Admin'
            }))
        }

        const ws = XLSX.utils.json_to_sheet(exportData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Counselling Report')
        XLSX.writeFile(wb, `${reportType}-counselling-report.xlsx`)
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Counselling Reports</h2>

            <Card>
                <CardHeader className="bg-slate-50 border-b pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-indigo-500" /> Report Parameters
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <div className="grid gap-2 w-full md:w-1/3">
                            <label className="text-sm font-semibold text-slate-700">Report Type</label>
                            <select 
                                value={reportType} 
                                onChange={(e) => {
                                    setReportType(e.target.value as any)
                                    setData([])
                                    setHasSearched(false)
                                }}
                                className="w-full border border-slate-300 rounded-md p-2 bg-white"
                            >
                                {canViewIndividual && <option value="individual">Individual Counselling</option>}
                                {canViewGeneral && <option value="general">General Counselling</option>}
                            </select>
                        </div>
                        <div className="grid gap-2 w-full md:w-1/4">
                            <label className="text-sm font-semibold text-slate-700">Month</label>
                            <Input 
                                type="month" 
                                value={month} 
                                onChange={e => {
                                    setMonth(e.target.value)
                                    if (e.target.value) {
                                        const year = parseInt(e.target.value.split('-')[0])
                                        const m = parseInt(e.target.value.split('-')[1])
                                        const lastDay = new Date(year, m, 0).getDate()
                                        setDateFrom(`${e.target.value}-01`)
                                        setDateTo(`${e.target.value}-${lastDay}`)
                                    } else {
                                        setDateFrom('')
                                        setDateTo('')
                                    }
                                }} 
                            />
                        </div>
                        <div className="grid gap-2 w-full md:w-1/4">
                            <label className="text-sm font-semibold text-slate-700">From Date</label>
                            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setMonth(''); }} />
                        </div>
                        <div className="grid gap-2 w-full md:w-1/4">
                            <label className="text-sm font-semibold text-slate-700">To Date</label>
                            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setMonth(''); }} />
                        </div>
                        <div className="w-full md:w-auto">
                            <Button onClick={generateReport} disabled={loading} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700">
                                <Search className="w-4 h-4 mr-2" />
                                {loading ? 'Generating...' : 'Generate'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {hasSearched && (
                <Card>
                    <CardHeader className="border-b flex flex-row justify-between items-center pb-3">
                        <CardTitle className="text-lg">
                            Results ({data.length} records found)
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={data.length === 0} className="border-green-600 text-green-700 hover:bg-green-50">
                            <Download className="w-4 h-4 mr-2" /> Export to Excel
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table className="min-w-[1200px]">
                            {reportType === 'individual' ? (
                                <>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-700">Date</TableHead>
                                            <TableHead className="font-bold text-slate-700">Employee ID</TableHead>
                                            <TableHead className="font-bold text-slate-700">Name</TableHead>
                                            <TableHead className="font-bold text-slate-700 text-center">Score</TableHead>
                                            <TableHead className="font-bold text-slate-700">Reason</TableHead>
                                            <TableHead className="font-bold text-slate-700">Counselled By</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((rec, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-mono text-sm">{rec.counselling_date}</TableCell>
                                                <TableCell className="text-xs text-slate-500">{new Date(rec.created_at).toLocaleString('en-IN')}</TableCell>
                                                <TableCell className="font-medium text-slate-700">{rec.employee_id}</TableCell>
                                                <TableCell>{rec.employees?.name}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${rec.score > 0 ? 'bg-green-50 text-green-700 border-green-200' : rec.score < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                        {rec.score > 0 ? `+${rec.score}` : rec.score || 0}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-semibold">{rec.reason}</div>
                                                    <div className="text-slate-500 truncate max-w-xs">{rec.remarks}</div>
                                                </TableCell>
                                                <TableCell>{rec.users?.full_name || 'Admin'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </>
                            ) : (
                                <>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-slate-700">Date</TableHead>
                                            <TableHead className="font-bold text-slate-700">Recorded At</TableHead>
                                            <TableHead className="font-bold text-slate-700">Employee ID</TableHead>
                                            <TableHead className="font-bold text-slate-700">Name</TableHead>
                                            <TableHead className="font-bold text-slate-700">Topic</TableHead>
                                            <TableHead className="font-bold text-slate-700">Areas for Improvement</TableHead>
                                            <TableHead className="font-bold text-slate-700">Conducted By</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((rec, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="font-medium text-sm">{rec.counselling_date}</div>
                                                    <div className="text-xs text-slate-500">{rec.time_from} - {rec.time_to}</div>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-500">{new Date(rec.created_at).toLocaleString('en-IN')}</TableCell>
                                                <TableCell className="font-medium text-slate-700">{rec.employee_id}</TableCell>
                                                <TableCell>{rec.employees?.name}</TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-semibold line-clamp-2" title={rec.general_counselling_sessions?.topic}>
                                                        {rec.general_counselling_sessions?.topic}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600 line-clamp-2" title={rec.areas_for_improvement}>
                                                    {rec.areas_for_improvement || '-'}
                                                </TableCell>
                                                <TableCell>{rec.conductor_name || 'Admin'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </>
                            )}
                            {data.length === 0 && (
                                <TableBody>
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                            No records found for the selected period.
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            )}
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
