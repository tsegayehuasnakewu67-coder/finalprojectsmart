import { useState, useEffect, useCallback } from 'react';
import { attendanceService } from '../../services/attendanceService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatEthiopianDate, formatEthiopianTime, getAddisAbabaDateString } from '../../utils/ethiopianDateTime';

const TODAY = getAddisAbabaDateString();

export default function AttendanceLog() {
  const [records, setRecords]       = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const [filters, setFilters] = useState({
    date: TODAY, startDate: '', endDate: '', department: '',
    status: '', search: '',
  });

  const fetchRecords = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      // Build clean params (omit empty strings)
      const params = { page, limit: 50 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const data = await attendanceService.getCompany(params);
      setRecords(data.records);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchRecords(1); }, [fetchRecords]);

  const handleFilter = (e) =>
    setFilters((p) => ({ ...p, [e.target.name]: e.target.value }));

  const clearFilters = () =>
    setFilters({ date: '', startDate: '', endDate: '', department: '', status: '', search: '' });

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Attendance Log</h2>
          <p style={styles.pageSub}>{pagination.total} records found</p>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div style={styles.filterCard}>
        <div style={styles.filterGrid}>
          <FilterField label="Date" name="date" type="date" value={filters.date} onChange={handleFilter} />
          <FilterField label="Start Date" name="startDate" type="date" value={filters.startDate} onChange={handleFilter} />
          <FilterField label="End Date" name="endDate" type="date" value={filters.endDate} onChange={handleFilter} />
          <FilterField label="Department" name="department" value={filters.department} onChange={handleFilter} />
          <div style={styles.fieldWrap}>
            <label style={styles.filterLabel}>Status</label>
            <select name="status" value={filters.status} onChange={handleFilter} style={styles.filterInput}>
              <option value="">All</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
          <FilterField label="Search (name / ID)" name="search" value={filters.search} onChange={handleFilter} />
        </div>
        <div style={styles.filterActions}>
          <button onClick={() => fetchRecords(1)} style={styles.applyBtn}>Apply Filters</button>
          <button onClick={clearFilters} style={styles.clearBtn}>Clear</button>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? <LoadingSpinner /> : (
        <>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Employee ID', 'Name', 'Department', 'Position', 'Date', 'Morning In', 'Lunch Out (Auto)', 'After-Lunch In', 'Evening Out', 'Status', 'Confidence'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td colSpan={11} style={styles.empty}>No records match the current filters.</td></tr>
                )}
                {records.map((r) => (
                  <tr key={r._id} style={styles.tr}>
                    <td style={styles.td}><code style={styles.empId}>{r.employeeId}</code></td>
                    <td style={styles.td}><strong>{r.fullName}</strong></td>
                    <td style={styles.td}>{r.department}</td>
                    <td style={styles.td}><span style={styles.smallText}>{r.position}</span></td>
                    <td style={styles.td}>{formatEthiopianDate(r.date)}</td>
                    <td style={styles.td}>
                      {r.checkInTime
                        ? formatEthiopianTime(r.checkInTime)
                        : '—'}
                    </td>
                    <td style={styles.td}>
                      {r.checkOutTime
                        ? <span style={{ color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
                            {formatEthiopianTime(r.checkOutTime)}
                          </span>
                        : <span style={{ color: '#475569' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {r.afterLunchCheckIn
                        ? <span style={{ color: '#6093fa', fontVariantNumeric: 'tabular-nums' }}>
                            {formatEthiopianTime(r.afterLunchCheckIn)}
                          </span>
                        : <span style={{ color: '#475569' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {r.afterLunchCheckOut
                        ? <span style={{ color: '#8bb0fa', fontVariantNumeric: 'tabular-nums' }}>
                            {formatEthiopianTime(r.afterLunchCheckOut)}
                          </span>
                        : <span style={{ color: '#475569' }}>—</span>}
                    </td>
                    <td style={styles.td}><StatusBadge status={r.status} /></td>
                    <td style={styles.td}>
                      {r.matchConfidence !== null && r.matchConfidence !== undefined
                        ? <ConfidenceBar value={r.matchConfidence} />
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div style={styles.pagination}>
              <button disabled={pagination.page <= 1} onClick={() => fetchRecords(pagination.page - 1)} style={styles.pageBtn}>← Prev</button>
              <span style={styles.pageInfo}>Page {pagination.page} of {pagination.totalPages}</span>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchRecords(pagination.page + 1)} style={styles.pageBtn}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterField({ label, name, value, onChange, type = 'text' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      <input type={type} name={name} value={value} onChange={onChange}
        style={{ padding: '7px 10px', border: '1px solid #e2e7f0', borderRadius: 6, fontSize: 13, outline: 'none' }} />
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { Present: ['#dcfce7','#16a34a'], Late: ['#fef9c3','#ca8a04'], Absent: ['#fee2e2','#dc2626'] };
  const [bg, fg] = map[status] ?? ['#f1f4f9','#64748b'];
  return <span style={{ background: bg, color: fg, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{status}</span>;
}

function ConfidenceBar({ value }) {
  // Lower distance = better match. 0.6 is the threshold.
  const pct = Math.max(0, Math.round((1 - value / 0.6) * 100));
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 50, height: 6, background: '#e1e6f1', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: '#64748b' }}>{value.toFixed(3)}</span>
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  pageTitle: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f182a' },
  pageSub: { margin: 0, color: '#64748b', fontSize: 13 },
  filterCard: { background: '#f4f8ff', borderRadius: 12, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px 16px', marginBottom: 14 },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' },
  filterInput: { padding: '7px 10px', border: '1px solid #e2e7f0', borderRadius: 6, fontSize: 13, background: '#f4f8ff' },
  filterActions: { display: 'flex', gap: 10 },
  applyBtn: { background: '#3c7af5', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  clearBtn: { background: '#f1f4f9', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: '#475569' },
  error: { background: '#f1f5fe', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 12 },
  tableWrap: { background: '#f4f8ff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f4f6fa', borderBottom: '1px solid #e2e7f0', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1f4f9' },
  td: { padding: '11px 14px', fontSize: 13, color: '#333e55', verticalAlign: 'middle' },
  empId: { background: '#f1f4f9', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' },
  smallText: { color: '#64748b', fontSize: 12 },
  empty: { textAlign: 'center', padding: 32, color: '#94a0b8', fontSize: 14 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
  pageBtn: { background: '#f4f8ff', border: '1px solid #e2e7f0', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
  pageInfo: { fontSize: 13, color: '#64748b' },
};
