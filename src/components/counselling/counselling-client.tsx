'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, Search, PlusCircle, CheckCircle2, Pencil, X } from 'lucide-react'

interface EmployeeOption {
    employee_id: string
    name: string
    designation: string
    department: string
}

interface CounsellingRecord {
    id: string
    employee_id: string
    counselling_date: string
    reason: string
    remarks: string
    category: 'Good' | 'Bad'
    score: number
    emp_name?: string
    counselled_by_name?: string
    counselled_by?: string
}

interface CounsellingClientProps {
    initialEmployees: EmployeeOption[]
    initialRecords: CounsellingRecord[]
    userId: string
    userRole: string
}

export function CounsellingClient({ initialEmployees, initialRecords, userId, userRole }: CounsellingClientProps) {
    const router = useRouter()
    const [searchEmpId, setSearchEmpId] = useState('')
    const [selectedEmpId, setSelectedEmpId] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [reason, setReason] = useState('')
    const [remarks, setRemarks] = useState('')
    const [category, setCategory] = useState<'Good' | 'Bad'>('Good')
    const [score, setScore] = useState(1)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')

    // Filter dropdown based on search input
    const safeSearch = searchEmpId.toLowerCase()
    const filteredEmployees = initialEmployees.filter(e => 
        (e.employee_id || '').toLowerCase().includes(safeSearch) ||
        (e.name || '').toLowerCase().includes(safeSearch)
    )

    function handleEdit(record: CounsellingRecord) {
        setEditingId(record.id)
        setSelectedEmpId(record.employee_id)
        setSearchEmpId(`${record.employee_id} - ${record.emp_name || 'Unknown'}`)
        setDate(record.counselling_date)
        setReason(record.reason || '')
        setRemarks(record.remarks || '')
        setCategory(record.category || 'Good')
        setScore(record.score || (record.category === 'Bad' ? -1 : 1))
        
        // Scroll to top where the form is
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function resetForm() {
        setEditingId(null)
        setSelectedEmpId('')
        setSearchEmpId('')
        setDate(new Date().toISOString().split('T')[0])
        setReason('')
        setRemarks('')
        setCategory('Good')
        setScore(1)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedEmpId || !reason || !date) return

        setSaving(true)
        setSuccessMsg('')
        const supabase = createClient()

        let error = null
        if (editingId) {
            const { error: updateError } = await supabase.from('employee_counselling').update({
                employee_id: selectedEmpId,
                counselling_date: date,
                reason: reason,
                remarks: remarks || null,
                category: category,
                score: score
            }).eq('id', editingId)
            error = updateError
        } else {
            const { error: insertError } = await supabase.from('employee_counselling').insert({
                employee_id: selectedEmpId,
                counselled_by: userId,
                counselling_date: date,
                reason: reason,
                remarks: remarks || null,
                category: category,
                score: score
            })
            error = insertError
        }

        setSaving(false)
        if (!error) {
            setSuccessMsg(`Counselling record ${editingId ? 'updated' : 'saved'} successfully.`)
            resetForm()
            router.refresh()
            setTimeout(() => setSuccessMsg(''), 5000)
        } else {
            alert('Failed to save record: ' + error.message)
        }
    }

    const canEdit = (rec: CounsellingRecord) => {
        if (userRole === 'admin') return true
        if (['hod', 'manager'].includes(userRole) && rec.counselled_by === userId) return true
        return false
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Employee Counselling</h2>

            <div className="grid gap-6 md:grid-cols-3">
                
                {/* FORM COLUMN */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader className={`border-b pb-4 ${editingId ? 'bg-amber-50' : 'bg-slate-50'}`}>
                        <CardTitle className="text-lg flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                {editingId ? <Pencil className="h-5 w-5 text-amber-600" /> : <PlusCircle className="h-5 w-5 text-red-600" />}
                                {editingId ? 'Edit Record' : 'New Record'}
                            </div>
                            {editingId && (
                                <Button variant="ghost" size="sm" onClick={resetForm} className="text-slate-500 hover:bg-slate-200 h-7 px-2">
                                    <X className="h-4 w-4 mr-1" /> Cancel
                                </Button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {successMsg && (
                            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm font-medium rounded-md flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> {successMsg}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Combined Search & Select Combobox */}
                            <div className="space-y-2 relative">
                                <Label className="text-red-700">Search & Select Employee *</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input 
                                        placeholder="Type name or ID to search..." 
                                        className={`pl-9 bg-white ${editingId ? 'border-amber-200 focus:border-amber-500 focus:ring-amber-500' : ''}`}
                                        value={searchEmpId}
                                        onChange={e => {
                                            setSearchEmpId(e.target.value)
                                            setDropdownOpen(true)
                                            setSelectedEmpId('') // Reset selection when typing
                                        }}
                                        onFocus={() => setDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                                        required={!selectedEmpId}
                                    />
                                </div>
                                {dropdownOpen && (
                                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {filteredEmployees.length > 0 ? (
                                            filteredEmployees.map(emp => (
                                                <div 
                                                    key={emp.employee_id} 
                                                    className={`px-3 py-2 cursor-pointer hover:bg-slate-100 text-sm ${selectedEmpId === emp.employee_id ? 'bg-red-50 text-red-900 font-medium' : 'text-slate-700'}`}
                                                    onMouseDown={() => {
                                                        setSelectedEmpId(emp.employee_id)
                                                        setSearchEmpId(`${emp.employee_id} - ${emp.name || 'Unknown'}`)
                                                        setDropdownOpen(false)
                                                    }}
                                                >
                                                    <span className="font-semibold text-slate-900">{emp.employee_id}</span> - {emp.name || 'Unknown'} 
                                                    <span className="text-slate-500 text-xs ml-1">{emp.designation ? `(${emp.designation})` : ''}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-slate-500">No matching employees found.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Date of Counselling *</Label>
                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required max={new Date().toISOString().split('T')[0]} className={editingId ? 'border-amber-200 focus:border-amber-500 focus:ring-amber-500' : ''} />
                            </div>

                            <div className="space-y-2">
                                <Label>Reason for Counselling *</Label>
                                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Signal Violation, Late Arrival" required className={editingId ? 'border-amber-200 focus:border-amber-500 focus:ring-amber-500' : ''} />
                            </div>

                            <div className="space-y-2">
                                <Label>Remarks / Actions Taken</Label>
                                <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Detailed notes..." rows={3} className={editingId ? 'border-amber-200 focus:border-amber-500 focus:ring-amber-500' : ''} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Category *</Label>
                                    <div className={`flex gap-2 p-1 rounded-md ${editingId ? 'bg-amber-100/50' : 'bg-slate-100'}`}>
                                        <button
                                            type="button"
                                            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded ${category === 'Good' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                            onClick={() => {
                                                setCategory('Good');
                                                setScore(1);
                                            }}
                                        >
                                            Good
                                        </button>
                                        <button
                                            type="button"
                                            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded ${category === 'Bad' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                            onClick={() => {
                                                setCategory('Bad');
                                                setScore(-1);
                                            }}
                                        >
                                            Bad
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Score ({category}) *</Label>
                                    <select 
                                        className={`w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${editingId ? 'border-amber-200 focus:border-amber-500 focus:ring-amber-500' : ''}`}
                                        value={score}
                                        onChange={e => setScore(parseInt(e.target.value))}
                                    >
                                        {category === 'Good' ? (
                                            <>
                                                <option value={1}>1</option>
                                                <option value={2}>2</option>
                                                <option value={3}>3</option>
                                                <option value={4}>4</option>
                                                <option value={5}>5</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value={-1}>-1</option>
                                                <option value={-2}>-2</option>
                                                <option value={-3}>-3</option>
                                                <option value={-4}>-4</option>
                                                <option value={-5}>-5</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <Button type="submit" className={`w-full ${editingId ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-red-600 hover:bg-red-700'}`} disabled={saving || !selectedEmpId}>
                                {saving ? 'Saving...' : (editingId ? 'Update Record' : 'Save Record')}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* TABLE COLUMN */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-slate-500" /> Recent Counselling Records
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Score</TableHead>
                                        <TableHead>Counselled By</TableHead>
                                        <TableHead className="w-[60px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialRecords.length > 0 ? (
                                        initialRecords.map(rec => (
                                            <TableRow key={rec.id} className={editingId === rec.id ? "bg-amber-50" : ""}>
                                                <TableCell className="whitespace-nowrap text-sm font-medium">
                                                    {new Date(rec.counselling_date).toLocaleDateString('en-IN')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{rec.emp_name}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{rec.employee_id}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-semibold">{rec.reason}</div>
                                                    {rec.remarks && <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{rec.remarks}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${rec.category === 'Good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {rec.category}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`text-sm font-bold ${rec.score > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {rec.score > 0 ? `+${rec.score}` : rec.score}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600">{rec.counselled_by_name}</TableCell>
                                                <TableCell>
                                                    {canEdit(rec) && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => handleEdit(rec)}
                                                            className={`h-8 w-8 ${editingId === rec.id ? 'text-amber-600 hover:text-amber-700 bg-amber-100' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                            title="Edit Record"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                No counselling records found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    )
}
