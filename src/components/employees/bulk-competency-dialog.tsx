'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileUp, Download, AlertCircle, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface BulkCompetencyDialogProps {
    onSuccess: () => void
}

export function BulkCompetencyDialog({ onSuccess }: BulkCompetencyDialogProps) {
    const [open, setOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const TEMPLATE_COLUMNS = ['Employee ID', 'Department', 'Designation', 'Train Type', 'Valid From', 'Valid Till']

    const downloadTemplate = () => {
        const wsData = [
            TEMPLATE_COLUMNS,
            ['EMP001', 'Train Operations', 'Train Operator', 'RRTS', '2024-01-01', '2025-01-01'],
            ['EMP002', 'OCC', 'Traffic Controller', '', '2024-02-15', '']
        ]
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Competencies')
        XLSX.writeFile(wb, 'Competency_Import_Template.xlsx')
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setError(null)
        setResult(null)

        const reader = new FileReader()
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer)
                const workbook = XLSX.read(data, { type: 'array' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                
                // Validate headers
                const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
                const headers: any[] = []
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })]
                    headers.push(cell ? cell.v : undefined)
                }

                const isHeaderValid = TEMPLATE_COLUMNS.every((h, i) => headers[i] === h)
                if (!isHeaderValid) {
                    setError(`Invalid template format. Headers must be: ${TEMPLATE_COLUMNS.join(', ')}`)
                    setIsUploading(false)
                    return
                }

                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)
                if (jsonData.length === 0) {
                    setError('The uploaded file is empty.')
                    setIsUploading(false)
                    return
                }

                const formattedData = jsonData.map((row: any) => ({
                    employee_id: row['Employee ID'],
                    department: row['Department'],
                    designation: row['Designation'],
                    train_type: row['Train Type'],
                    valid_from: typeof row['Valid From'] === 'number' 
                        ? new Date((row['Valid From'] - 25569) * 86400 * 1000).toISOString().split('T')[0]
                        : row['Valid From'],
                    valid_till: typeof row['Valid Till'] === 'number'
                        ? new Date((row['Valid Till'] - 25569) * 86400 * 1000).toISOString().split('T')[0]
                        : row['Valid Till']
                }))

                const res = await fetch('/api/competencies/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ competencies: formattedData })
                })

                const json = await res.json()
                if (res.ok) {
                    setResult(json)
                    if (json.summary.inserted > 0) {
                        onSuccess()
                    }
                } else {
                    setError(json.error || 'Failed to process import.')
                }
            } catch (err: any) {
                console.error('File processing error:', err)
                setError('Error processing Excel file. Please ensure dates are in YYYY-MM-DD format.')
            } finally {
                setIsUploading(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
        }

        reader.onerror = () => {
            setError('Failed to read file.')
            setIsUploading(false)
        }

        reader.readAsArrayBuffer(file)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val)
            if (!val) {
                setResult(null)
                setError(null)
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all shadow-sm">
                    <FileUp className="h-4 w-4" /> Bulk Import Competencies
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-slate-800">Bulk Import Competencies</DialogTitle>
                    <DialogDescription>
                        Import multiple competency records at once using an Excel file.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4 flex-1 overflow-hidden flex flex-col">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-slate-50 flex flex-col items-center justify-center gap-3 text-center transition-all hover:bg-slate-100/80">
                            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm border">
                                <Download className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-800">1. Download Template</p>
                                <p className="text-xs text-slate-500">Get the correct format for your data.</p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={downloadTemplate} className="w-full bg-white hover:bg-blue-50 border">
                                Download Excel
                            </Button>
                        </div>

                        <div className="p-4 border rounded-lg bg-red-50/50 flex flex-col items-center justify-center gap-3 text-center transition-all hover:bg-red-50">
                            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm border">
                                <FileUp className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-800">2. Upload File</p>
                                <p className="text-xs text-slate-500">Upload your updated template here.</p>
                            </div>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <Button 
                                className="w-full bg-red-600 hover:bg-red-700 text-white" 
                                size="sm" 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Choose File'
                                )}
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold">Import Error</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4 flex flex-col overflow-hidden">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-slate-100 rounded-lg text-center border">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Rows</p>
                                    <p className="text-xl font-bold text-slate-800">{result.summary.total}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-lg text-center border border-green-100">
                                    <p className="text-xs text-green-600 font-medium uppercase tracking-wider">Success</p>
                                    <p className="text-xl font-bold text-green-700">{result.summary.inserted}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-lg text-center border border-red-100">
                                    <p className="text-xs text-red-600 font-medium uppercase tracking-wider">Failed</p>
                                    <p className="text-xl font-bold text-red-700">{result.summary.failed}</p>
                                </div>
                            </div>

                            {result.summary.failed > 0 && (
                                <div className="space-y-2 flex flex-col overflow-hidden">
                                    <div className="flex items-center gap-2 text-red-700">
                                        <XCircle className="h-4 w-4" />
                                        <p className="text-sm font-semibold">Failed Rows Details</p>
                                    </div>
                                    <div className="h-[200px] border rounded-md overflow-auto bg-white">
                                        <Table>
                                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead className="w-[80px] bg-slate-50">Row #</TableHead>
                                                    <TableHead className="w-[120px] bg-slate-50">Employee ID</TableHead>
                                                    <TableHead className="bg-slate-50">Error Reason</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {result.failed_records.map((rec: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-mono text-xs">{rec.row}</TableCell>
                                                        <TableCell className="font-semibold text-xs">{rec.employee_id}</TableCell>
                                                        <TableCell className="text-xs text-red-600">{rec.reason}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {result.summary.inserted > 0 && result.summary.failed === 0 && (
                                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                                    <CheckCircle2 className="h-8 w-8 shrink-0" />
                                    <div>
                                        <p className="font-bold">Perfect Import!</p>
                                        <p className="text-sm">All {result.summary.inserted} competency records were successfully added to the database.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!result && !error && !isUploading && (
                        <div className="flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 items-start">
                            <Info className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="text-xs space-y-1">
                                <p className="font-semibold">Important Notes:</p>
                                <ul className="list-disc list-inside space-y-1 text-blue-700">
                                    <li>Employee ID must match exactly with the Employee Master.</li>
                                    <li>Department and Designation must match the official list (case-insensitive).</li>
                                    <li>Dates should be in <span className="font-mono">YYYY-MM-DD</span> format.</li>
                                    <li>Valid Till is optional.</li>
                                    <li>Duplicate records for the same date will be allowed, so check your data first.</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t mt-auto">
                    <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
