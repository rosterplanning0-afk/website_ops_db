'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MessageCircle, Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface CounsellingRecord {
    id: string
    counselling_date: string
    category: string
    reason: string
    score: number
    remarks: string | null
    users?: { full_name: string } | null
}

interface MyCounsellingClientProps {
    records: CounsellingRecord[]
    employeeName: string
}

export function MyCounsellingClient({ records, employeeName }: MyCounsellingClientProps) {
    
    function formatSafeDate(dateStr?: string | null) {
        if (!dateStr) return '—'
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            })
        } catch {
            return dateStr
        }
    }

    // Calculate overall stats
    const totalRecords = records.length
    const positiveCount = records.filter(r => r.score > 0).length
    const negativeCount = records.filter(r => r.score < 0).length
    const netScore = records.reduce((acc, r) => acc + (r.score || 0), 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-sm text-slate-500">
                        <Link href="/dashboard" className="hover:text-indigo-600 flex items-center gap-1">
                            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                        </Link>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">My Counselling History</h2>
                    <p className="text-sm text-slate-500 mt-1">Viewing all counselling records for {employeeName}</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white border rounded-md px-4 py-2 text-center shadow-sm">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Net Score</p>
                        <p className={`text-xl font-black ${netScore > 0 ? 'text-green-600' : netScore < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                            {netScore > 0 ? `+${netScore}` : netScore}
                        </p>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Counselling Records ({totalRecords})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Category / Reason</TableHead>
                                    <TableHead>Counselled By</TableHead>
                                    <TableHead className="text-center">Score</TableHead>
                                    <TableHead>Remarks</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.length > 0 ? (
                                    records.map(rec => (
                                        <TableRow key={rec.id}>
                                            <TableCell className="whitespace-nowrap font-medium text-slate-700">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-slate-400" />
                                                    {formatSafeDate(rec.counselling_date)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="mb-1">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${rec.category === 'Bad' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                        {rec.category || 'Good'}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-semibold text-slate-800">{rec.reason}</div>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600">
                                                {(rec.users as any)?.full_name || 'Admin'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${rec.score > 0 ? 'bg-green-50 text-green-700 border-green-200' : rec.score < 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                    {rec.score > 0 ? `+${rec.score}` : rec.score || 0}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600 italic max-w-xs truncate" title={rec.remarks || ''}>
                                                {rec.remarks || '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                            You do not have any counselling records.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
