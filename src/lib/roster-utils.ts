// ─── Roster Analytics Utility Functions ───

// Leave categories
export const LEAVE_TYPES = [
    'Casual Leave', 'Earned Leave', 'Sick Leave',
    'Public Holiday', 'Optional Holiday', 'Compensatory OFF',
] as const

// Non-duty categories (for on-duty calculation)
export const NON_DUTY_CATEGORIES = [
    ...LEAVE_TYPES,
    'Absent', 'Weekly Off', 'Uncategorized',
] as const

// Shift classification by start hour
export function classifyShift(shiftStart: string | null): string {
    if (!shiftStart) return 'No Time/Other'
    const hour = parseInt(shiftStart.split(':')[0], 10)
    if (isNaN(hour)) return 'No Time/Other'
    if (hour >= 4 && hour < 8) return 'Early'
    if (hour >= 8 && hour < 14) return 'General'
    if (hour >= 14 && hour < 20) return 'Late'
    return 'Night'
}

// Calculate working hours from shift strings (HH:MM)
export function calcWorkingHours(start: string | null, end: string | null): number {
    if (!start || !end) return 0
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let startMin = sh * 60 + sm
    let endMin = eh * 60 + em
    // Handle overnight crossings
    if (endMin <= startMin) endMin += 24 * 60
    return (endMin - startMin) / 60
}

// Calculate rest hours between two shifts
export function calcRestHours(
    prevEnd: string | null,
    currentStart: string | null,
    isSameDay: boolean
): number {
    if (!prevEnd || !currentStart) return 0
    const [peh, pem] = prevEnd.split(':').map(Number)
    const [csh, csm] = currentStart.split(':').map(Number)
    let prevEndMin = peh * 60 + pem
    let curStartMin = csh * 60 + csm
    if (!isSameDay) curStartMin += 24 * 60
    return Math.max(0, (curStartMin - prevEndMin) / 60)
}

// Detect fatigue violations
// Rule: No Early shift immediately following a Late or Night shift
export function detectFatigueViolation(
    prevShiftType: string | null,
    currentShiftType: string | null
): boolean {
    if (!prevShiftType || !currentShiftType) return false
    const risky = ['Late', 'Night']
    return risky.includes(prevShiftType) && currentShiftType === 'Early'
}

// Color mapping for duty categories
export function getCategoryColor(category: string): string {
    if (NON_DUTY_CATEGORIES.includes(category as (typeof NON_DUTY_CATEGORIES)[number])) {
        if (category === 'Weekly Off' || category === 'Public Holiday') return 'bg-green-100 text-green-800'
        if (category === 'Absent') return 'bg-red-100 text-red-800'
        if (LEAVE_TYPES.includes(category as (typeof LEAVE_TYPES)[number])) return 'bg-red-50 text-red-700'
        return 'bg-gray-100 text-gray-600'
    }
    return 'bg-blue-100 text-blue-800' // Active duty
}

// Roster data types
export interface DailyRosterRow {
    date: string
    crew_type: string
    duty_category: string
    duty_code: string
    status: string
    shift_type: string
    shift_start: string | null
    shift_end: string | null
    emp_id: string
    name: string
    duty_code_raw: string
    department: string | null
    designation: string | null
    manager_id: string | null
}

export interface HistoricalMetricsRow {
    date: string
    crew_type: string
    department: string | null
    on_duty_count: number
    leave_count: number
    absent_count: number
    weekly_off_count: number
    total_rostered: number
}

// KPI calculation from daily roster data
export function calculateKPIs(data: DailyRosterRow[]) {
    const totalRostered = data.length
    const onDuty = data.filter(r => !NON_DUTY_CATEGORIES.includes(r.duty_category as (typeof NON_DUTY_CATEGORIES)[number])).length
    const leaves = data.filter(r => LEAVE_TYPES.includes(r.duty_category as (typeof LEAVE_TYPES)[number])).length
    const absent = data.filter(r => r.duty_category === 'Absent').length
    const weeklyOff = data.filter(r => r.duty_category === 'Weekly Off').length
    const uncategorized = data.filter(r => r.duty_category === 'Uncategorized').length

    return {
        totalRostered,
        onDuty,
        leaves,
        absent,
        weeklyOff,
        uncategorized,
    }
}
