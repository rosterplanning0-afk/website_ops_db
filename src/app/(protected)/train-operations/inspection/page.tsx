'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClipboardCheck, Search, CloudUpload, Save } from 'lucide-react'

// Inspection items exactly matching legacy form
const PART_A_DRIVING = [
    'Starting /Stopping of train (Jerk free)',
    'Completing all pre departure checks within the specified time',
    'Activation & Deactivation of train Mainline/Depot',
    'Verifying status of door closure before departure',
    'Habit of checking of faults when pop up',
    'Efficient troubleshooting of train defects',
]

const PART_A_SAFETY = [
    'Following proper sign ON /Off Procedure',
    'Notice Board Reading',
    'Not using Mobile phone during driving',
]

const PART_C = [
    'Any failure, showing lack of safety consciousness...',
    'Alcoholic/smoking habit',
    'Clean & tidy appearance',
]

interface ScoreRow {
    part: string
    section: string
    item_no: number
    item_text: string
    max_marks: number
    marks_awarded: number
}

export default function TOInspectionForm() {
    const [employeeId, setEmployeeId] = useState('')
    const [employeeName, setEmployeeName] = useState('')
    const [employeeDesig, setEmployeeDesig] = useState('')
    const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0])
    const [lookupDone, setLookupDone] = useState(false)
    const [saving, setSaving] = useState(false)
    const [observations, setObservations] = useState('')
    const [defects, setDefects] = useState('')
    const [corrective, setCorrective] = useState('')

    // Scores
    const [scoresAD, setScoresAD] = useState<number[]>(new Array(PART_A_DRIVING.length).fill(0))
    const [scoresAS, setScoresAS] = useState<number[]>(new Array(PART_A_SAFETY.length).fill(0))
    const [scoresC, setScoresC] = useState<number[]>(new Array(PART_C.length).fill(0))

    const totalAD = scoresAD.reduce((s, v) => s + v, 0)
    const totalAS = scoresAS.reduce((s, v) => s + v, 0)
    const totalC = scoresC.reduce((s, v) => s + v, 0)
    const grandTotal = totalAD + totalAS + totalC

    const updateScore = (arr: number[], setArr: React.Dispatch<React.SetStateAction<number[]>>, idx: number, val: number, max: number) => {
        const clamped = Math.min(Math.max(0, val), max)
        setArr(prev => { const next = [...prev]; next[idx] = clamped; return next })
    }

    async function lookupEmployee() {
        if (!employeeId.trim()) return
        const supabase = createClient()
        const { data } = await supabase.from('employees').select('name, designation').eq('employee_id', employeeId.trim()).single()
        if (data) {
            setEmployeeName(data.name)
            setEmployeeDesig(data.designation || '')
            setLookupDone(true)
        } else {
            setEmployeeName('Not found')
            setEmployeeDesig('')
            setLookupDone(false)
        }
    }

    async function submitInspection() {
        if (!employeeId || !lookupDone) return
        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // Fetch the inspector's role and name from users table
        let inspectorRole = ''
        let inspectorName = user?.email || ''
        if (user) {
            const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
            inspectorRole = profile?.role || ''
            inspectorName = profile?.full_name || user.email || ''
        }

        // Capture device information
        const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'

        // Capture IP address
        let ipAddress = ''
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json')
            const ipData = await ipRes.json()
            ipAddress = ipData.ip || ''
        } catch { ipAddress = 'Unknown' }

        // Build all score rows
        const allScores: ScoreRow[] = [
            ...PART_A_DRIVING.map((text, i) => ({ part: 'A', section: 'Driving Skill', item_no: i + 1, item_text: text, max_marks: 1, marks_awarded: scoresAD[i] })),
            ...PART_A_SAFETY.map((text, i) => ({ part: 'A', section: 'Safety', item_no: i + 1, item_text: text, max_marks: 1, marks_awarded: scoresAS[i] })),
            ...PART_C.map((text, i) => ({ part: 'C', section: 'Line Manager Rating', item_no: i + 1, item_text: text, max_marks: 2, marks_awarded: scoresC[i] })),
        ]

        // Insert inspection
        const { data: inspection, error } = await supabase.from('footplate_inspections').insert({
            employee_id: employeeId.trim(),
            inspection_date: inspectionDate,
            part_a_total: totalAD + totalAS,
            part_c_total: totalC,
            overall_total: grandTotal,
            status: 'Submitted',
            observations,
            defects_identified: defects,
            corrective_actions: corrective,
            inspected_by_user_id: user?.id,
            inspected_by_name: inspectorName,
            inspected_by_role: inspectorRole,
            device_info: deviceInfo,
            ip_address: ipAddress,
        }).select().single()

        if (inspection) {
            // Insert individual scores
            await supabase.from('inspection_scores').insert(
                allScores.map(s => ({ ...s, inspection_id: inspection.id }))
            )
            alert('Inspection submitted successfully!')
        } else {
            alert('Error: ' + (error?.message || 'Unknown error'))
        }
        setSaving(false)
    }

    function renderSection(title: string, items: string[], scores: number[], setScores: React.Dispatch<React.SetStateAction<number[]>>, maxPerItem: number) {
        return (
            <div className="bg-white border rounded-lg overflow-hidden mb-4">
                <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800">{title}</h3>
                    <span className="text-xs text-slate-500">Max per item: {maxPerItem}</span>
                </div>
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-12">No.</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Assessment Item</th>
                            <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-24">Marks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((text, i) => (
                            <tr key={i} className="border-t hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm">{i + 1}</td>
                                <td className="px-4 py-3 text-sm">{text}</td>
                                <td className="px-4 py-3 text-center">
                                    <input
                                        type="number"
                                        min={0}
                                        max={maxPerItem}
                                        value={scores[i]}
                                        onChange={e => updateScore(scores, setScores, i, Number(e.target.value), maxPerItem)}
                                        className="w-20 text-center border rounded-md p-1.5 text-sm font-semibold"
                                    />
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold">
                            <td colSpan={2} className="px-4 py-3 text-sm text-right">{title} Total</td>
                            <td className="px-4 py-3 text-center text-sm text-red-600">{scores.reduce((s, v) => s + v, 0)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Footplate Inspection Form</h2>
                <div className="text-lg font-bold text-red-600">Total Score: {grandTotal}</div>
            </div>

            {/* Employee Lookup */}
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Employee & Inspection Info</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Employee ID</Label>
                            <div className="flex gap-2">
                                <Input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Enter ID" />
                                <Button variant="outline" onClick={lookupEmployee}><Search className="h-4 w-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Employee Name</Label>
                            <Input value={employeeName} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Designation</Label>
                            <Input value={employeeDesig} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Inspection Date</Label>
                            <Input type="date" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Inspection Sections */}
            {renderSection('Part A – Driving Skill', PART_A_DRIVING, scoresAD, setScoresAD, 1)}
            {renderSection('Part A – Safety', PART_A_SAFETY, scoresAS, setScoresAS, 1)}
            {renderSection('Part C – Rating by Line Manager', PART_C, scoresC, setScoresC, 2)}

            {/* Observations */}
            <Card>
                <CardHeader><CardTitle>Observations & Actions</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>General Observations</Label>
                            <textarea rows={4} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Enter general observations" value={observations} onChange={e => setObservations(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Defects Identified</Label>
                            <textarea rows={4} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="List any defects" value={defects} onChange={e => setDefects(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2 mt-4">
                        <Label>Corrective Actions Required</Label>
                        <textarea rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Enter corrective actions" value={corrective} onChange={e => setCorrective(e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-3 pb-8">
                <Button variant="outline"><Save className="h-4 w-4 mr-1" /> Save Draft</Button>
                <Button onClick={submitInspection} disabled={saving || !lookupDone} className="bg-red-600 hover:bg-red-700">
                    <CloudUpload className="h-4 w-4 mr-1" /> {saving ? 'Submitting...' : 'Submit Final Inspection'}
                </Button>
            </div>
        </div>
    )
}
