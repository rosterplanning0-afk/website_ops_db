'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileText, Plus, CheckCircle, Clock } from 'lucide-react'

// Using the type inferred from our new API structure
interface InstructionWithAssigments {
    id: string
    title: string
    content: string
    priority: string
    is_active: boolean
    created_at: string
    instruction_designation_assignments?: { designation: string }[]
}

interface InstructionListProps {
    instructions: InstructionWithAssigments[]
    canCreate?: boolean
}

export function InstructionList({ instructions, canCreate = false }: InstructionListProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Instructions
                </CardTitle>
                {canCreate && (
                    <Button size="sm" className="bg-red-600 hover:bg-red-700">
                        <Plus className="h-4 w-4 mr-1" /> New Instruction
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {instructions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No instructions found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Assigned Designations</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {instructions.map((inst) => (
                                    <TableRow key={inst.id}>
                                        <TableCell className="font-medium">{inst.title}</TableCell>
                                        <TableCell>{inst.priority || 'Normal'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {inst.instruction_designation_assignments?.map((assign) => (
                                                    <span key={assign.designation} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full">
                                                        {assign.designation}
                                                    </span>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {inst.is_active ? (
                                                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                                    <CheckCircle className="h-3 w-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                                                    <Clock className="h-3 w-3" /> Inactive
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500">
                                            {inst.created_at ? new Date(inst.created_at).toLocaleDateString() : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
