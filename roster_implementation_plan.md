# 📊 Roster Analytics — Next.js Integration Plan

**Target Project:** `footplate-inspection-sys/other_website`  
**Stack:** Next.js 16 (App Router), React 19, Supabase, Tailwind CSS v4, Recharts 3, Shadcn/ui  
**Objective:** Port three analytical modules (Daily Overview, Historical Trends, Fatigue & Fairness) into the existing [(protected)](file:///C:/Users/BangeraP/Documents/my/my/py_pro/rostering_dashbaord/run.py#5-22) route group with strict role-based data scoping.

---

## 1. Role-Based Data Scoping

> [!IMPORTANT]
> The existing [rbac.ts](file:///C:/Users/BangeraP/Documents/my/my/py_pro/footplate-inspection-sys/other_website/src/lib/rbac.ts) already defines roles `admin | hod | manager | employee`. We will add a new role `cxo` and extend the data scoping logic.

| Role | Sidebar Access | Data Scope |
|---|---|---|
| **Admin** | All modules | All departments, all employees |
| **CXO** | Roster Analytics only | All departments (read-only aggregates) |
| **HoD** | Roster Analytics + Reports | Own department only (matched via `employees.department`) |
| **Manager** | Roster Analytics (limited) | Own assigned employees only (matched via `employees.manager_id` or `manager_assignment_rights`) |
| **Employee** | ❌ No access | N/A |

### Implementation

#### [MODIFY] [rbac.ts](file:///C:/Users/BangeraP/Documents/my/my/py_pro/footplate-inspection-sys/other_website/src/lib/rbac.ts)

```diff
- export type UserRole = 'admin' | 'hod' | 'manager' | 'employee'
+ export type UserRole = 'admin' | 'cxo' | 'hod' | 'manager' | 'employee'
```

Add route access for the new pages:
```typescript
cxo: ['/dashboard', '/roster-analytics'],
hod: [...existing, '/roster-analytics'],
manager: [...existing, '/roster-analytics'],
```

Add sidebar entries under a new **"Roster Analytics"** group:
```typescript
{
    label: 'Roster Analytics',
    icon: 'BarChart3',
    roles: ['admin', 'cxo', 'hod', 'manager'],
    children: [
        { label: 'Daily Overview', href: '/roster-analytics/daily', icon: 'CalendarDays', roles: ['admin', 'cxo', 'hod', 'manager'] },
        { label: 'Historical Trends', href: '/roster-analytics/trends', icon: 'TrendingUp', roles: ['admin', 'cxo', 'hod', 'manager'] },
        { label: 'Fatigue Management', href: '/roster-analytics/fatigue', icon: 'ShieldAlert', roles: ['admin', 'cxo', 'hod', 'manager'] },
    ],
}
```

---

## 2. Database Requirements

> [!NOTE]
> The roster data already lives in the **same Supabase project** (`hoalsyfkxnzfxmuvidtl`) in tables `raw_roster_data` and [processed_roster](file:///c:/Users/BangeraP/Documents/my/my/py_pro/rostering_dashbaord/src/supabase_client.py#24-30). The [employees](file:///C:/Users/BangeraP/Documents/my/my/py_pro/rostering_dashbaord/pages/7_Employee_Profile.py#16-30) table is shared. No new tables are required — only views and RLS policies.

### A. Supabase Postgres Views (Performance)

These pre-aggregate the heavy Pandas-equivalent logic server-side so the Next.js frontend gets lean JSON.

#### [NEW] View: `v_daily_roster_summary`

```sql
CREATE OR REPLACE VIEW public.v_daily_roster_summary AS
SELECT
    pr.date,
    rr.crew_type,
    pr.duty_category,
    pr.duty_code,
    pr.status,
    rr.shift_start,
    rr.shift_end,
    rr.emp_id,
    rr.name,
    e.department,
    e.designation,
    e.manager_id
FROM processed_roster pr
JOIN raw_roster_data rr ON pr.emp_id = rr.emp_id AND pr.date = rr.date
LEFT JOIN employees e ON pr.emp_id = e.employee_id;
```

#### [NEW] View: `v_historical_metrics`

```sql
CREATE OR REPLACE VIEW public.v_historical_metrics AS
SELECT
    pr.date,
    rr.crew_type,
    e.department,
    COUNT(*) FILTER (WHERE pr.duty_category NOT IN ('Casual Leave','Earned Leave','Sick Leave','Public Holiday','Optional Holiday','Compensatory OFF','Absent','Weekly Off','Uncategorized')) AS on_duty_count,
    COUNT(*) FILTER (WHERE pr.duty_category IN ('Casual Leave','Earned Leave','Sick Leave','Public Holiday','Optional Holiday','Compensatory OFF')) AS leave_count,
    COUNT(*) FILTER (WHERE pr.duty_category = 'Absent') AS absent_count,
    COUNT(*) FILTER (WHERE pr.duty_category = 'Weekly Off') AS weekly_off_count,
    COUNT(*) AS total_rostered
FROM processed_roster pr
JOIN raw_roster_data rr ON pr.emp_id = rr.emp_id AND pr.date = rr.date
LEFT JOIN employees e ON pr.emp_id = e.employee_id
GROUP BY pr.date, rr.crew_type, e.department;
```

### B. RLS Policies

Add `SELECT` policies on both views that allow authenticated users to read. The role-based filtering will happen in the Next.js Server Component queries (using `WHERE department = ?` or `WHERE manager_id = ?`) for maximum flexibility.

---

## 3. File Structure (New Files)

```
src/
├── app/(protected)/roster-analytics/
│   ├── layout.tsx                    ← Shared layout (date picker, dept filter)
│   ├── daily/
│   │   └── page.tsx                  ← Daily Overview (Server Component)
│   ├── trends/
│   │   └── page.tsx                  ← Historical Trends (Server Component)
│   └── fatigue/
│       └── page.tsx                  ← Fatigue Management (Server Component)
├── components/roster-analytics/
│   ├── date-department-filter.tsx    ← Client: date picker + dept dropdown
│   ├── kpi-cards.tsx                 ← Client: metric cards row
│   ├── duty-breakdown-table.tsx      ← Client: shift/leave/WO breakdown
│   ├── shift-timeline-chart.tsx      ← Client: Recharts bar (Early/Gen/Late/Night)
│   ├── leave-pie-chart.tsx           ← Client: Recharts pie for leaves
│   ├── trends-line-chart.tsx         ← Client: Recharts multi-line chart
│   └── fatigue-alerts-table.tsx      ← Client: warnings table
└── lib/
    └── roster-utils.ts               ← Pure TS: duty categorization, fatigue calc
```

---

## 4. Component Specifications

### A. Shared Layout (`roster-analytics/layout.tsx`)

- Server Component that reads user profile (role, department, manager_id)
- Passes scoping props down to children via React Context or server-side params
- Contains the **Date Picker** and **Department Filter** (disabled/locked for non-admin roles)

### B. Daily Overview Page (`roster-analytics/daily/page.tsx`)

| Section | Description |
|---|---|
| **KPI Row** | Total Active Employees · Total Rostered · Unassigned Gap · On-Duty · Absent · Leaves · Weekly Off |
| **Duty Breakdown** | 3-column table: Shift Duties (sorted RRTS→MRTS→Other), Leaves, Weekly Off. Uncategorized duties expanded by raw code. |
| **Charts Row** | Duty Distribution (Recharts Pie) + Active vs Inactive (Recharts Bar) |
| **Shift Analysis Tab** | Bar chart: Early/General/Late/Night shift distribution |
| **Leave Analytics Tab** | Pie chart + staff-on-leave table |
| **Roster Table** | Paginated DataTable of all rostered personnel |

**Data Flow:**
```
Server Component → Supabase query (v_daily_roster_summary WHERE date=X AND department=Y)
    → Pass JSON array to Client Components
    → Client does .filter()/.reduce() for KPIs and chart data
```

### C. Historical Trends Page (`roster-analytics/trends/page.tsx`)

- Date range picker (default: last 30 days)
- Fetches from `v_historical_metrics` view
- **Line Chart 1:** Daily On-Duty count over time
- **Line Chart 2:** Multi-line (Leaves vs Absences vs Weekly Off)
- **Summary Table:** Date | On Duty | Leaves | Absent | Weekly Off

### D. Fatigue & Fairness Management Page (`roster-analytics/fatigue/page.tsx`)

> [!IMPORTANT]
> This is the most complex page. It must faithfully replicate the **Master Roster Grid View** and all **3 tabs** from the existing Streamlit implementation.

**Date Range Picker:** From/To date input (default: 1st of current month → today)  
**Employee Filter:** Sidebar dropdown to select individual employees

#### Tab 1: Master Roster Grid

A full employee × date pivot table showing duty codes with shift times, color-coded by category:

| Color | Meaning |
|---|---|
| 🔵 Blue | Active duty (RRTS/MRTS/Shuttle/On Duty) |
| 🟢 Green | Weekly Off / Public Holiday |
| 🔴 Red | Absent / Leave |
| 🔴 Dark Red + ⚠️ | Fatigue violation (e.g., Early shift after Night shift) |

**Data Logic:**
- Pivot: rows = [(emp_id, name)](file:///C:/Users/BangeraP/Documents/my/my/py_pro/rostering_dashbaord/run.py#5-22), columns = dates (`DD.MM\nDAY`), values = `duty_code (HH:MM-HH:MM)`
- Fatigue violation engine: iterate chronologically per employee, apply `config.fatigue_rules` (e.g., "No Early shift immediately following a Late/Night shift")
- Enriched cell format: `CODE::CATEGORY::SHIFT_PERIOD::VIOLATION_FLAG`

**Components:**
- `roster-grid-table.tsx` — Client component rendering the styled pivot grid with conditional cell coloring

#### Tab 2: Daily Working Hours

Same pivot layout but values show working hours per shift:
- `8.5h ⏱️6.2h` = 8.5h worked, 6.2h rest since last shift
- Cumulative cycle hours tracked between Weekly Offs
- `⚠️` badge when cycle hours exceed 48h

**Data Logic:**
- Calculate `working_hours = shift_end - shift_start` (handle overnight crossings)
- Calculate `rest_hours = current_start - previous_end` per employee
- Track `cumulative_cycle_hours` resetting at each Weekly Off

**Components:**
- `hours-grid-table.tsx` — Client component with conditional styling (blue=working, green=WO, red=leave, red-alert=>48h)

#### Tab 3: Weekly Hours Compliance Report

A consolidated multi-column matrix tracking consecutive working hours bounded by Weekly Offs against the **48-Hour Rule**:

| Employee ID | Name | Week 1 Date | Week 1 Hrs | Week 2 Date | Week 2 Hrs | ... |
|---|---|---|---|---|---|---|

- Hours cells > 48h highlighted in **RED**
- Date cells show the cycle range (e.g., `01-03-2026 to 06-03-2026`)

**Components:**
- `compliance-matrix.tsx` — Multi-header table with conditional formatting

#### KPI Metrics Row

| Metric | Source |
|---|---|
| Average Working Hours (Group) | `mean(total_hours)` across all employees |
| Highest Monthly Hours (Individual) | `max(total_hours)` |
| Highest Continuous Weekly Hours | `max(cycle_hours)` globally |

#### Charts

| Chart | Type | Library |
|---|---|---|
| Total Working Hours Distribution | Histogram (15 bins) | Recharts BarChart |
| Duty Type Allocation (Early/Gen/Late/Night) | Donut Pie | Recharts PieChart |
| Dynamic Weekly Hours Monitor (per employee) | Bar chart with status coloring | Recharts BarChart |

#### Leaderboard Table

Sortable table: Employee Name | Employee ID | Total Hours | Total Shifts

**New Components for Fatigue Page:**
```
src/components/roster-analytics/
├── roster-grid-table.tsx         ← Tab 1: color-coded duty pivot grid
├── hours-grid-table.tsx          ← Tab 2: working hours + rest hours grid
├── compliance-matrix.tsx         ← Tab 3: weekly 48h compliance matrix
├── fatigue-kpi-cards.tsx         ← 3 metric cards
├── hours-histogram.tsx           ← Working hours distribution chart
├── shift-allocation-pie.tsx      ← Early/Gen/Late/Night pie
└── employee-cycle-chart.tsx      ← Per-employee weekly hours bar chart
```

---

## 5. Data Scoping Logic (Server-Side)

This is the critical security layer. Applied in each Server Component before querying:

```typescript
// In roster-analytics/layout.tsx or each page.tsx
async function getScopedQuery(supabase, userRole, userDept, userManagerId) {
    let query = supabase.from('v_daily_roster_summary').select('*')
    
    if (userRole === 'manager') {
        // Only employees assigned to this manager
        query = query.eq('manager_id', userManagerId)
    } else if (userRole === 'hod') {
        // Only employees in this department
        query = query.eq('department', userDept)
    }
    // admin and cxo: no filter (see all data)
    
    return query
}
```

---

## 6. Phased Execution Timeline

### Phase 1: Foundation (Days 1-2)
- [ ] Add `cxo` role to [rbac.ts](file:///C:/Users/BangeraP/Documents/my/my/py_pro/footplate-inspection-sys/other_website/src/lib/rbac.ts) and update `roleAccessMap`
- [ ] Add "Roster Analytics" sidebar group with 3 child links
- [ ] Create `v_daily_roster_summary` and `v_historical_metrics` Postgres views in Supabase
- [ ] Create `src/lib/roster-utils.ts` with duty categorization constants and helper functions
- [ ] Create `roster-analytics/layout.tsx` with auth check + data scoping

### Phase 2: Daily Overview (Days 3-5)
- [ ] Build `date-department-filter.tsx` client component
- [ ] Build `kpi-cards.tsx` with the 7 metric cards
- [ ] Build `duty-breakdown-table.tsx` with RRTS→MRTS→Other sorting + Uncategorized expansion
- [ ] Build `shift-timeline-chart.tsx` (Recharts BarChart)
- [ ] Build `leave-pie-chart.tsx` (Recharts PieChart)
- [ ] Wire everything together in `roster-analytics/daily/page.tsx`

### Phase 3: Historical Trends (Days 6-7)
- [ ] Build `trends-line-chart.tsx` (Recharts LineChart with multiple series)
- [ ] Build the summary DataTable
- [ ] Wire in `roster-analytics/trends/page.tsx` with date range picker

### Phase 4: Fatigue & Fairness Management (Days 8-12)
- [ ] Build `roster-grid-table.tsx` — Tab 1: color-coded duty pivot grid with violation flags
- [ ] Build `hours-grid-table.tsx` — Tab 2: working hours + rest hours grid with cumulative tracking
- [ ] Build `compliance-matrix.tsx` — Tab 3: weekly 48h compliance multi-header matrix
- [ ] Port the Python fatigue violation engine and cycle-hours logic to `roster-utils.ts`
- [ ] Build `fatigue-kpi-cards.tsx`, `hours-histogram.tsx`, `shift-allocation-pie.tsx`
- [ ] Build `employee-cycle-chart.tsx` for per-employee dynamic weekly hours bar chart
- [ ] Wire in `roster-analytics/fatigue/page.tsx` with all 3 tabs + KPIs + charts + leaderboard

### Phase 5: Testing & Polish (Days 13-14)
- [ ] Test RBAC scoping for each role (admin sees all, HoD sees dept, manager sees team)
- [ ] Verify metric parity between Python Streamlit dashboard and Next.js implementation
- [ ] Mobile responsiveness pass
- [ ] Performance optimization (server-side caching, view indexes)

---

## 7. Key Technical Translation Notes

### Python Pandas → TypeScript

**On-Duty Calculation (Python):**
```python
non_duty = actual_leaves + ['Absent', 'Weekly Off', 'Uncategorized']
on_duty = len(roster_df[~roster_df['duty_category'].isin(non_duty)])
```

**TypeScript Equivalent:**
```typescript
const NON_DUTY = ['Casual Leave', 'Earned Leave', 'Sick Leave', 'Public Holiday',
    'Optional Holiday', 'Compensatory OFF', 'Absent', 'Weekly Off', 'Uncategorized']

const onDutyCount = rosterData.filter(r => !NON_DUTY.includes(r.duty_category)).length
```

> [!TIP]
> For Historical Trends, push aggregation into the Postgres view (`v_historical_metrics`) so the frontend receives pre-computed numbers. This avoids transferring thousands of rows to the browser.

### Shift Time Classification

```typescript
function classifyShift(shiftStart: string | null): string {
    if (!shiftStart) return 'No Time/Other'
    const hour = parseInt(shiftStart.split(':')[0])
    if (hour >= 4 && hour < 8) return 'Early'
    if (hour >= 8 && hour < 14) return 'General'
    if (hour >= 14 && hour < 20) return 'Late'
    return 'Night'
}
```
