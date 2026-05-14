'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

const FAILURE_OPTIONS = [
    'Train',
    'Signalling',
    'Telecom (TRCP/HHT/Radio Signalling Etc.)',
    'Platform Mirror/Platform CCTV Mirror',
    'Line Side Signal',
    'Other',
]

interface LineDefect {
    id: string
    emp_id: string
    emp_name: string
    failure_related_to: string
    location: string
    details: string
    reported_at: string
    status: string
}

export default function LineDefectPage() {
    const [empId, setEmpId] = useState('')
    const [empName, setEmpName] = useState('')
    const [failureRelatedTo, setFailureRelatedTo] = useState('')
    const [location, setLocation] = useState('')
    const [details, setDetails] = useState('')
    const [saving, setSaving] = useState(false)
    const [successMsg, setSuccessMsg] = useState(false)
    const [defects, setDefects] = useState<LineDefect[]>([])
    const [loadingUser, setLoadingUser] = useState(true)

    const loadData = useCallback(async () => {
        const supabase = createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from('users')
                .select('employee_id, full_name')
                .eq('id', user.id)
                .single()

            if (profile?.employee_id) {
                setEmpId(profile.employee_id)
                const { data: emp } = await supabase
                    .from('employees')
                    .select('name')
                    .eq('employee_id', profile.employee_id)
                    .single()
                setEmpName(emp?.name || profile.full_name || '')
            } else {
                setEmpName(profile?.full_name || '')
            }
        }

        const { data } = await supabase
            .from('line_defects')
            .select('*')
            .order('reported_at', { ascending: false })
            .limit(50)
        if (data) setDefects(data)
        setLoadingUser(false)
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!failureRelatedTo || !location.trim() || !details.trim()) return

        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase.from('line_defects').insert({
            emp_id: empId || 'N/A',
            emp_name: empName || 'Unknown',
            failure_related_to: failureRelatedTo,
            location: location.trim(),
            details: details.trim(),
            reported_by_user_id: user?.id ?? null,
        })

        if (!error) {
            setFailureRelatedTo('')
            setLocation('')
            setDetails('')
            setSuccessMsg(true)
            setTimeout(() => setSuccessMsg(false), 4000)
            loadData()
        } else {
            alert('Error submitting: ' + error.message)
        }
        setSaving(false)
    }

    function statusBadge(status: string) {
        if (status === 'open') return 'bg-red-100 text-red-700'
        if (status === 'in_progress') return 'bg-amber-100 text-amber-700'
        return 'bg-green-100 text-green-700'
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Line Defect Register</h2>

            {/* Report Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" /> Report a Line Defect
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {successMsg && (
                        <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Defect report submitted successfully.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Employee info */}
                        <div>
                            <Label className="text-sm font-semibold text-slate-600 mb-1 block">
                                1. Name, Emp ID
                            </Label>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-md">
                                {loadingUser ? (
                                    <span className="text-sm text-slate-400">Loading…</span>
                                ) : (
                                    <>
                                        <span className="font-semibold text-slate-800">{empName || '—'}</span>
                                        {empId && (
                                            <span className="font-mono text-xs text-slate-500 bg-white border px-2 py-0.5 rounded">
                                                {empId}
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Failure Related To */}
                        <div>
                            <Label className="text-sm font-semibold text-slate-600 mb-1 block">
                                2. Failure Related To <span className="text-red-500">*</span>
                            </Label>
                            <select
                                required
                                value={failureRelatedTo}
                                onChange={e => setFailureRelatedTo(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            >
                                <option value="">Select your answer</option>
                                {FAILURE_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        {/* Location */}
                        <div>
                            <Label className="text-sm font-semibold text-slate-600 mb-1 block">
                                3. Location <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                required
                                placeholder="Enter location"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                            />
                        </div>

                        {/* Details */}
                        <div>
                            <Label className="text-sm font-semibold text-slate-600 mb-1 block">
                                4. Details <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                required
                                placeholder="Describe the defect in detail…"
                                value={details}
                                onChange={e => setDetails(e.target.value)}
                                rows={4}
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={saving || loadingUser}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {saving ? 'Submitting…' : 'Submit Defect Report'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Defect Records */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Recent Line Defect Records</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {defects.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No defects reported yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50">
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Date / Time</th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase">Reported By</th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Failure Type</th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase">Location</th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase">Details</th>
                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {defects.map(d => (
                                        <tr key={d.id} className="border-b hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(d.reported_at).toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <div className="font-medium text-slate-800">{d.emp_name}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">{d.emp_id}</div>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span className="inline-block px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[11px] font-semibold whitespace-nowrap">
                                                    {d.failure_related_to}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-700">{d.location}</td>
                                            <td className="py-2.5 px-4 text-slate-600 max-w-[240px]">
                                                <span className="line-clamp-2">{d.details}</span>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${statusBadge(d.status)}`}>
                                                    {d.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
