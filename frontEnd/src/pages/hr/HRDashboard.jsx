import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardList, Users } from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import Spinner from '../../components/Spinner';

const cardStyle = {
  background: '#0f182a',
  border: '1px solid #1e283b',
  borderRadius: '16px',
  padding: '22px',
};

export default function HRDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    attendanceService.getDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) {
    return (
      <div role="alert" style={{ color: '#fca5a5', background: 'rgba(29, 62, 127,0.3)', border: '1px solid #991b1b', borderRadius: '10px', padding: '14px 18px' }}>
        Unable to load the HR dashboard: {error}
      </div>
    );
  }

  const { summary } = data;
  const metrics = [
    { label: 'Employees', value: summary.totalEmployees, color: '#6093fa' },
    { label: 'Present today', value: summary.presentToday, color: '#4ade80' },
    { label: 'Late today', value: summary.lateToday, color: '#fbbf24' },
    { label: 'Absent today', value: summary.absentToday, color: '#f87171' },
  ];
  const actions = [
    { to: '/hr/employees', icon: Users, title: 'Employee Directory', text: 'Search employee records and review department information.' },
    { to: '/hr/reports', icon: ClipboardList, title: 'Attendance Reports', text: 'Review attendance activity and export workforce reports.' },
    { to: '/hr/leaves', icon: CalendarDays, title: 'Leave Reviews', text: 'Review pending leave requests and record decisions.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <header>
        <p style={{ color: '#6093fa', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
          Human Resources
        </p>
        <h1 style={{ color: '#f1f4f9', fontSize: '1.6rem', fontWeight: 800, margin: '0 0 8px' }}>
          Workforce Overview
        </h1>
        <p style={{ color: '#94a0b8', margin: 0 }}>
          Review employee information, attendance, and leave requests.
        </p>
      </header>

      <section aria-label="Today's attendance summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        {metrics.map(metric => (
          <div key={metric.label} style={cardStyle}>
            <p style={{ color: '#94a0b8', fontSize: '0.8rem', margin: '0 0 12px' }}>{metric.label}</p>
            <strong style={{ color: metric.color, fontSize: '2rem' }}>{metric.value}</strong>
          </div>
        ))}
      </section>

      <section aria-label="HR tools" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
        {actions.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} style={{ ...cardStyle, color: 'inherit', textDecoration: 'none', transition: 'border-color 0.15s' }}>
            <Icon size={20} color="#6093fa" />
            <h2 style={{ color: '#f1f4f9', fontSize: '1rem', margin: '16px 0 8px' }}>{title}</h2>
            <p style={{ color: '#94a0b8', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>{text}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
