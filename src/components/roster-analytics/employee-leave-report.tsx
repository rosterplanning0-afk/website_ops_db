'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { DailyRosterRow } from '@/lib/roster-utils'
import { LEAVE_TYPES } from '@/lib/roster-utils'

interface LeaveReportProps {
    leaveData: Partial<DailyRosterRow>[]
}

interface EmployeeLeaveAgg {
    empId: string
    name: string
    designation: string
    monthlyLeaves: Record<string, number>
    totalLeaves: number
    totalAbsent: number
    totalAll: number
}

export function EmployeeLeaveReport({ leaveData }: LeaveReportProps) {
    const { reportData, allMonths } = useMemo(() => {
        const empMap = new Map<string, EmployeeLeaveAgg>()
        const monthSet = new Set<string>()

        leaveData.forEach(row => {
            if (!row.emp_id || !row.date || !row.duty_category) return

            // format: YYYY-MM
            const monthKey = row.date.substring(0, 7)
            monthSet.add(monthKey)

            if (!empMap.has(row.emp_id)) {
                empMap.set(row.emp_id, {
                    empId: row.emp_id,
                    name: row.name || 'Unknown',
                    designation: row.designation || '-',
                    monthlyLeaves: {},
                    totalLeaves: 0,
                    totalAbsent: 0,
                    totalAll: 0,
                })
            }

            const agg = empMap.get(row.emp_id)!

            // Initialize month if not exist
            if (!agg.monthlyLeaves[monthKey]) {
                agg.monthlyLeaves[monthKey] = 0
            }

            // Count it for the month
            agg.monthlyLeaves[monthKey] += 1
            agg.totalAll += 1

            // Count for specific categories
            if (row.duty_category === 'Absent') {
                agg.totalAbsent += 1
            } else if (LEAVE_TYPES.includes(row.duty_category as any)) {
                agg.totalLeaves += 1
            }
        })

        const sortedMonths = Array.from(monthSet).sort()
        const sortedData = Array.from(empMap.values()).sort((a, b) => a.name.localeCompare(b.name))

        return { reportData: sortedData, allMonths: sortedMonths }
    }, [leaveData])

    // Convert YYYY-MM to readable format, e.g. "Jan 2026"
    const formatMonth = (m: string) => {
        const date = new Date(m + '-01')
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }

    const downloadExcel = () => {
        if (reportData.length === 0) return

        const exportRows = reportData.map(row => {
            const rowData: Record<string, any> = {
                'Employee ID': row.empId,
                'Name': row.name,
                'Designation': row.designation,
            }

            allMonths.forEach(m => {
                rowData[formatMonth(m)] = row.monthlyLeaves[m] || 0
            })

            rowData['Total Leaves'] = row.totalLeaves
            rowData['Total Absent'] = row.totalAbsent
            rowData['Total All'] = row.totalAll

            return rowData
        })

        const ws = XLSX.utils.json_to_sheet(exportRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Leave Report')
        XLSX.writeFile(wb, `employee_leave_report_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Employee Wise Leave Report</CardTitle>
                <Button variant="outline" size="sm" onClick={downloadExcel} disabled={reportData.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                </Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white shadow-sm">
                            <tr className="border-b bg-slate-50">
                                <th className="text-left p-3 font-semibold whitespace-nowrap min-w-[100px]">Emp ID</th>
                                <th className="text-left p-3 font-semibold whitespace-nowrap min-w-[150px]">Name</th>
                                <th className="text-left p-3 font-semibold whitespace-nowrap min-w-[120px]">Designation</th>
                                {allMonths.map(m => (
                                    <th key={m} className="text-center p-3 font-semibold whitespace-nowrap min-w-[100px]">
                                        {formatMonth(m)}
                                    </th>
                                ))}
                                <th className="text-center p-3 font-semibold whitespace-nowrap bg-amber-50">Total Leaves</th>
                                <th className="text-center p-3 font-semibold whitespace-nowrap bg-red-50">Total Absent</th>
                                <th className="text-center p-3 font-semibold whitespace-nowrap bg-slate-100">Total All</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.length > 0 ? (
                                reportData.map((row) => (
                                    <tr key={row.empId} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-mono text-slate-600">{row.empId}</td>
                                        <td className="p-3 font-medium">{row.name}</td>
                                        <td className="p-3 text-slate-600">{row.designation}</td>
                                        {allMonths.map(m => (
                                            <td key={m} className="text-center p-3">
                                                {row.monthlyLeaves[m] > 0 ? (
                                                    <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 h-6 w-6 rounded-full text-xs font-semibold">
                                                        {row.monthlyLeaves[m]}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        ))}
                                        <td className="text-center p-3 font-semibold text-amber-700 bg-amber-50/30">{row.totalLeaves}</td>
                                        <td className="text-center p-3 font-semibold text-red-700 bg-red-50/30">{row.totalAbsent}</td>
                                        <td className="text-center p-3 font-bold bg-slate-50">{row.totalAll}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={allMonths.length + 6} className="p-8 text-center text-slate-500">
                                        No leave or absent data found for the selected criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
