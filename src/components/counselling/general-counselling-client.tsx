'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PlusCircle, Trash2, CheckCircle2, Save, FileText } from 'lucide-react'

interface EmployeeOption {
    employee_id: string
    name: string
    designation: string
    department: string
}

interface SessionOption {
    id: string
    topic: string
    details?: string
    created_at: string
}

interface CounsellingRow {
    id: string
    date: string
    timeFrom: string
    timeTo: string
    place: string
    employeeId: string
    empName: string
    areasForImprovement: string
}

interface GeneralCounsellingClientProps {
    initialEmployees: EmployeeOption[]
    initialSessions: SessionOption[]
    userId: string
}

export function GeneralCounsellingClient({ initialEmployees, initialSessions, userId }: GeneralCounsellingClientProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string>('new')
    const [topic, setTopic] = useState('')
    const [details, setDetails] = useState('')
    
    // Existing records fetched from DB for the selected session
    const [existingRecords, setExistingRecords] = useState<CounsellingRow[]>([])
    
    // New rows added by the user
    const [rows, setRows] = useState<CounsellingRow[]>([createEmptyRow()])
    
    const [saving, setSaving] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')

    const supabase = createClient()

    function createEmptyRow(): CounsellingRow {
        return {
            id: crypto.randomUUID(),
            date: new Date().toISOString().split('T')[0],
            timeFrom: '',
            timeTo: '',
            place: '',
            employeeId: '',
            empName: '',
            areasForImprovement: ''
        }
    }

    // Handle session selection changes
    useEffect(() => {
        async function fetchExistingRecords() {
            if (selectedSessionId === 'new') {
                setTopic('')
                setDetails('')
                setExistingRecords([])
                setRows([createEmptyRow()])
                return
            }

            const session = initialSessions.find(s => s.id === selectedSessionId)
            if (session) {
                setTopic(session.topic)
                setDetails(session.details || '')
            }

            const { data, error } = await supabase
                .from('general_counselling_records')
                .select('*, employees(name)')
                .eq('session_id', selectedSessionId)

            if (!error && data) {
                const mapped: CounsellingRow[] = data.map(d => ({
                    id: d.id,
                    date: d.counselling_date,
                    timeFrom: d.time_from,
                    timeTo: d.time_to,
                    place: d.place || '',
                    employeeId: d.employee_id,
                    empName: d.employees?.name || '',
                    areasForImprovement: d.areas_for_improvement || ''
                }))
                setExistingRecords(mapped)
            } else {
                setExistingRecords([])
            }
            
            // Clear new rows when switching sessions
            setRows([createEmptyRow()])
        }

        fetchExistingRecords()
    }, [selectedSessionId, initialSessions])

    const addRow = () => {
        setRows(prev => [...prev, createEmptyRow()])
    }

    const removeRow = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id))
    }

    const updateRow = (id: string, field: keyof CounsellingRow, value: string) => {
        setRows(prev => prev.map(row => {
            if (row.id === id) {
                const updatedRow = { ...row, [field]: value }
                
                // Auto-fill name if employeeId changes
                if (field === 'employeeId') {
                    const emp = initialEmployees.find(e => e.employee_id === value)
                    updatedRow.empName = emp ? emp.name : ''
                }
                
                return updatedRow
            }
            return row
        }))
    }

    async function handleSubmit() {
        if (!topic.trim()) {
            alert('Please enter the Topic of Counselling.')
            return
        }

        // Validate rows
        const validRows = rows.filter(r => r.employeeId && r.date)
        if (validRows.length === 0) {
            alert('Please add at least one valid new row with an Employee ID and Date.')
            return
        }

        for (const row of validRows) {
            if (!initialEmployees.find(e => e.employee_id === row.employeeId)) {
                alert(`Invalid Employee ID: ${row.employeeId}. Please select from the available list.`)
                return
            }
            
            // Prevent duplicate insertion if already in existingRecords
            if (existingRecords.find(er => er.employeeId === row.employeeId)) {
                alert(`Employee ID: ${row.employeeId} is already counselled in this session.`)
                return
            }
        }

        setSaving(true)
        setSuccessMsg('')

        let activeSessionId = selectedSessionId

        // Insert Session if new
        if (selectedSessionId === 'new') {
            const { data: session, error: sessionError } = await supabase
                .from('general_counselling_sessions')
                .insert({
                    topic: topic,
                    details: details,
                    created_by: userId
                })
                .select()
                .single()

            if (sessionError || !session) {
                setSaving(false)
                alert('Failed to save session: ' + (sessionError?.message || 'Unknown error'))
                return
            }
            activeSessionId = session.id
        }

        // Insert new records
        const recordsToInsert = validRows.map(r => ({
            session_id: activeSessionId,
            employee_id: r.employeeId,
            counselling_date: r.date,
            time_from: r.timeFrom || '00:00:00',
            time_to: r.timeTo || '00:00:00',
            place: r.place,
            areas_for_improvement: r.areasForImprovement
        }))

        const { error: recordsError } = await supabase
            .from('general_counselling_records')
            .insert(recordsToInsert)

        setSaving(false)

        if (recordsError) {
            alert('Failed to save records: ' + recordsError.message)
        } else {
            setSuccessMsg(`Successfully saved ${validRows.length} new participant(s).`)
            
            if (selectedSessionId === 'new') {
                // To properly refresh sessions we'd need to reload or lift state,
                // but setting to empty will reset the form.
                setTopic('')
                setDetails('')
                setRows([createEmptyRow()])
                setTimeout(() => window.location.reload(), 1500) // quick hack to refresh session list
            } else {
                // If appending to existing, move valid rows to existingRecords
                setExistingRecords(prev => [...prev, ...validRows])
                setRows([createEmptyRow()])
            }

            setTimeout(() => setSuccessMsg(''), 5000)
        }
    }

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            <h2 className="text-2xl font-bold text-slate-800">General Counselling of Staff</h2>

            <Card className="border-t-4 border-t-blue-800 shadow-lg">
                <CardHeader className="bg-blue-50 border-b pb-4">
                    <CardTitle className="text-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <span className="text-blue-900 font-bold">Counselling of Train Operations staff</span>
                        <div className="flex items-center gap-4">
                            <select 
                                value={selectedSessionId} 
                                onChange={(e) => setSelectedSessionId(e.target.value)}
                                className="border border-blue-200 rounded p-2 text-sm bg-white min-w-[250px] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="new">--- Create New Session ---</option>
                                {initialSessions.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {new Date(s.created_at).toLocaleDateString()} - {s.topic.substring(0, 30)}...
                                    </option>
                                ))}
                            </select>
                            <Button onClick={handleSubmit} disabled={saving} className="bg-blue-800 hover:bg-blue-900 text-white shrink-0">
                                <Save className="w-4 h-4 mr-2" />
                                {saving ? 'Saving...' : (selectedSessionId === 'new' ? 'Save All' : 'Save New Entries')}
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {successMsg && (
                        <div className="m-4 p-3 bg-green-50 text-green-700 text-sm font-medium rounded-md flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5" /> {successMsg}
                        </div>
                    )}

                    <div className="p-6 border-b border-slate-200 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Topic of Counselling <span className="text-red-500">*</span>
                            </label>
                            <Input 
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                readOnly={selectedSessionId !== 'new'}
                                placeholder="Enter the main topic..."
                                className={`shadow-inner ${selectedSessionId !== 'new' ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Details of Counselling
                            </label>
                            <Textarea 
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                readOnly={selectedSessionId !== 'new'}
                                placeholder="Enter the details discussed during the session..."
                                className={`min-h-[100px] border-slate-300 resize-y ${selectedSessionId !== 'new' ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'shadow-inner'}`}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                        <Table className="min-w-[1200px] border-collapse">
                            <TableHeader className="bg-blue-100/50">
                                <TableRow>
                                    <TableHead className="w-[140px] border-r border-slate-200 text-center font-bold text-slate-700">Date</TableHead>
                                    <TableHead className="w-[110px] border-r border-slate-200 text-center font-bold text-slate-700">Time From</TableHead>
                                    <TableHead className="w-[110px] border-r border-slate-200 text-center font-bold text-slate-700">Time To</TableHead>
                                    <TableHead className="w-[150px] border-r border-slate-200 text-center font-bold text-slate-700">Place</TableHead>
                                    <TableHead className="w-[180px] border-r border-slate-200 text-center font-bold text-slate-700">EMP No <span className="text-red-500">*</span></TableHead>
                                    <TableHead className="w-[200px] border-r border-slate-200 text-center font-bold text-slate-700">Name of TO/TA</TableHead>
                                    <TableHead className="min-w-[300px] border-r border-slate-200 font-bold text-slate-700">Areas recommended for improvement / NBT</TableHead>
                                    <TableHead className="w-[60px] text-center"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Render existing read-only records */}
                                {existingRecords.map((row) => (
                                    <TableRow key={row.id} className="bg-slate-50 text-slate-500 hover:bg-slate-100/50">
                                        <TableCell className="p-3 border-r border-slate-200 text-center">{row.date}</TableCell>
                                        <TableCell className="p-3 border-r border-slate-200 text-center">{row.timeFrom.substring(0, 5)}</TableCell>
                                        <TableCell className="p-3 border-r border-slate-200 text-center">{row.timeTo.substring(0, 5)}</TableCell>
                                        <TableCell className="p-3 border-r border-slate-200">{row.place}</TableCell>
                                        <TableCell className="p-3 border-r border-slate-200 font-semibold text-center">{row.employeeId}</TableCell>
                                        <TableCell className="p-3 border-r border-slate-200">{row.empName}</TableCell>
                                        <TableCell className="p-3 border-r border-slate-200 whitespace-pre-wrap">{row.areasForImprovement}</TableCell>
                                        <TableCell className="p-3 text-center">
                                            <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 font-medium">Saved</span>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {/* Render new editable rows */}
                                {rows.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-blue-50/20 transition-colors">
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input type="date" value={row.date} onChange={(e) => updateRow(row.id, 'date', e.target.value)} className="h-9 border-blue-200 focus:border-blue-500" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input type="time" value={row.timeFrom} onChange={(e) => updateRow(row.id, 'timeFrom', e.target.value)} className="h-9 border-blue-200 focus:border-blue-500" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input type="time" value={row.timeTo} onChange={(e) => updateRow(row.id, 'timeTo', e.target.value)} className="h-9 border-blue-200 focus:border-blue-500" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input placeholder="Location" value={row.place} onChange={(e) => updateRow(row.id, 'place', e.target.value)} className="h-9 border-blue-200 focus:border-blue-500" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input 
                                                list="employee-options" 
                                                placeholder="e.g. 10001" 
                                                value={row.employeeId} 
                                                onChange={(e) => updateRow(row.id, 'employeeId', e.target.value)} 
                                                className="h-9 bg-yellow-50 focus:bg-white border-yellow-200"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Input value={row.empName} readOnly className="h-9 bg-slate-100 text-slate-600 border-slate-200" placeholder="Auto-filled" />
                                        </TableCell>
                                        <TableCell className="p-2 border-r border-slate-200 align-top">
                                            <Textarea 
                                                value={row.areasForImprovement} 
                                                onChange={(e) => updateRow(row.id, 'areasForImprovement', e.target.value)} 
                                                className="min-h-[36px] h-9 resize-y py-2 border-blue-200 focus:border-blue-500"
                                                placeholder="Remarks..."
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 text-center align-top">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => removeRow(row.id)}
                                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-9 w-9"
                                                title="Remove Row"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
                        <Button 
                            variant="outline" 
                            onClick={addRow}
                            className="w-full max-w-md border-dashed border-2 border-blue-300 text-blue-600 hover:border-blue-600 hover:text-blue-800 bg-transparent hover:bg-blue-50"
                        >
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Add New Participant
                        </Button>
                    </div>

                </CardContent>
            </Card>

            <datalist id="employee-options">
                {initialEmployees.map(emp => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                        {emp.name} ({emp.designation})
                    </option>
                ))}
            </datalist>

        </div>
    )
}
