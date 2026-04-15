import { Button } from '@/components/ui/button'

interface InstructionAssurancePreviewProps {
    instruction: any
    currentIndex?: number
    totalPending?: number
    acknowledged?: boolean
    employeeId?: string // If present and not acknowledged, we show the acknowledge button
    onAcknowledge?: () => void
    loading?: boolean
}

export function InstructionAssurancePreview({
    instruction,
    currentIndex,
    totalPending,
    acknowledged,
    employeeId,
    onAcknowledge,
    loading
}: InstructionAssurancePreviewProps) {
    if (!instruction) return null

    const dateObj = instruction?.created_at ? new Date(instruction.created_at) : new Date()
    const dateStr = dateObj.toLocaleDateString('en-GB')
    const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const creatorName = instruction?.creator?.name
        ? `Mr/Ms. ${instruction.creator.name}${instruction.creator.designation ? ` (${instruction.creator.designation})` : ''}`
        : 'Admin'

    // instruction.assignments or instruction.instruction_designation_assignments depending on caller
    const assignments = instruction?.assignments || instruction?.instruction_designation_assignments || []
    const applicableFor = assignments?.map((d: any) => d.designation).join(', ') || 'All'

    return (
        <table className="w-full border-collapse border border-slate-300 text-sm">
            <tbody>
                <tr>
                    <td colSpan={2} className="border border-slate-300 p-2 font-bold bg-slate-50 text-slate-800">
                        Date & Time: {dateStr}, {timeStr} hrs
                    </td>
                </tr>
                <tr>
                    <td className="border border-slate-300 p-2 font-bold w-[200px] bg-slate-50 text-slate-800">
                        Instruction Received From
                    </td>
                    <td className="border border-slate-300 p-2 font-bold text-slate-800 bg-white">
                        {creatorName}
                    </td>
                </tr>
                <tr>
                    <td className="border border-slate-300 p-2 font-bold bg-slate-50 text-slate-800">
                        Applicable For
                    </td>
                    <td className="border border-slate-300 p-2 font-bold text-slate-800 bg-white">
                        {applicableFor}
                    </td>
                </tr>
                <tr>
                    <td colSpan={2} className="border border-slate-300 p-2 font-bold text-center bg-slate-50 text-slate-800">
                        Instruction ({instruction?.title || 'No Title'})
                    </td>
                </tr>
                <tr>
                    <td colSpan={2} className="border border-slate-300 p-4 text-slate-800 min-h-[120px] whitespace-pre-wrap font-medium align-top leading-relaxed bg-white">
                        {instruction?.content}
                    </td>
                </tr>

                {employeeId && (
                    <>
                        <tr>
                            <td colSpan={2} className="border border-slate-300 p-2 font-bold text-center bg-slate-50 text-slate-800">
                                Staff Acknowledgement
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="border border-slate-300 p-4 bg-white text-center">
                                {acknowledged ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-sm font-medium italic text-slate-600">
                                            "I hereby declare that I have carefully read and fully understood the above instruction, and I agree to strictly comply with it."
                                        </p>
                                        <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-md font-bold text-sm">
                                            ✓ You have acknowledged this instruction
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-4">
                                        <p className="text-sm font-medium italic text-slate-600 max-w-2xl">
                                            "I hereby declare that I have carefully read and fully understood the above instruction, and I agree to strictly comply with it."
                                        </p>
                                        {totalPending && currentIndex !== undefined && (
                                            <p className="text-sm font-semibold text-slate-600 text-center">
                                                Instruction {currentIndex + 1} of {totalPending}
                                            </p>
                                        )}
                                        <Button
                                            onClick={onAcknowledge}
                                            disabled={loading}
                                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-10 py-2 h-auto text-base font-bold shadow-sm"
                                        >
                                            {loading ? 'Acknowledging...' : 'I Acknowledge'}
                                        </Button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    </>
                )}
            </tbody>
        </table>
    )
}
