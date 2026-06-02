'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUp, Download, Loader2, CheckCircle2, AlertTriangle, PlayCircle } from 'lucide-react'
import { createCredentials } from './actions'

const REQUIRED_HEADERS = [
    'Employee ID',
    'Name',
    'Email',
    'Password',
    'Role',
    'Department',
    'Designation',
    'Gender',
    'Status',
    'Date Joined',
    'Manager ID'
]

export function BulkCreateDialog() {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [error, setError] = useState('')
    const [parsedData, setParsedData] = useState<any[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [results, setResults] = useState<{ success: number; failed: number; logs: string[] } | null>(null)

    async function handleDownloadTemplate() {
        const ws = XLSX.utils.aoa_to_sheet([REQUIRED_HEADERS])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Template')

        try {
            const { createClient } = await import('@/utils/supabase/client')
            const supabase = createClient()
            const { data: managers } = await supabase
                .from('employees')
                .select('employee_id, name, department')
                .in('role', ['manager', 'hod'])
            
            const ROLES = ['admin', 'cxo', 'hod', 'manager', 'roster_planners', 'employee']
            const DEPARTMENTS = ['Train Operations', 'Station Operations', 'OCC', 'Maintenance', 'Management', 'HR', 'Other']
            const GENDERS = ['Male', 'Female', 'Other']
            const STATUSES = ['Active', 'Inactive', 'Notice Period']
            
            // Need to statically provide DEPT_CREW_MAPPING here or import it
            const { DEPT_CREW_MAPPING } = await import('@/lib/rbac')
            const allDesignations = Object.values(DEPT_CREW_MAPPING).flat()
            
            const maxRows = Math.max(
                ROLES.length,
                DEPARTMENTS.length,
                allDesignations.length,
                GENDERS.length,
                STATUSES.length,
                managers?.length || 0
            )

            const refData: any[][] = [['Role', 'Department', 'Designation', 'Gender', 'Status', 'Manager ID', 'Manager Name', 'Manager Dept']]
            
            for (let i = 0; i < maxRows; i++) {
                refData.push([
                    ROLES[i] || '',
                    DEPARTMENTS[i] || '',
                    allDesignations[i] || '',
                    GENDERS[i] || '',
                    STATUSES[i] || '',
                    managers?.[i]?.employee_id || '',
                    managers?.[i]?.name || '',
                    managers?.[i]?.department || ''
                ])
            }

            const wsRef = XLSX.utils.aoa_to_sheet(refData)
            XLSX.utils.book_append_sheet(wb, wsRef, 'Reference Data')
        } catch (err) {
            console.error("Failed to fetch reference data for template", err)
        }

        XLSX.writeFile(wb, 'Bulk_Credentials_Template.xlsx')
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        setError('')
        setParsedData([])
        setResults(null)
        const selected = e.target.files?.[0]
        if (!selected) {
            setFile(null)
            return
        }
        setFile(selected)

        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                
                // Get data as an array of arrays to check headers
                const dataAoA = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 })
                if (dataAoA.length === 0) {
                    setError('The uploaded file is empty.')
                    return
                }

                const headers = dataAoA[0] as string[]
                
                // Validate headers
                const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h))
                if (missingHeaders.length > 0) {
                    setError(`Invalid template. Missing headers: ${missingHeaders.join(', ')}`)
                    return
                }

                // Parse into objects (using raw: false to get formatted string for dates/numbers if possible)
                const data = XLSX.utils.sheet_to_json(ws, { raw: false })
                if (data.length === 0) {
                    setError('No data rows found in the file.')
                    return
                }

                setParsedData(data)
            } catch (err: any) {
                setError('Failed to parse Excel file: ' + err.message)
            }
        }
        reader.readAsBinaryString(selected)
    }

    async function handleStartProcessing() {
        if (parsedData.length === 0) return
        
        setIsProcessing(true)
        setResults({ success: 0, failed: 0, logs: [] })
        let successCount = 0
        let failedCount = 0
        const logs: string[] = []

        for (let i = 0; i < parsedData.length; i++) {
            const row = parsedData[i]
            const empId = row['Employee ID'] || `Row ${i+2}`
            try {
                // Ensure required fields are strings/formatted correctly
                if (!row['Employee ID'] || !row['Name'] || !row['Email'] || !row['Role'] || !row['Department'] || !row['Designation'] || !row['Gender'] || !row['Status'] || !row['Date Joined']) {
                    throw new Error('Missing one or more required fields.')
                }

                // Date parsing can be tricky from excel if it's not raw: false. Let's assume it's a valid string.
                let dateStr = row['Date Joined']
                // Sometimes xlsx raw:false gives MM/DD/YYYY, let's just pass it or try to convert.
                // We'll pass it directly as string, assuming the user formats it well, or it can be handled by DB.

                await createCredentials({
                    employeeId: String(row['Employee ID']).trim(),
                    name: String(row['Name']).trim(),
                    email: String(row['Email']).trim(),
                    password: row['Password'] ? String(row['Password']) : undefined,
                    role: String(row['Role']).trim().toLowerCase(),
                    department: String(row['Department']).trim(),
                    designation: String(row['Designation']).trim(),
                    gender: String(row['Gender']).trim(),
                    status: String(row['Status']).trim(),
                    dateJoined: String(dateStr).trim(),
                    managerId: row['Manager ID'] ? String(row['Manager ID']).trim() : undefined,
                })
                successCount++
                logs.push(`✅ ${empId}: Success`)
            } catch (err: any) {
                failedCount++
                logs.push(`❌ ${empId}: ${err.message}`)
            }

            // Update state periodically so UI doesn't freeze completely
            setResults({ success: successCount, failed: failedCount, logs: [...logs] })
            
            // tiny delay to let UI render
            await new Promise(r => setTimeout(r, 50))
        }

        setIsProcessing(false)
    }

    function reset() {
        setFile(null)
        setError('')
        setParsedData([])
        setResults(null)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val && isProcessing) return // prevent closing while processing
            setOpen(val)
            if (!val) reset()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 border-slate-300">
                    <FileUp className="h-4 w-4" /> Bulk Creation
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Bulk Create Credentials</DialogTitle>
                    <DialogDescription>
                        Download the template, fill in the details, and upload to create multiple accounts at once.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4 overflow-y-auto">
                    {/* Step 1: Download */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">1. Download Template</h4>
                        <Button variant="secondary" onClick={handleDownloadTemplate} disabled={isProcessing} className="w-full sm:w-auto">
                            <Download className="mr-2 h-4 w-4" /> Download Excel Template
                        </Button>
                    </div>

                    {/* Step 2: Upload */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">2. Upload Filled Template</h4>
                        <Input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={handleFileChange} 
                            disabled={isProcessing}
                        />
                        {error && (
                            <div className="p-3 mt-2 bg-red-50 text-red-700 rounded-md text-sm flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        {!error && parsedData.length > 0 && !results && (
                            <div className="p-3 mt-2 bg-green-50 text-green-700 rounded-md text-sm flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>Template matches! Found {parsedData.length} records. Ready to process.</span>
                            </div>
                        )}
                    </div>

                    {/* Step 3: Process */}
                    {parsedData.length > 0 && (
                        <div className="space-y-4 pt-4 border-t">
                            {!results && (
                                <Button 
                                    className="w-full bg-red-600 hover:bg-red-700" 
                                    onClick={handleStartProcessing}
                                    disabled={isProcessing}
                                >
                                    <PlayCircle className="mr-2 h-4 w-4" /> Start Creation
                                </Button>
                            )}

                            {isProcessing && (
                                <div className="flex items-center justify-center py-4 text-slate-500">
                                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                    <span>Processing records... Please do not close.</span>
                                </div>
                            )}

                            {results && (
                                <div className="space-y-2">
                                    <div className="flex gap-4 text-sm font-medium">
                                        <span className="text-green-600">Successful: {results.success}</span>
                                        <span className="text-red-600">Failed: {results.failed}</span>
                                        <span>Total: {parsedData.length}</span>
                                    </div>
                                    <div className="bg-slate-950 text-slate-300 p-3 rounded-md h-48 overflow-y-auto font-mono text-xs space-y-1">
                                        {results.logs.map((log, i) => (
                                            <div key={i}>{log}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
