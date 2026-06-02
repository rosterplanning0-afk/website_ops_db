'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClipboardCheck, CloudUpload, Save, CheckCircle2, XCircle, CircleDashed, TrendingUp } from 'lucide-react'

const PART_DRIVING = [
    'Activation & Deactivation of Cab of train Mainline/Depot (Verifying safety switch status)',
    'Platform Entry Speed Followed',
    'Proper Response to the advisory/Target speed',
    'Verifying train docking/Door authorisation/Door Opening',
    'Verifying passenger Boarding /Deboarding, Door Closing & PT exit',
    'Starting /Stopping of train (Jerk free)',
    'Habit of checking of faults when pop up',
    'Efficient trouble shooting of train defects',
    'correct & precise reporting of faults to OCC/DCC',
    'Observing Neural section Movement'
]

const PART_SAFETY = [
    'Operating Procedure in degraded mode',
    'Knowledge of latest Circular, SOP',
    'Knowledge of different PSR/TSR',
    'Knowledge of different Emergency stair case',
    'Not using Mobile phone during driving',
    'verifies safety switch positions and confirm same on radio',
    'Not carrying any unauthorized person in cab',
    'Calling Out aspect of line side signal',
    'Attentive during platform entry & exit',
    'Vigilant towards track, OHE & Surroundings'
]

const PART_COMMUNICATION = [
    'Proper information played for passengers',
    'Proper communication with passenger in case emergency alarm',
    'Proper acknowledgement of message from OCC/DCC',
    'Standard communication during movement',
    'Standard communication during Depot Entry / Exit'
]

const PART_GENERAL = [
    'Smartly Uniform',
    'Competency Card',
    'Kit Bag'
]

type AssessmentStatus = 'OK' | 'NOT OK' | null

interface ScoreRow {
    part: string
    section: string
    item_no: number
    item_text: string
    max_marks: number
    marks_awarded: number
}

interface NewInspectionClientProps {
    isAuthorized: boolean
    operators: any[]
    inspectorId: string
    inspectorName: string
    inspectorRole: string
}

export function NewInspectionClient({ isAuthorized, operators, inspectorId, inspectorName, inspectorRole }: NewInspectionClientProps) {
    const [employeeId, setEmployeeId] = useState('')
    const [employeeName, setEmployeeName] = useState('')
    const [employeeDesig, setEmployeeDesig] = useState('')
    const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0])
    
    // New fields
    const [location, setLocation] = useState('')
    const [trainSet, setTrainSet] = useState('')

    const [pastInspections, setPastInspections] = useState<any[]>([])
    const [loadingPast, setLoadingPast] = useState(false)

    const [lookupDone, setLookupDone] = useState(false)
    const [saving, setSaving] = useState(false)
    const [observations, setObservations] = useState('')
    const [defects, setDefects] = useState('')
    const [corrective, setCorrective] = useState('')

    useEffect(() => {
        if (!employeeId) {
            setPastInspections([])
            return
        }
        async function fetchPast() {
            setLoadingPast(true)
            const supabase = createClient()
            const { data } = await supabase
                .from('footplate_inspections')
                .select('*, inspection_scores(*)')
                .eq('employee_id', employeeId)
                .order('inspection_date', { ascending: false })
                .limit(3)
            if (data) {
                setPastInspections(data)
            } else {
                setPastInspections([])
            }
            setLoadingPast(false)
        }
        fetchPast()
    }, [employeeId])

    // Scores
    const [scoresDriving, setScoresDriving] = useState<AssessmentStatus[]>(new Array(PART_DRIVING.length).fill(null))
    const [scoresSafety, setScoresSafety] = useState<AssessmentStatus[]>(new Array(PART_SAFETY.length).fill(null))
    const [scoresComm, setScoresComm] = useState<AssessmentStatus[]>(new Array(PART_COMMUNICATION.length).fill(null))
    const [scoresGeneral, setScoresGeneral] = useState<AssessmentStatus[]>(new Array(PART_GENERAL.length).fill(null))

    // Remarks
    const [remarksDriving, setRemarksDriving] = useState<string[]>(new Array(PART_DRIVING.length).fill(''))
    const [remarksSafety, setRemarksSafety] = useState<string[]>(new Array(PART_SAFETY.length).fill(''))
    const [remarksComm, setRemarksComm] = useState<string[]>(new Array(PART_COMMUNICATION.length).fill(''))
    const [remarksGeneral, setRemarksGeneral] = useState<string[]>(new Array(PART_GENERAL.length).fill(''))

    const updateScore = (
        setArr: React.Dispatch<React.SetStateAction<AssessmentStatus[]>>, 
        idx: number, 
        val: AssessmentStatus
    ) => {
        setArr(prev => { 
            const next = [...prev]; 
            next[idx] = val; 
            return next 
        })
    }

    const updateRemark = (
        setRemarksArr: React.Dispatch<React.SetStateAction<string[]>>,
        idx: number,
        val: string
    ) => {
        setRemarksArr(prev => {
            const next = [...prev];
            next[idx] = val;
            return next;
        })
    }

    // Score Calculations
    const calcSectionScore = (scores: AssessmentStatus[], maxMarks: number) => {
        const selected = scores.filter(s => s !== null).length
        if (selected === 0) return 0
        const okCount = scores.filter(s => s === 'OK').length
        return (okCount / selected) * maxMarks
    }

    const drivingScore = calcSectionScore(scoresDriving, 3)
    const safetyScore = calcSectionScore(scoresSafety, 3)
    const commScore = calcSectionScore(scoresComm, 2)
    const generalScore = calcSectionScore(scoresGeneral, 2)
    const totalScore = drivingScore + safetyScore + commScore + generalScore

    const validateForm = () => {
        const drivingCount = scoresDriving.filter(s => s !== null).length
        const safetyCount = scoresSafety.filter(s => s !== null).length
        const commCount = scoresComm.filter(s => s !== null).length
        const generalCount = scoresGeneral.filter(s => s !== null).length

        if (drivingCount < 3) return `Please select a minimum of 3 points for Driving Skill. Currently selected: ${drivingCount}`
        if (safetyCount < 3) return `Please select a minimum of 3 points for Safety. Currently selected: ${safetyCount}`
        if (commCount < 2) return `Please select a minimum of 2 points for Communication. Currently selected: ${commCount}`
        if (generalCount < 2) return `Please select a minimum of 2 points for General. Currently selected: ${generalCount}`
        if (!location.trim()) return `Please enter the Location of Inspection.`
        if (!trainSet.trim()) return `Please enter the Train set.`

        return null
    }

    async function submitInspection() {
        if (!employeeId || !lookupDone) return

        const validationError = validateForm()
        if (validationError) {
            alert(validationError)
            return
        }

        setSaving(true)
        const supabase = createClient()

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
        const allScores: ScoreRow[] = []

        const addScores = (
            partName: string, 
            sectionName: string, 
            items: string[], 
            scores: AssessmentStatus[],
            remarks: string[]
        ) => {
            scores.forEach((status, i) => {
                if (status !== null) {
                    allScores.push({
                        part: partName,
                        section: sectionName,
                        item_no: i + 1,
                        item_text: items[i],
                        max_marks: 1,
                        marks_awarded: status === 'OK' ? 1 : 0,
                        remark: status === 'NOT OK' ? (remarks[i] || null) : null
                    } as any)
                }
            })
        }

        addScores('A', 'Driving Skill', PART_DRIVING, scoresDriving, remarksDriving)
        addScores('B', 'Safety', PART_SAFETY, scoresSafety, remarksSafety)
        addScores('C', 'Communication', PART_COMMUNICATION, scoresComm, remarksComm)
        addScores('D', 'General', PART_GENERAL, scoresGeneral, remarksGeneral)

        // Embed location and train set into observations to avoid schema changes
        const combinedObservations = `Location: ${location}\nTrain Set: ${trainSet}\n\n${observations}`

        // Insert inspection
        const { data: inspection, error } = await supabase.from('footplate_inspections').insert({
            employee_id: employeeId.trim(),
            inspection_date: inspectionDate,
            part_a_total: Number(drivingScore.toFixed(2)),
            part_b_total: Number(safetyScore.toFixed(2)),
            part_c_total: Number(commScore.toFixed(2)),
            part_d_total: Number(generalScore.toFixed(2)),
            overall_total: Number(totalScore.toFixed(2)),
            status: 'Submitted',
            observations: combinedObservations,
            defects_identified: defects,
            corrective_actions: corrective,
            inspected_by_user_id: inspectorId,
            inspected_by_name: inspectorName,
            inspected_by_role: inspectorRole,
            device_info: deviceInfo,
            ip_address: ipAddress,
        } as any).select().single()

        if (inspection) {
            // Insert individual scores
            await supabase.from('inspection_scores').insert(
                allScores.map(s => ({ ...s, inspection_id: inspection.id }))
            )
            alert('Inspection submitted successfully!')
            // Reset form could go here
            window.location.reload()
        } else {
            alert('Error: ' + (error?.message || 'Unknown error'))
        }
        setSaving(false)
    }

    function renderSection(
        title: string, 
        description: string, 
        items: string[], 
        scores: AssessmentStatus[], 
        setScores: React.Dispatch<React.SetStateAction<AssessmentStatus[]>>,
        remarks: string[],
        setRemarks: React.Dispatch<React.SetStateAction<string[]>>
    ) {
        const assessedCount = scores.filter(s => s !== null).length;
        
        return (
            <div className="bg-white border rounded-lg overflow-hidden mb-6 shadow-sm">
                <div className="bg-slate-50 px-5 py-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                        <p className="text-sm text-slate-500">{description}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${assessedCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
                        {assessedCount} Assessed
                    </div>
                </div>
                <div className="divide-y">
                    {items.map((text, i) => (
                        <div key={i} className={`px-5 py-4 flex flex-col gap-3 transition-colors ${scores[i] !== null ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
                                <div className="flex gap-3 max-w-2xl">
                                    <span className="font-mono text-sm text-slate-400 mt-0.5">{i + 1}.</span>
                                    <span className="text-sm text-slate-700 leading-relaxed">{text}</span>
                                </div>
                                <div className="flex items-center gap-2 self-end md:self-auto shrink-0 bg-white p-1 rounded-md border shadow-sm">
                                    <Button 
                                        size="sm" 
                                        variant={scores[i] === 'OK' ? 'default' : 'ghost'} 
                                        className={`h-8 px-3 ${scores[i] === 'OK' ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-slate-500 hover:text-green-600'}`}
                                        onClick={() => {
                                            updateScore(setScores, i, scores[i] === 'OK' ? null : 'OK')
                                            if (scores[i] !== 'OK') {
                                                updateRemark(setRemarks, i, '')
                                            }
                                        }}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> OK
                                    </Button>
                                    <div className="w-px h-4 bg-slate-200"></div>
                                    <Button 
                                        size="sm" 
                                        variant={scores[i] === 'NOT OK' ? 'destructive' : 'ghost'} 
                                        className={`h-8 px-3 ${scores[i] === 'NOT OK' ? '' : 'text-slate-500 hover:text-red-600'}`}
                                        onClick={() => updateScore(setScores, i, scores[i] === 'NOT OK' ? null : 'NOT OK')}
                                    >
                                        <XCircle className="w-4 h-4 mr-1.5" /> NOT OK
                                    </Button>
                                </div>
                            </div>
                            {scores[i] === 'NOT OK' && (
                                <div className="pl-6 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <Label htmlFor={`remark-${title}-${i}`} className="text-xs font-semibold text-red-600 shrink-0">Remark (Optional)</Label>
                                        <Input
                                            id={`remark-${title}-${i}`}
                                            placeholder="Enter issue details..."
                                            value={remarks[i] || ''}
                                            onChange={(e) => updateRemark(setRemarks, i, e.target.value)}
                                            className="h-8 text-sm bg-white border-slate-200 focus-visible:ring-red-500 max-w-xl"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white border rounded-lg shadow-sm max-w-xl mx-auto my-12">
                <XCircle className="h-16 w-16 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                    You do not have permission to access the New Inspection Form. Only Admins, HODs, Managers, and designated Line Inspectors can view or submit inspections.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Footplate Inspection 0.1</h2>
                    <p className="text-slate-500 mt-1">New Train Operations Inspection Format</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4 sm:gap-6 shadow-sm shrink-0 w-full lg:w-auto">
                    <div className="text-center min-w-[60px]">
                        <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Driving</div>
                        <div className="text-lg font-bold text-slate-800">{drivingScore.toFixed(2)}/3</div>
                    </div>
                    <div className="w-px bg-slate-200 hidden sm:block"></div>
                    <div className="text-center min-w-[60px]">
                        <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Safety</div>
                        <div className="text-lg font-bold text-slate-800">{safetyScore.toFixed(2)}/3</div>
                    </div>
                    <div className="w-px bg-slate-200 hidden sm:block"></div>
                    <div className="text-center min-w-[60px]">
                        <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Comm</div>
                        <div className="text-lg font-bold text-slate-800">{commScore.toFixed(2)}/2</div>
                    </div>
                    <div className="w-px bg-slate-200 hidden sm:block"></div>
                    <div className="text-center min-w-[60px]">
                        <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">General</div>
                        <div className="text-lg font-bold text-slate-800">{generalScore.toFixed(2)}/2</div>
                    </div>
                    <div className="w-px bg-slate-200 hidden sm:block"></div>
                    <div className="text-center min-w-[60px]">
                        <div className="text-xs text-blue-600 uppercase font-bold tracking-wider">Total</div>
                        <div className="text-lg font-extrabold text-blue-600">{totalScore.toFixed(2)}/10</div>
                    </div>
                </div>
            </div>

            {/* Employee Lookup & Basics */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ClipboardCheck className="h-5 w-5 text-blue-600" /> 
                        Inspection Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-semibold">Train Operator *</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                                value={employeeId}
                                onChange={(e) => {
                                    const op = operators.find(o => o.employee_id === e.target.value)
                                    if (op) {
                                        setEmployeeId(op.employee_id)
                                        setEmployeeName(op.name)
                                        setEmployeeDesig(op.designation || '')
                                        setLookupDone(true)
                                    } else {
                                        setEmployeeId('')
                                        setEmployeeName('')
                                        setEmployeeDesig('')
                                        setLookupDone(false)
                                    }
                                }}
                            >
                                <option value="">Select an operator...</option>
                                {operators.map(op => (
                                    <option key={op.employee_id} value={op.employee_id}>
                                        {op.name} ({op.employee_id})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-semibold">Employee Name</Label>
                            <Input value={employeeName} disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-semibold">Location of Inspection *</Label>
                            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mainline / Depot" className="bg-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-semibold">Train Set *</Label>
                            <Input value={trainSet} onChange={e => setTrainSet(e.target.value)} placeholder="e.g. TS-01" className="bg-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-semibold">Designation</Label>
                            <Input value={employeeDesig} disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-semibold">Inspection Date *</Label>
                            <Input type="date" value={inspectionDate} onChange={e => setInspectionDate(e.target.value)} className="bg-white" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Past Inspection Insights */}
            {employeeId && lookupDone && (
                <Card className="border-slate-200 shadow-sm bg-slate-50/30">
                    <CardHeader className="bg-blue-50/40 border-b pb-3">
                        <CardTitle className="flex items-center gap-2 text-base text-blue-800 font-bold">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            Recent Inspection Insights (Last 3 Inspections)
                        </CardTitle>
                        <CardDescription>
                            Review past scores and issues identified to focus your current assessment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {loadingPast ? (
                            <div className="flex items-center justify-center py-6 text-sm text-slate-500 gap-2">
                                <CircleDashed className="h-4 w-4 animate-spin text-blue-600" />
                                Loading historical data...
                            </div>
                        ) : pastInspections.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-6">
                                No previous footplate inspections found for this operator.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {pastInspections.map((insp) => {
                                    const notOkItems = insp.inspection_scores?.filter((item: any) => item.marks_awarded === 0) || []
                                    return (
                                        <div key={insp.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start border-b pb-2 mb-2">
                                                    <span className="font-semibold text-sm text-slate-800">
                                                        {new Date(insp.inspection_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                        insp.overall_total < 5 ? 'bg-red-100 text-red-700' :
                                                        insp.overall_total < 8 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        Score: {(insp.overall_total ?? 0).toFixed(2)}/10
                                                    </span>
                                                </div>
                                                <div className="space-y-1.5 text-xs text-slate-600">
                                                    <div className="flex justify-between">
                                                        <span>Driving Skill:</span>
                                                        <span className="font-medium text-slate-800">{(insp.part_a_total ?? 0).toFixed(2)}/3</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Safety:</span>
                                                        <span className="font-medium text-slate-800">{(insp.part_b_total ?? 0).toFixed(2)}/3</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Communication:</span>
                                                        <span className="font-medium text-slate-800">{(insp.part_c_total ?? 0).toFixed(2)}/2</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>General:</span>
                                                        <span className="font-medium text-slate-800">{(insp.part_d_total ?? 0).toFixed(2)}/2</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1">
                                                        Inspected by: {insp.inspected_by_name || '—'}
                                                    </div>
                                                </div>

                                                {/* NOT OK Items & Remarks */}
                                                {notOkItems.length > 0 ? (
                                                    <div className="mt-3 pt-3 border-t">
                                                        <div className="text-xs font-bold text-red-600 mb-1.5 flex items-center gap-1">
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            {notOkItems.length} Issue{notOkItems.length > 1 ? 's' : ''} Identified:
                                                        </div>
                                                        <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                                                            {notOkItems.map((item: any, i: number) => (
                                                                <div key={i} className="bg-red-50/50 border border-red-100 rounded p-1.5 text-[11px] leading-snug">
                                                                    <p className="font-medium text-slate-800">{item.item_text}</p>
                                                                    {item.remark && (
                                                                        <p className="text-red-700 mt-0.5 italic">
                                                                            Remark: {item.remark}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-3 pt-3 border-t text-[11px] text-green-600 font-medium flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                                        All selected items were OK.
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Expand details for general text fields */}
                                            {(insp.defects_identified || insp.corrective_actions) && (
                                                <div className="mt-2 pt-2 border-t text-[10px] text-slate-500 space-y-1">
                                                    {insp.defects_identified && (
                                                        <p className="truncate"><span className="font-semibold">Defect:</span> {insp.defects_identified}</p>
                                                    )}
                                                    {insp.corrective_actions && (
                                                        <p className="truncate"><span className="font-semibold">Action:</span> {insp.corrective_actions}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Inspection Sections */}
            <div className="mt-8 space-y-8">
                {renderSection(
                    'Driving Skill', 
                    'Select a minimum of 3 inspection points from the 10 available.', 
                    PART_DRIVING, 
                    scoresDriving, 
                    setScoresDriving,
                    remarksDriving,
                    setRemarksDriving
                )}
                
                {renderSection(
                    'Safety', 
                    'Select a minimum of 3 inspection points from the 10 available.', 
                    PART_SAFETY, 
                    scoresSafety, 
                    setScoresSafety,
                    remarksSafety,
                    setRemarksSafety
                )}
                
                {renderSection(
                    'Communication', 
                    'Select a minimum of 2 inspection points from the 5 available.', 
                    PART_COMMUNICATION, 
                    scoresComm, 
                    setScoresComm,
                    remarksComm,
                    setRemarksComm
                )}
                
                {renderSection(
                    'General', 
                    'Select a minimum of 2 inspection points from the 3 available.', 
                    PART_GENERAL, 
                    scoresGeneral, 
                    setScoresGeneral,
                    remarksGeneral,
                    setRemarksGeneral
                )}
            </div>

            {/* Observations */}
            <Card className="border-slate-200 shadow-sm mt-8">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-lg">Observations & Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label className="text-slate-700 font-semibold">General Observations</Label>
                            <textarea 
                                rows={4} 
                                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none" 
                                placeholder="Enter general observations" 
                                value={observations} 
                                onChange={e => setObservations(e.target.value)} 
                            />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-slate-700 font-semibold">Defects Identified</Label>
                            <textarea 
                                rows={4} 
                                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none" 
                                placeholder="List any defects" 
                                value={defects} 
                                onChange={e => setDefects(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div className="space-y-3 mt-6">
                        <Label className="text-slate-700 font-semibold">Corrective Actions Required</Label>
                        <textarea 
                            rows={3} 
                            className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none" 
                            placeholder="Enter corrective actions" 
                            value={corrective} 
                            onChange={e => setCorrective(e.target.value)} 
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4 pt-6 border-t">
                <Button variant="outline" className="px-6">
                    <Save className="h-4 w-4 mr-2" /> Save Draft
                </Button>
                <Button 
                    onClick={submitInspection} 
                    disabled={saving || !lookupDone} 
                    className="bg-blue-600 hover:bg-blue-700 px-8"
                >
                    <CloudUpload className="h-4 w-4 mr-2" /> 
                    {saving ? 'Submitting...' : 'Submit Final Inspection'}
                </Button>
            </div>
        </div>
    )
}
