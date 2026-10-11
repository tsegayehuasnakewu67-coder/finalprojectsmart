import { useState, useEffect, useCallback } from 'react';
import { attendanceService } from '../../services/attendanceService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatEthiopianDate, formatEthiopianTime } from '../../utils/ethiopianDateTime';

export default function MyAttendance() {
  const [records, setRecords]       = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');

  const fetchRecords = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 30 };
      if (startDate) params.startDate = startDate;
      if (endDate)   params.endDate   = endDate;
      const data = await attendanceService.getMine(params);
      setRecords(data.records);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchRecords(1); }, [fetchRecords]);

  // Summary counts from current page (use stats endpoint for accurate totals ideally)
  const presentCount = records.filter((r) => r.status === 'Present').length;
  const lateCount    = records.filter((r) => r.status === 'Late').length;

  return (
    <div>
      <h2 style={styles.pageTitle}>My Attendance History</h2>
      <p style={styles.pageSub}>{pagination.total} total records</p>

      {/* Date range filter */}
      <div style={styles.filterBar}>
        <div style={styles.filterField}>
          <label style={styles.filterLabel}>From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.dateInput} />
        </div>
        <div style={styles.filterField}>
          <label style={styles.filterLabel}>To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={styles.dateInput} />
        </div>
        <button onClick={() => fetchRecords(1)} style={styles.applyBtn}>Apply</button>
        <button onClick={() => { setStartDate(''); setEndDate(''); }} style={styles.clearBtn}>Clear</button>

        {/* Mini summary */}
        <div style={styles.mini}>
          <span style={styles.miniBadge('#dcfce7', '#16a34a')}>✅ {presentCount} Present</span>
          <span style={styles.miniBadge('#fef9c3', '#ca8a04')}>⏰ {lateCount} Late</span>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Mobile-friendly card list */}
          <div style={styles.list}>
            {records.length === 0 && <p style={styles.empty}>No attendance records in this date range.</p>}
            {records.map((r) => (
              <div key={r._id} style={styles.recordCard}>
                <div style={styles.recordLeft}>
                  <StatusIcon status={r.status} />
                  <div>
                    <p style={styles.recordDate}>{formatDate(r.date)}</p>
                    <p style={styles.recordTime}>
                      Check-in: <strong>{formatEthiopianTime(r.checkInTime)}</strong>
                    </p>
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
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

function StatusIcon({ status }) {
  const map = { Present: '✅', Late: '⏰', Absent: '❌' };
  return <span style={{ fontSize: 22, flexShrink: 0 }}>{map[status] ?? '❓'}</span>;
}

function StatusBadge({ status }) {
  const map = { Present: ['#dcfce7','#16a34a'], Late: ['#fef9c3','#ca8a04'], Absent: ['#fee2e2','#dc2626'] };
  const [bg, fg] = map[status] ?? ['#f1f4f9','#64748b'];
  return <span style={{ background: bg, color: fg, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{status}</span>;
}

function formatDate(dateStr) {
  return formatEthiopianDate(dateStr, { weekday: 'short' });
}

const styles = {
  pageTitle: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f182a' },
  pageSub:   { margin: '0 0 20px', color: '#64748b', fontSize: 13 },
  filterBar: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, background: '#f4f8ff', borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  filterField: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' },
  dateInput: { padding: '7px 10px', border: '1px solid #e2e7f0', borderRadius: 7, fontSize: 13 },
  applyBtn: { background: '#3c7af5', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  clearBtn: { background: '#f1f4f9', border: 'none', borderRadius: 7, padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: '#475569' },
  mini: { display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' },
  miniBadge: (bg, fg) => ({ background: bg, color: fg, borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }),
  error: { background: '#f1f5fe', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  recordCard: { background: '#f4f8ff', borderRadius: 12, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  recordLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  recordDate: { margin: '0 0 3px', fontWeight: 700, fontSize: 14, color: '#1e283b' },
  recordTime: { margin: 0, fontSize: 12, color: '#64748b' },
  empty: { textAlign: 'center', padding: 32, color: '#94a0b8', fontSize: 14 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
  pageBtn: { background: '#f4f8ff', border: '1px solid #e2e7f0', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
  pageInfo: { fontSize: 13, color: '#64748b' },
};
