import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { attendanceService } from '../../services/attendanceService';
import Spinner from '../../components/Spinner';
import {
  Users, UserCheck, UserX, Clock,
  TrendingUp, ChevronRight,
} from 'lucide-react';
import { formatEthiopianTime } from '../../utils/ethiopianDateTime';

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

/* ── Shared inline style tokens ─────────────────────────────────────────── */
const CARD = {
  background:   '#0f182a',
  border:       '1px solid #1e283b',
  borderRadius: '16px',
  padding:      '24px',
};

export default function AdminDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const navigate = useNavigate();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await attendanceService.getDashboard());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) return <Spinner />;
  if (error)   return <ErrBox msg={error} onRetry={loadDashboard} />;

  const { summary, recentCheckIns, monthlyTrend, deptStats } = data;

  const pieData = [
    { name: 'Present', value: summary.presentToday },
    { name: 'Late',    value: summary.lateToday    },
    { name: 'Absent',  value: summary.absentToday  },
  ];

  return (
    /* space-y-8 = 32 px between every section */
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── Page heading ── */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f4f9', margin: '0 0 4px', letterSpacing: '-0.025em' }}>
          MAU Admin Control Center
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
          Manage all employees, control department attendance, configure system settings, send notifications,
          and export daily, weekly, monthly, quarterly and yearly staff records.
        </p>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <KpiCard label="Total Employees" value={summary.totalEmployees} icon={Users}     color="blue"  />
        <KpiCard label="Present Today"   value={summary.presentToday}   icon={UserCheck} color="green" />
        <KpiCard label="Late Today"      value={summary.lateToday}      icon={Clock}     color="amber" />
        <KpiCard label="Absent Today"    value={summary.absentToday}    icon={UserX}     color="red"   />
      </div>

      {/* ── Charts row (monthly trend 2/3 + today pie 1/3) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>

        {/* Monthly trend */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <TrendingUp size={15} color="#64748b" />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd2e1' }}>Monthly Attendance Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#94a0b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a0b8' }} />
              <Tooltip contentStyle={{ background: '#1c273d', border: '1px solid #333e55', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="present" name="Present" fill="#22c55e" radius={[3,3,0,0]} />
              <Bar dataKey="late"    name="Late"    fill="#f59e0b" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Today breakdown pie */}
        <div style={CARD}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd2e1', margin: '0 0 20px' }}>
            Today's Breakdown
          </p>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a0b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom row (dept stats + recent check-ins) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Department bar */}
        <div style={CARD}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd2e1', margin: '0 0 20px' }}>
            Today by Department
          </p>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={deptStats} layout="vertical" margin={{ top: 0, right: 8, left: 60, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a0b8' }} />
              <YAxis dataKey="_id" type="category" tick={{ fontSize: 10, fill: '#94a0b8' }} />
              <Tooltip contentStyle={{ background: '#1c273d', border: '1px solid #333e55', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="Check-ins" fill="#3b79f6" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent check-ins list */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#cbd2e1' }}>Recent Check-ins</span>
            <button
              onClick={() => navigate('/admin/reports')}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', color: '#6093fa',
                padding: 0, transition: 'color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#93b6fd'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6093fa'; }}
            >
              View all <ChevronRight size={12} />
            </button>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {recentCheckIns.length === 0 && (
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', padding: '16px 0' }}>
                No check-ins today.
              </p>
            )}
            {recentCheckIns.map(r => (
              <div key={r._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid #1e283b',
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#e2e7f0' }}>{r.fullName}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{r.department}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 3px', fontSize: '0.75rem', color: '#94a0b8' }}>
                    {formatEthiopianTime(r.checkInTime)}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
const kpiColors = {
  blue:  { bg: 'rgba(29, 91, 216,0.12)',  border: '#1e428a', icon: '#6093fa', val: '#6093fa'  },
  green: { bg: 'rgba(21, 57, 128,0.12)',  border: '#14532d', icon: '#4ade80', val: '#4ade80'  },
  amber: { bg: 'rgba(9, 66, 180,0.12)',   border: '#78350f', icon: '#fbbf24', val: '#fbbf24'  },
  red:   { bg: 'rgba(28, 80, 185,0.12)',  border: '#7f1d1d', icon: '#f87171', val: '#f87171'  },
};

function KpiCard({ label, value, icon: Icon, color }) {
  const c = kpiColors[color];
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '16px', padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
            {label}
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 800, color: c.val, margin: 0, lineHeight: 1 }}>
            {value}
          </p>
        </div>
        <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(28, 39, 61,0.6)' }}>
          <Icon size={18} color={c.icon} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    Present: { bg: 'rgba(21, 57, 128,0.3)',  color: '#86efac', border: 'rgba(21,128,61,0.5)'  },
    Late:    { bg: 'rgba(9, 66, 180,0.3)',   color: '#fcd34d', border: 'rgba(180,83,9,0.5)'   },
    Absent:  { bg: 'rgba(28, 80, 185,0.3)',  color: '#fca5a5', border: 'rgba(185,28,28,0.5)'  },
  };
  const s = map[status] ?? { bg: 'rgba(28, 39, 61,0.5)', color: '#94a0b8', border: '#333e55' };
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.6875rem', fontWeight: 700,
      padding: '2px 8px', borderRadius: '999px',
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {status}
    </span>
  );
}

function ErrBox({ msg, onRetry }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '12px',
      background: 'rgba(29, 62, 127,0.3)', border: '1px solid #991b1b',
      color: '#fca5a5', fontSize: '0.875rem',
    }}>
      {msg}
      <button
        onClick={onRetry}
        style={{
          display: 'block',
          marginTop: '12px',
          padding: '8px 12px',
          borderRadius: '8px',
          background: '#1c273d',
          border: '1px solid #475569',
          color: '#e2e7f0',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}
