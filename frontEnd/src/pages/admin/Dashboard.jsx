import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { attendanceService } from '../../services/attendanceService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatEthiopianDate, formatEthiopianTime } from '../../utils/ethiopianDateTime';

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    attendanceService.getDashboard()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error)   return <p style={styles.error}>{error}</p>;
  if (!stats)  return null;

  const { summary, recentCheckIns, monthlyTrend, departmentStats } = stats;

  const pieData = [
    { name: 'Present',  value: summary.presentToday },
    { name: 'Late',     value: summary.lateToday },
    { name: 'Absent',   value: summary.absentToday },
  ];

  return (
    <div>
      <h2 style={styles.pageTitle}>Dashboard</h2>
      <p style={styles.pageSub}>{formatEthiopianDate(new Date(), { weekday: 'long' })}</p>

      {/* ── KPI Cards ── */}
      <div style={styles.kpiGrid}>
        <KpiCard label="Total Employees"   value={summary.totalEmployees}  color="#3b79f6" icon="👥" />
        <KpiCard label="Present Today"     value={summary.presentToday}    color="#22c55e" icon="✅" />
        <KpiCard label="Late Today"        value={summary.lateToday}       color="#f59e0b" icon="⏰" />
        <KpiCard label="Absent Today"      value={summary.absentToday}     color="#ef4444" icon="❌" />
      </div>

      {/* ── Charts Row ── */}
      <div style={styles.chartsRow}>
        {/* Monthly trend */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Monthly Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="present" name="Present" fill="#22c55e" radius={[3,3,0,0]} />
              <Bar dataKey="late"    name="Late"    fill="#f59e0b" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Today's breakdown pie */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Today's Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div style={styles.chartsRow}>
        {/* Department stats */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Today by Department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={departmentStats} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="_id" type="category" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Check-ins" fill="#3b79f6" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent check-ins */}
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Recent Check-ins</h3>
          <div style={styles.recentList}>
            {recentCheckIns.length === 0 && <p style={{ color: '#94a0b8', fontSize: 13 }}>No check-ins today yet.</p>}
            {recentCheckIns.map((r) => (
              <div key={r._id} style={styles.recentRow}>
                <div>
                  <p style={styles.recentName}>{r.fullName}</p>
                  <p style={styles.recentDept}>{r.department}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={styles.recentTime}>
                    {formatEthiopianTime(r.checkInTime)}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/admin/attendance')}
            style={styles.viewAllBtn}
          >
            View full log →
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, icon }) {
  return (
    <div style={{ ...styles.kpiCard, borderTop: `4px solid ${color}` }}>
      <span style={styles.kpiIcon}>{icon}</span>
      <p style={{ ...styles.kpiValue, color }}>{value}</p>
      <p style={styles.kpiLabel}>{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { Present: ['#dcfce7','#16a34a'], Late: ['#fef9c3','#ca8a04'], Absent: ['#fee2e2','#dc2626'] };
  const [bg, fg] = map[status] ?? ['#f1f4f9','#64748b'];
  return <span style={{ background: bg, color: fg, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{status}</span>;
}

const styles = {
  pageTitle: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f182a' },
  pageSub:   { margin: '0 0 24px', color: '#64748b', fontSize: 13 },
  error: { color: '#dc2626', padding: 16 },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    background: '#f4f8ff',
    borderRadius: 12,
    padding: '20px 20px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
    textAlign: 'center',
  },
  kpiIcon:  { fontSize: 26 },
  kpiValue: { fontSize: 32, fontWeight: 800, margin: '8px 0 4px' },
  kpiLabel: { margin: 0, color: '#64748b', fontSize: 12, fontWeight: 500 },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  chartCard: {
    background: '#f4f8ff',
    borderRadius: 12,
    padding: '20px 20px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
  },
  chartTitle: { margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#374151' },
  recentList: { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 180, overflowY: 'auto' },
  recentRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f4f9' },
  recentName: { margin: 0, fontSize: 13, fontWeight: 600, color: '#1e283b' },
  recentDept: { margin: 0, fontSize: 11, color: '#94a0b8' },
  recentTime: { margin: '0 0 3px', fontSize: 12, fontWeight: 600, color: '#475569' },
  viewAllBtn: {
    marginTop: 12,
    background: 'none',
    border: 'none',
    color: '#3b79f6',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
};
