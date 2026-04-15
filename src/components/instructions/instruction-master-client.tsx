'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileText, Plus, CheckCircle, Clock, Save, X } from 'lucide-react'

interface Instruction {
    id: string
    title: string
    content: string
    priority: string
    is_active: boolean
    created_at: string
    created_by: string | null
    valid_until: string | null
    instruction_designation_assignments?: { designation: string }[]
}



export default function InstructionMasterClient({
    initialInstructions,
    canCreate,
    availableDesignations = ['All Staff'],
}: {
    initialInstructions: Instruction[]
    canCreate: boolean
    availableDesignations?: string[]
}) {
    const [instructions, setInstructions] = useState<Instruction[]>(initialInstructions)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form state
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [priority, setPriority] = useState('Normal')
    const [validUntil, setValidUntil] = useState('')
    const [selectedDesignations, setSelectedDesignations] = useState<string[]>([])

    const [errorMsg, setErrorMsg] = useState('')

    function toggleDesignation(d: string) {
        setSelectedDesignations(prev =>
            prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
        )
    }

    async function handleSave() {
        if (!title.trim() || !content.trim() || selectedDesignations.length === 0) return
        setSaving(true)
        setErrorMsg('')

        try {
            const res = await fetch('/api/instructions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    content,
                    priority,
                    valid_until: validUntil || null,
                    assigned_designations: selectedDesignations,
                    is_active: true,
                }),
            })

            const json = await res.json()
            if (res.ok) {
                setInstructions(prev => [{ ...json.data, instruction_designation_assignments: selectedDesignations.map(d => ({ designation: d })) }, ...prev])
                resetForm()
                setDialogOpen(false)
            } else {
                setErrorMsg(json.error || 'Failed to save instruction. Please try again.')
            }
        } catch (err) {
            console.error('Failed to save instruction', err)
            setErrorMsg('Network error. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    function resetForm() {
        setTitle('')
        setContent('')
        setPriority('Normal')
        setValidUntil('')
        setSelectedDesignations([])
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Instruction Master</h2>
                {canCreate && (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-red-600 hover:bg-red-700"><Plus className="h-4 w-4 mr-1" /> New Instruction</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Add New Instruction</DialogTitle>
                                <DialogDescription>Fill in all required fields to publish a new instruction.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="inst-title">Instruction Title *</Label>
                                        <Input id="inst-title" placeholder="Enter title" value={title} onChange={e => setTitle(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="inst-priority">Priority</Label>
                                        <Select value={priority} onValueChange={setPriority}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Normal">Normal</SelectItem>
                                                <SelectItem value="High">High</SelectItem>
                                                <SelectItem value="Urgent">Urgent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="inst-content">Instruction Details *</Label>
                                    <textarea
                                        id="inst-content"
                                        rows={4}
                                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        placeholder="Enter full instruction details..."
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="inst-valid">Valid Until (optional)</Label>
                                    <Input id="inst-valid" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Applicable To *</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {availableDesignations.map(d => (
                                            <button
                                                key={d} type="button"
                                                onClick={() => toggleDesignation(d)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selectedDesignations.includes(d)
                                                    ? 'bg-red-600 text-white border-red-600'
                                                    : 'bg-white text-slate-600 border-slate-300 hover:border-red-400'
                                                    }`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    {errorMsg && (
                                        <p className="text-sm text-red-600 mr-auto flex items-center">{errorMsg}</p>
                                    )}
                                    <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false) }}>
                                        <X className="h-4 w-4 mr-1" /> Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving || !title.trim() || !content.trim() || selectedDesignations.length === 0}
                                        className="bg-red-600 hover:bg-red-700"
                                    >
                                        <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Instruction'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Recent Instructions Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> All Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                    {instructions.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-8">No instructions found.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Applicable To</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {instructions.map(inst => (
                                        <TableRow key={inst.id}>
                                            <TableCell className="font-medium max-w-[250px] truncate">{inst.title}</TableCell>
                                            <TableCell>
                                                <span className={`text-xs font-semibold ${inst.priority === 'Urgent' ? 'text-red-600' : inst.priority === 'High' ? 'text-amber-600' : 'text-slate-500'}`}>
                                                    {inst.priority}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {inst.instruction_designation_assignments?.map(a => (
                                                        <span key={a.designation} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full">{a.designation}</span>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {inst.is_active ? (
                                                    <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="h-3 w-3" /> Active</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-slate-400 text-xs font-medium"><Clock className="h-3 w-3" /> Inactive</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500">{inst.created_at ? new Date(inst.created_at).toLocaleDateString() : '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
