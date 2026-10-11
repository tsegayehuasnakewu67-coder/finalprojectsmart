/**
 * AttendanceReports  —  /admin/reports and /hr/reports
 *
 * Two tabs:
 *  1. Daily Log    — paginated raw records, same as before but with
 *                    lateness column and enhanced time display
 *  2. Analytics    — per-employee period summary with health scores
 *                    and escalation warning badges
 *
 * All layout via inline styles (immune to Tailwind JIT purge).
 * No placeholder attributes on any input.
 */
import { useState, useEffect, useCallback } from 'react';
import { attendanceService } from '../../services/attendanceService';
import Spinner from '../../components/Spinner';
import { formatEthiopianDate, formatEthiopianTime, getAddisAbabaDateParts, getAddisAbabaDateString } from '../../utils/ethiopianDateTime';
import {
  Filter, ChevronLeft, ChevronRight,
  AlertTriangle, ShieldAlert, CheckCircle2,
  BarChart2, List, Download,
} from 'lucide-react';

/* ─── Date helpers ──────────────────────────────────────────────────────── */
const TODAY      = getAddisAbabaDateString();
const addDays = (date, days) => {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};
const startOfWeek = () => {
  const { year, month, day } = getAddisAbabaDateParts();
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(TODAY, -((weekday + 6) % 7));
};
const startOfMonth = () => `${TODAY.slice(0, 7)}-01`;
const startOfYear  = () => `${TODAY.slice(0, 4)}-01-01`;
const startOfDay   = () => TODAY;
const startOfQuarter = () => {
  const month = Math.floor((Number(TODAY.slice(5, 7)) - 1) / 3) * 3 + 1;
  return `${TODAY.slice(0, 4)}-${String(month).padStart(2, '0')}-01`;
};

const QUICK_RANGES = [
  { key: 'day',   label: 'Daily',   start: startOfDay,     end: () => TODAY },
  { key: 'week',  label: 'Weekly',  start: startOfWeek,  end: () => TODAY },
  { key: 'month', label: 'Monthly', start: startOfMonth, end: () => TODAY },
  { key: 'quarter', label: 'Quarterly', start: startOfQuarter, end: () => TODAY },
  { key: 'year',  label: 'Yearly',  start: startOfYear,  end: () => TODAY },
];

const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

function downloadAnalyticsCsv(data, filters) {
  const headers = ['Employee', 'Employee ID', 'Department', 'Present Days', 'Late Days', 'Absent Days', 'Attendance %', 'Late Occurrences', 'Total Late Time', 'Health Flag'];
  const rows = (data?.employees ?? []).map(emp => [
    emp.fullName, emp.employeeId, placeholderDept(emp.department), emp.presentDays,
    emp.lateDays, emp.absentDays, `${emp.attendancePct}%`, emp.lateOccurrences,
    emp.lateTotalLabel || '0m', emp.healthFlag || 'normal',
  ]);
  const csv = [
    ['MAU Attendance Report'],
    ['Period', formatEthiopianDate(data?.periodStart), formatEthiopianDate(data?.periodEnd)],
    ['Department', filters.department || 'All departments'],
    [],
    headers,
    ...rows,
  ].map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mau-attendance-${filters.department || 'all-departments'}-${data?.periodStart || TODAY}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function printAnalyticsPdf(data, filters) {
  const rows = (data?.employees ?? []).map(emp => `
    <tr><td>${emp.fullName}</td><td>${emp.employeeId}</td><td>${placeholderDept(emp.department)}</td>
    <td>${emp.presentDays}</td><td>${emp.lateDays}</td><td>${emp.absentDays}</td>
    <td>${emp.attendancePct}%</td><td>${emp.lateTotalLabel || '0m'}</td></tr>`).join('');
  const reportWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!reportWindow) return;
  reportWindow.document.write(`<!doctype html><html><head><title>MAU Attendance Report</title>
    <style>body{font-family:Arial,sans-serif;color:#172033;padding:32px}h1{margin:0 0 8px;color:#123478}p{color:#526178}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #d8deeb;padding:10px;text-align:left;font-size:12px}th{background:#123478;color:#ffffff}tr:nth-child(even){background:#f4f6fb}.meta{display:flex;gap:28px;flex-wrap:wrap}</style>
    </head><body><h1>Mekdela Amba University</h1><h2>Attendance Report</h2>
    <div class="meta"><p><strong>Period:</strong> ${formatEthiopianDate(data?.periodStart)} to ${formatEthiopianDate(data?.periodEnd)}</p>
    <p><strong>Department:</strong> ${filters.department || 'All departments'}</p><p><strong>Employees:</strong> ${data?.employees?.length || 0}</p></div>
    <table><thead><tr><th>Employee</th><th>ID</th><th>Department</th><th>Present</th><th>Late</th><th>Absent</th><th>Attendance</th><th>Late Time</th></tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>{window.print();}</script></body></html>`);
  reportWindow.document.close();
}

/* ─── Shared style tokens ───────────────────────────────────────────────── */

/*
 * Sum of all daily-log column widths so the table never squishes.
 * 140+180+140+120+120+150+130+160+130+120+140 = 1530px
 */
const LOG_TABLE_MIN_WIDTH   = '1530px';
/*
 * Sum of all analytics column widths.
 * 200+140+90+80+90+120+100+140+170 = 1130px
 */
const ANALYTICS_TABLE_MIN_WIDTH = '1130px';

const CELL_PAD = '1rem 1.25rem'; /* 16px 20px */

const placeholderDept = (d) => {
  const v = (d == null ? '' : String(d)).trim();
  if (!v || /^general$/i.test(v)) return 'Unassigned';
  return v;
};

const S = {
  card: {
    background: '#0f182a',
    border: '1px solid #1e283b',
    borderRadius: '14px',
  },
  tableCard: {
    background: '#0f182a',
    border: '1px solid #1e283b',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    background: '#1c273d',
    border: '1.5px solid #333e55',
    borderRadius: '9px',
    color: '#e2e7f0',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    colorScheme: 'dark',
    textDecoration: 'none',
    backgroundImage: 'none',
    WebkitBoxShadow: '0 0 0 1000px #1e283b inset',
    WebkitTextFillColor: '#e2e7f0',
  },
  textInput: {
    width: '100%',
    padding: '9px 12px',
    background: '#1c273d',
    border: '1.5px solid #333e55',
    borderStyle: 'solid',
    borderRadius: '9px',
    color: '#e2e7f0',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
    textDecoration: 'none',
    backgroundImage: 'none',
    caretColor: '#e2e7f0',
    WebkitTextFillColor: '#e2e7f0',
  },
  label: {
    display: 'block',
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: '5px',
  },
  th: {
    textAlign: 'left',
    padding: CELL_PAD,
    fontSize: '0.625rem',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap',
    background: 'rgba(28, 39, 61,0.9)',
    borderBottom: '1px solid #1e283b',
  },
  td: (hovered, isLast) => ({
    padding: CELL_PAD,
    whiteSpace: 'nowrap',
    fontSize: '0.8125rem',
    borderBottom: isLast ? 'none' : '1px solid rgba(30, 40, 59,0.7)',
    background: hovered ? 'rgba(28, 39, 61,0.45)' : 'transparent',
    transition: 'background 0.1s',
  }),
  btn: (primary) => ({
    padding: '9px 20px',
    borderRadius: '10px',
    border: primary ? 'none' : '1px solid #333e55',
    background: primary ? '#2567eb' : '#1c273d',
    color: primary ? '#fff' : '#94a0b8',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    transition: 'background 0.15s',
  }),
  tab: (active) => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 18px',
    borderRadius: '9px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    transition: 'background 0.15s, color 0.15s',
    background: active ? '#2567eb' : 'transparent',
    color:      active ? '#fff'    : '#64748b',
  }),
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function AttendanceReports() {
  const [tab, setTab] = useState('log');   // 'log' | 'analytics'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Heading + tab switcher ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f4f9', margin: '0 0 4px', letterSpacing: '-0.025em' }}>
            Attendance Reports
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
            Daily logs, time-tracking analytics and escalation alerts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '4px', background: '#0f182a', border: '1px solid #1e283b', borderRadius: '12px', padding: '4px' }}>
          <button style={S.tab(tab === 'log')}       onClick={() => setTab('log')}>
            <List size={14} /> Daily Log
          </button>
          <button style={S.tab(tab === 'analytics')} onClick={() => setTab('analytics')}>
            <BarChart2 size={14} /> Analytics
          </button>
        </div>
      </div>

      {tab === 'log'       && <DailyLogTab />}
      {tab === 'analytics' && <AnalyticsTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 1 — DAILY LOG
   Paginated raw records with exact check-in time, lateness column,
   all session timestamps, status badge, and confidence bar.
═══════════════════════════════════════════════════════════════════════════ */
function DailyLogTab() {
  const [records,    setRecords]    = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [filters, setFilters] = useState({
    date: TODAY, startDate: '', endDate: '',
    department: '', status: '', search: '',
  });

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const params = { page, limit: 50 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const d = await attendanceService.getCompany(params);
      setRecords(d.records);
      setPagination(d.pagination);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const setF   = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
  const clearF = () => setFilters({ date: '', startDate: '', endDate: '', department: '', status: '', search: '' });

  /* ── Daily log columns ── */
  const COLS = [
    { label: 'Employee ID',      minWidth: '140px' },
    { label: 'Name',             minWidth: '180px' },
    { label: 'Department',       minWidth: '140px' },
    { label: 'Date',             minWidth: '120px' },
    { label: 'Check-In',         minWidth: '120px' },
    { label: 'Lateness',         minWidth: '150px' },
    { label: 'Lunch Out',        minWidth: '130px' },
    { label: 'After-Lunch In',   minWidth: '160px' },
    { label: 'Check-Out',        minWidth: '130px' },
    { label: 'Status',           minWidth: '120px' },
    { label: 'Confidence',       minWidth: '140px' },
  ];

  return (
    <>
      {/* ── Filter panel ── */}
      <div style={{ ...S.card, padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <Filter size={13} color="#64748b" />
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Filters
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <FilterField label="Date"       name="date"       type="date" value={filters.date}       onChange={setF} />
          <FilterField label="Start Date" name="startDate"  type="date" value={filters.startDate}  onChange={setF} />
          <FilterField label="End Date"   name="endDate"    type="date" value={filters.endDate}    onChange={setF} />
          <FilterField label="Department" name="department" type="text" value={filters.department} onChange={setF} />
          <div>
            <label style={S.label}>Status</label>
            <select name="status" value={filters.status} onChange={setF} style={S.input}
              onFocus={e => { e.target.style.borderColor = '#3b79f6'; }}
              onBlur={e  => { e.target.style.borderColor = '#333e55'; }}>
              <option value="">All</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
          <FilterField label="Search" name="search" type="text" value={filters.search} onChange={setF} />
        </div>

        <div style={{ display: 'flex', gap: '10px', paddingTop: '14px', borderTop: '1px solid #1e283b' }}>
          <Btn primary onClick={() => fetchData(1)}>Apply Filters</Btn>
          <Btn onClick={clearF}>Clear</Btn>
        </div>
      </div>

      {/* Subtitle */}
      <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '-12px 0 0' }}>
        {pagination.total} records found
      </p>

      {error && <ErrBox msg={error} />}

      {/* ── Table ── */}
      {loading ? <Spinner /> : (
        <div style={S.tableCard}>
          {/*
            overflowX:auto on this wrapper enables horizontal scroll.
            The table itself gets an explicit minWidth (sum of all column
            minWidths) so it never squishes below that point.
          */}
          <div className="overflow-x-auto w-full table-scroll-wrapper"
               style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table style={{
              width: LOG_TABLE_MIN_WIDTH,
              minWidth: LOG_TABLE_MIN_WIDTH,
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
              background: '#0f182a',
              tableLayout: 'fixed',
            }}>
              <colgroup>
                {COLS.map(c => (
                  <col key={c.label} style={{ width: c.minWidth }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {COLS.map(c => (
                    <th key={c.label} style={{ ...S.th, minWidth: c.minWidth }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td colSpan={COLS.length} style={{ padding: '52px 20px', textAlign: 'center', color: '#64748b' }}>
                    No records match these filters.
                  </td></tr>
                )}
                {records.map((r, i) => (
                  <LogRow key={r._id} r={r} isLast={i === records.length - 1} />
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <PaginationBar
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              label="records"
              onPrev={() => fetchData(pagination.page - 1)}
              onNext={() => fetchData(pagination.page + 1)}
            />
          )}
        </div>
      )}
    </>
  );
}

/* ── Daily log row ── */
function LogRow({ r, isLast }) {
  const [hovered, setHovered] = useState(false);
  const td = extra => ({ ...S.td(hovered, isLast), ...extra });

  const fmt = dt => dt ? formatEthiopianTime(dt) : null;

  /* Lateness display */
  const renderLateness = () => {
    if (r.status !== 'Late' || !r.lateMinutes) return <Dash />;
    const h = Math.floor(r.lateMinutes / 60);
    const m = r.lateMinutes % 60;
    const label = h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 9px', borderRadius: '999px',
        background: 'rgba(9, 66, 180,0.2)', color: '#fbbf24',
        fontSize: '0.75rem', fontWeight: 700,
      }}>
        +{label} late
      </span>
    );
  };

  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <td style={td()}>
        <code style={{ fontSize: '0.75rem', background: '#1c273d', border: '1px solid #333e55', padding: '2px 7px', borderRadius: '5px', color: '#94a0b8', fontFamily: 'monospace' }}>
          {r.employeeId}
        </code>
      </td>
      <td style={td({ fontWeight: 600, color: '#f1f4f9' })}>{r.fullName}</td>
      <td style={td({ color: '#cbd2e1' })}>{placeholderDept(r.department)}</td>
      <td style={td({ color: '#94a0b8', fontFamily: 'monospace' })}>{formatEthiopianDate(r.date)}</td>

      {/* Check-In — exact time */}
      <td style={td({ fontFamily: 'monospace', color: '#cbd2e1' })}>
        {fmt(r.checkInTime) ?? <Dash />}
      </td>

      {/* Lateness */}
      <td style={td()}>{renderLateness()}</td>

      {/* Lunch Out */}
      <td style={td({ fontFamily: 'monospace' })}>
        {fmt(r.checkOutTime) ? <span style={{ color: '#fbbf24' }}>{fmt(r.checkOutTime)}</span> : <Dash />}
      </td>

      {/* After-Lunch In */}
      <td style={td({ fontFamily: 'monospace' })}>
        {fmt(r.afterLunchCheckIn) ? <span style={{ color: '#6093fa' }}>{fmt(r.afterLunchCheckIn)}</span> : <Dash />}
      </td>

      {/* Check-Out */}
      <td style={td({ fontFamily: 'monospace' })}>
        {fmt(r.afterLunchCheckOut) ? <span style={{ color: '#84acfc' }}>{fmt(r.afterLunchCheckOut)}</span> : <Dash />}
      </td>

      <td style={td()}><StatusBadge status={r.status} /></td>
      <td style={td()}>
        {r.matchConfidence != null ? <ConfBar value={r.matchConfidence} /> : <Dash />}
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2 — ANALYTICS
   Per-employee period summaries, lateness totals, health scores,
   and escalation warning badges (Warning / Termination Risk).
═══════════════════════════════════════════════════════════════════════════ */
function AnalyticsTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [period,  setPeriod]  = useState('month'); /* week | month | year */

  const [filters, setFilters] = useState({
    startDate: startOfMonth(),
    endDate:   TODAY,
    department: '',
    search: '',
  });

  const fetchAnalytics = useCallback(async () => {
    if (!filters.startDate || !filters.endDate) return;
    setLoading(true); setError('');
    try {
      const d = await attendanceService.getAnalytics({
        startDate:  filters.startDate,
        endDate:    filters.endDate,
        department: filters.department || undefined,
        search:     filters.search     || undefined,
      });
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const setF = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
  const applyPeriod = (key) => {
    const range = QUICK_RANGES.find(r => r.key === key) || QUICK_RANGES[1];
    setPeriod(range.key);
    setFilters(p => ({ ...p, startDate: range.start(), endDate: range.end() }));
  };

  const totals = data?.totals || null;
  const counts = data ? {
    total:    data.employees.length,
    present:  totals?.presentDays ?? data.employees.reduce((s, e) => s + (e.presentDays || 0), 0),
    absent:   totals?.absentDays  ?? data.employees.reduce((s, e) => s + (e.absentDays  || 0), 0),
    lateLabel: totals?.lateTotalLabel
      || (() => {
        const m = data.employees.reduce((s, e) => s + (e.totalLateMinutes || 0), 0);
        const h = Math.floor(m / 60);
        const r = m % 60;
        return m === 0 ? '0m' : h > 0 ? `${h}h ${r > 0 ? r + 'm' : ''}`.trim() : `${r}m`;
      })(),
    warning:  totals?.warningCount ?? data.employees.filter(e => e.healthFlag === 'warning').length,
    risk:     totals?.riskCount    ?? data.employees.filter(e => e.healthFlag === 'termination_risk').length,
  } : null;

  const ANALYTICS_COLS = [
    { label: 'Employee',        minWidth: '200px' },
    { label: 'Department',      minWidth: '140px' },
    { label: 'Present',         minWidth: '90px'  },
    { label: 'Late',            minWidth: '80px'  },
    { label: 'Absent',          minWidth: '90px'  },
    { label: 'Attendance %',    minWidth: '120px' },
    { label: 'Late Count',      minWidth: '100px' },
    { label: 'Total Late Time', minWidth: '140px' },
    { label: 'Health Flag',     minWidth: '170px' },
  ];

  return (
    <>
      {/* ── Filter panel ── */}
      <div style={{ ...S.card, padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={13} color="#64748b" />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Period & Filters
            </span>
          </div>

          {/* Daily / Weekly / Monthly / Quarterly / Yearly tracking */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {QUICK_RANGES.map(r => {
              const active = period === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => applyPeriod(r.key)}
                  style={{
                    padding: '5px 12px', borderRadius: '7px',
                    border: active ? '1px solid #2567eb' : '1px solid #333e55',
                    background: active ? '#2567eb' : '#1c273d',
                    color: active ? '#fff' : '#94a0b8',
                    cursor: 'pointer',
                    fontSize: '0.75rem', fontWeight: 600, transition: 'background 0.15s',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <FilterField label="Start Date" name="startDate"  type="date" value={filters.startDate}  onChange={setF} />
          <FilterField label="End Date"   name="endDate"    type="date" value={filters.endDate}    onChange={setF} />
          <FilterField label="Department" name="department" type="text" value={filters.department} onChange={setF} />
          <FilterField label="Search"     name="search"     type="text" value={filters.search}     onChange={setF} />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '14px', borderTop: '1px solid #1e283b' }}>
          <Btn primary onClick={fetchAnalytics}>Generate Report</Btn>
          <Btn onClick={() => data && downloadAnalyticsCsv(data, filters)} disabled={!data}>
            <Download size={14} /> Download Excel
          </Btn>
          <Btn onClick={() => data && printAnalyticsPdf(data, filters)} disabled={!data}>
            <Download size={14} /> Download PDF
          </Btn>
          <Btn onClick={() => {
            setPeriod('month');
            setFilters({ startDate: startOfMonth(), endDate: TODAY, department: '', search: '' });
          }}>
            Reset
          </Btn>
        </div>
      </div>

      {error && <ErrBox msg={error} />}

      {loading && <Spinner />}

      {!loading && data && (
        <>
          {/* ── Summary KPI row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
            <KpiTile label="Days Present"          value={counts.present}   color="#4ade80" icon={<CheckCircle2 size={16} color="#4ade80" />} />
            <KpiTile label="Days Absent"           value={counts.absent}    color="#f87171" />
            <KpiTile label="Accumulated Lateness"  value={counts.lateLabel} color="#fbbf24" />
            <KpiTile label="⚠ Warning"             value={counts.warning}   color="#fbbf24" icon={<AlertTriangle size={16} color="#fbbf24" />} />
            <KpiTile label="Termination Risk"      value={counts.risk}      color="#f87171" icon={<ShieldAlert size={16} color="#f87171" />} />
            <KpiTile label="Working Days"          value={data.totalWorkingDays} color="#94a0b8" />
          </div>

          {/* Period label */}
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '-8px 0 0' }}>
            Period: <strong style={{ color: '#94a0b8' }}>{formatEthiopianDate(data.periodStart)}</strong>
            {' → '}
            <strong style={{ color: '#94a0b8' }}>{formatEthiopianDate(data.periodEnd)}</strong>
            {' · '}
            {data.employees.length} employees
          </p>

          {/* ── Analytics table ── */}
          <div style={S.tableCard}>
            <div className="overflow-x-auto w-full table-scroll-wrapper"
                 style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
              <table style={{
                width: ANALYTICS_TABLE_MIN_WIDTH,
                minWidth: ANALYTICS_TABLE_MIN_WIDTH,
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
                background: '#0f182a',
                tableLayout: 'fixed',
              }}>
                <colgroup>
                  {ANALYTICS_COLS.map(c => (
                    <col key={c.label} style={{ width: c.minWidth }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {ANALYTICS_COLS.map(c => (
                      <th key={c.label} style={{ ...S.th, minWidth: c.minWidth }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.length === 0 && (
                    <tr><td colSpan={ANALYTICS_COLS.length} style={{ padding: '52px', textAlign: 'center', color: '#64748b' }}>
                      No employees found for this period.
                    </td></tr>
                  )}
                  {data.employees.map((emp, i) => (
                    <AnalyticsRow
                      key={emp.employeeId}
                      emp={emp}
                      isLast={i === data.employees.length - 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Legend ── */}
          <div style={{ ...S.card, padding: '16px 20px' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px' }}>
              Escalation Rules
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              <LegendItem color="#fbbf24" icon={<AlertTriangle size={13} />}
                title="Warning Issued"
                desc="More than 3 late arrivals in the period  OR  attendance < 85 %" />
              <LegendItem color="#f87171" icon={<ShieldAlert size={13} />}
                title="Termination Risk"
                desc="> 5 absent days  OR  total late time > 5 hours (300 min)" />
              <LegendItem color="#4ade80" icon={<CheckCircle2 size={13} />}
                title="Normal"
                desc="All thresholds within acceptable range" />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Analytics table row ── */
function AnalyticsRow({ emp, isLast }) {
  const [hovered, setHovered] = useState(false);
  const td = extra => ({ ...S.td(hovered, isLast), ...extra });

  /* Attendance % bar colour */
  const pctColor = emp.attendancePct >= 90 ? '#4ade80'
                 : emp.attendancePct >= 75 ? '#fbbf24'
                 : '#f87171';

  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Employee */}
      <td style={td()}>
        <div style={{ fontWeight: 600, color: '#f1f4f9' }}>{emp.fullName}</div>
        <div style={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>
          {emp.employeeId}
        </div>
      </td>

      <td style={td({ color: '#cbd2e1' })}>{placeholderDept(emp.department)}</td>

      {/* Present */}
      <td style={td({ textAlign: 'center' })}>
        <span style={{ fontWeight: 700, color: '#4ade80' }}>{emp.presentDays}</span>
      </td>

      {/* Late */}
      <td style={td({ textAlign: 'center' })}>
        <span style={{ fontWeight: 700, color: emp.lateDays > 0 ? '#fbbf24' : '#64748b' }}>
          {emp.lateDays}
        </span>
      </td>

      {/* Absent */}
      <td style={td({ textAlign: 'center' })}>
        <span style={{ fontWeight: 700, color: emp.absentDays > 0 ? '#f87171' : '#64748b' }}>
          {emp.absentDays}
        </span>
      </td>

      {/* Attendance % — mini progress bar */}
      <td style={td()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '52px', height: '5px', background: '#1c273d', borderRadius: '999px', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${emp.attendancePct}%`, height: '100%', background: pctColor, borderRadius: '999px' }} />
          </div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: pctColor }}>
            {emp.attendancePct}%
          </span>
        </div>
      </td>

      {/* Late occurrences */}
      <td style={td({ textAlign: 'center' })}>
        {emp.lateOccurrences > 0
          ? <span style={{ fontWeight: 700, color: '#fbbf24' }}>{emp.lateOccurrences}×</span>
          : <span style={{ color: '#333e55' }}>—</span>}
      </td>

      {/* Total late time */}
      <td style={td()}>
        {emp.totalLateMinutes > 0
          ? (
            <span style={{
              display: 'inline-block', padding: '2px 9px', borderRadius: '999px',
              background: 'rgba(9, 66, 180,0.2)', color: '#fbbf24',
              fontSize: '0.75rem', fontWeight: 700,
            }}>
              {emp.lateTotalLabel}
            </span>
          )
          : <span style={{ color: '#333e55' }}>—</span>}
      </td>

      {/* Health flag badge */}
      <td style={td()}>
        <HealthBadge flag={emp.healthFlag} />
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */

function HealthBadge({ flag }) {
  const map = {
    normal:           { bg: 'rgba(21, 57, 128,0.2)',  color: '#4ade80', border: 'rgba(21,128,61,0.4)',  icon: <CheckCircle2 size={12} />, label: 'Normal'            },
    warning:          { bg: 'rgba(9, 66, 180,0.25)',  color: '#fbbf24', border: 'rgba(180,83,9,0.45)',  icon: <AlertTriangle size={12} />, label: 'Warning Issued'   },
    termination_risk: { bg: 'rgba(28, 80, 185,0.25)', color: '#f87171', border: 'rgba(185,28,28,0.45)', icon: <ShieldAlert size={12} />,   label: 'Termination Risk' },
  };
  const s = map[flag] ?? map.normal;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: '0.6875rem', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {s.icon}{s.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    Present: { bg: 'rgba(21, 57, 128,0.2)',  color: '#86efac', border: 'rgba(21,128,61,0.35)'  },
    Late:    { bg: 'rgba(9, 66, 180,0.2)',   color: '#fcd34d', border: 'rgba(180,83,9,0.35)'   },
    Absent:  { bg: 'rgba(28, 80, 185,0.2)',  color: '#fca5a5', border: 'rgba(185,28,28,0.35)'  },
  };
  const s = map[status] ?? { bg: 'rgba(28, 39, 61,0.5)', color: '#94a0b8', border: '#333e55' };
  return (
    <span style={{
      display: 'inline-block', fontSize: '0.6875rem', fontWeight: 700,
      padding: '3px 9px', borderRadius: '999px',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

function ConfBar({ value }) {
  const pct   = Math.max(0, Math.round((1 - value / 0.6) * 100));
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <div style={{ width: '48px', height: '5px', background: '#1c273d', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px' }} />
      </div>
      <span style={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace' }}>{value.toFixed(3)}</span>
    </div>
  );
}

function KpiTile({ label, value, color, icon }) {
  return (
    <div style={{ ...S.card, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
        {icon}
      </div>
      <p style={{
        fontSize: typeof value === 'string' && String(value).length > 4 ? '1.35rem' : '2rem',
        fontWeight: 800, color, margin: 0, lineHeight: 1, whiteSpace: 'nowrap',
      }}>{value}</p>
    </div>
  );
}

function LegendItem({ color, icon, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: '200px' }}>
      <span style={{ color, marginTop: '1px', flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ fontSize: '0.8125rem', fontWeight: 700, color, margin: '0 0 2px' }}>{title}</p>
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{desc}</p>
      </div>
    </div>
  );
}

function FilterField({ label, name, value, onChange, type }) {
  const isText = type === 'text' || type === 'search';
  return (
    <div>
      <label style={S.label}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        autoComplete="off"
        spellCheck={false}
        style={isText ? S.textInput : S.input}
        onFocus={e => { e.target.style.borderColor = '#3b79f6'; }}
        onBlur={e  => { e.target.style.borderColor = '#333e55'; }}
      />
    </div>
  );
}

function Btn({ primary, onClick, children, disabled = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...S.btn(primary),
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: primary
          ? (hov ? '#3b79f6' : '#2567eb')
          : (hov ? '#333e55' : '#1e283b'),
      }}
    >
      {children}
    </button>
  );
}

function PaginationBar({ page, totalPages, total, label, onPrev, onNext }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 20px', borderTop: '1px solid #1e283b', background: '#0f182a',
    }}>
      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
        Page {page} of {totalPages} &nbsp;·&nbsp; {total} {label}
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <PaginationBtn disabled={page <= 1} onClick={onPrev}><ChevronLeft size={14} /></PaginationBtn>
        <PaginationBtn disabled={page >= totalPages} onClick={onNext}><ChevronRight size={14} /></PaginationBtn>
      </div>
    </div>
  );
}

function PaginationBtn({ disabled, onClick, children }) {
  return (
    <button disabled={disabled} onClick={onClick}
      style={{
        padding: '6px 8px', borderRadius: '8px',
        background: '#1c273d', border: '1px solid #333e55',
        color: '#94a0b8', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1, display: 'flex', alignItems: 'center',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#333e55'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#1e283b'; }}>
      {children}
    </button>
  );
}

function Dash() {
  return <span style={{ color: '#333e55' }}>—</span>;
}

function ErrBox({ msg }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(29, 62, 127,0.3)', border: '1px solid #991b1b', color: '#fca5a5', fontSize: '0.875rem' }}>
      {msg}
    </div>
  );
}
