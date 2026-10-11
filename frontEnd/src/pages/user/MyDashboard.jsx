import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatEthiopianDate, formatEthiopianTime, getAddisAbabaDateString } from '../../utils/ethiopianDateTime';

export default function MyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats]         = useState(null);
  const [recent, setRecent]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([
      attendanceService.getMyStats(),
      attendanceService.getMine({ limit: 7 }),
    ])
      .then(([s, r]) => {
        setStats(s);
        setRecent(r.records);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error)   return <p style={styles.error}>{error}</p>;

  const attendanceRate = stats?.totalDays > 0
    ? Math.round(((stats.presentDays + stats.lateDays) / stats.totalDays) * 100)
    : 0;

  return (
    <div>
      {/* Welcome banner */}
      <div style={styles.banner}>
        <div>
          <h2 style={styles.bannerTitle}>Welcome back, {user.fullName.split(' ')[0]} 👋</h2>
          <p style={styles.bannerSub}>{user.position} · {user.department}</p>
        </div>
        <div style={styles.empIdBadge}>
          <span style={styles.empIdLabel}>Employee ID</span>
          <span style={styles.empIdValue}>{user.employeeId}</span>
        </div>
      </div>

      {/* KPI cards */}
      <div style={styles.kpiGrid}>
        <KpiCard label="Days Present"  value={stats?.presentDays  ?? 0} color="#22c55e" icon="✅" />
        <KpiCard label="Days Late"     value={stats?.lateDays     ?? 0} color="#f59e0b" icon="⏰" />
        <KpiCard label="Days Absent"   value={stats?.absentDays   ?? 0} color="#ef4444" icon="❌" />
        <KpiCard label="Attendance Rate" value={`${attendanceRate}%`}   color="#3b79f6" icon="📊" />
      </div>

      {/* Today's status */}
      <TodayStatus recentRecords={recent} />

      {/* Recent history */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Recent Activity</h3>
          <button onClick={() => navigate('/me/attendance')} style={styles.viewAllBtn}>View all →</button>
        </div>
        {recent.length === 0 && <p style={styles.emptyText}>No attendance records yet.</p>}
        {recent.map((r) => (
          <div key={r._id} style={styles.recentRow}>
            <div>
              <p style={styles.recentDate}>{formatEthiopianDate(r.date)}</p>
              <p style={styles.recentTime}>
                Check-in: {formatEthiopianTime(r.checkInTime)}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayStatus({ recentRecords }) {
  const today = getAddisAbabaDateString();
  const todayRecord = recentRecords.find((r) => r.date === today);

  return (
    <div style={{ ...styles.card, marginBottom: 16 }}>
      <h3 style={styles.cardTitle}>Today — {formatEthiopianDate(today)}</h3>
      {todayRecord ? (
        <div style={styles.todayRow}>
          <span style={{ fontSize: 32 }}>
            {todayRecord.status === 'Present' ? '✅' : todayRecord.status === 'Late' ? '⏰' : '❌'}
          </span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#0f182a' }}>
              {todayRecord.status === 'Present' ? 'On Time' : todayRecord.status === 'Late' ? 'Arrived Late' : 'Absent'}
            </p>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
              Checked in at {formatEthiopianTime(todayRecord.checkInTime)}
            </p>
          </div>
        </div>
      ) : (
        <p style={{ color: '#94a0b8', fontSize: 14 }}>You have not checked in today yet. Head to the kiosk to check in.</p>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, icon }) {
  return (
    <div style={{ ...styles.kpiCard, borderTop: `4px solid ${color}` }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <p style={{ ...styles.kpiValue, color }}>{value}</p>
      <p style={styles.kpiLabel}>{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { Present: ['#dcfce7','#16a34a'], Late: ['#fef9c3','#ca8a04'], Absent: ['#fee2e2','#dc2626'] };
  const [bg, fg] = map[status] ?? ['#f1f4f9','#64748b'];
  return <span style={{ background: bg, color: fg, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{status}</span>;
}

const styles = {
  banner: {
    background: 'linear-gradient(135deg, #1c273d 0%, #1e4eaf 100%)',
    borderRadius: 14,
    padding: '24px 28px',
    color: '#fff',
    marginBottom: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTitle: { margin: '0 0 4px', fontSize: 22, fontWeight: 700 },
  bannerSub: { margin: 0, opacity: 0.75, fontSize: 14 },
  empIdBadge: { textAlign: 'right' },
  empIdLabel: { display: 'block', fontSize: 11, opacity: 0.6, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' },
  empIdValue: { fontSize: 18, fontWeight: 700, fontFamily: 'monospace' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 20 },
  kpiCard: { background: '#f4f8ff', borderRadius: 12, padding: '18px 16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  kpiValue: { fontSize: 28, fontWeight: 800, margin: '8px 0 4px' },
  kpiLabel: { margin: 0, color: '#64748b', fontSize: 12, fontWeight: 500 },
  card: { background: '#f4f8ff', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: '#0f182a' },
  viewAllBtn: { background: 'none', border: 'none', color: '#3b79f6', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 },
  todayRow: { display: 'flex', alignItems: 'center', gap: 14 },
  recentRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f4f9' },
  recentDate: { margin: 0, fontWeight: 600, fontSize: 13, color: '#1e283b' },
  recentTime: { margin: 0, fontSize: 12, color: '#94a0b8' },
  emptyText: { color: '#94a0b8', fontSize: 13, textAlign: 'center', padding: 12 },
  error: { color: '#dc2626', padding: 16 },
};
