import { useEffect, useState } from 'react';
import { Bell, Send, AlertTriangle, MessageSquare, Check, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import Spinner from '../components/Spinner';
import { formatEthiopianDateTime } from '../utils/ethiopianDateTime';

const pageStyle = { color: '#e2e7f0', display: 'flex', flexDirection: 'column', gap: '24px' };
const cardStyle = { background: '#0f182a', border: '1px solid #1e283b', borderRadius: '16px', padding: '24px' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: '10px', border: '1px solid #333e55', background: '#1c273d', color: '#e2e7f0', outline: 'none', fontSize: '0.875rem' };
const labelStyle = { display: 'block', marginBottom: '7px', color: '#94a0b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' };

export default function Notifications() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminNotifications /> : <EmployeeNotifications />;
}

function AdminNotifications() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ recipientId: '', sendToAll: true, type: 'warning', subject: 'Attendance warning', message: '' });
  const [status, setStatus] = useState({ error: '', success: '' });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    userService.getAll({ limit: 200 }).then(data => setEmployees(data.employees.filter(employee => employee.role === 'employee' && employee.isActive))).catch(error => setStatus({ error: error.message, success: '' })).finally(() => setLoading(false));
  }, []);

  const setField = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  const send = async event => {
    event.preventDefault();
    setStatus({ error: '', success: '' });
    setSending(true);
    try {
      const response = await notificationService.send(form);
      setStatus({ error: '', success: response.message });
      setForm(previous => ({ ...previous, message: '' }));
    } catch (error) {
      setStatus({ error: error.message, success: '' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={pageStyle}>
      <header>
        <h1 style={{ margin: 0, color: '#f8f9fc', fontSize: '1.5rem', fontWeight: 800 }}>Messages & Warnings</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.875rem' }}>Send an attendance warning or message to one employee or all active employees.</p>
      </header>

      <div style={{ ...cardStyle, maxWidth: '760px' }}>
        {loading ? <Spinner /> : (
          <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setForm(previous => ({ ...previous, type: 'warning', subject: 'Attendance warning' }))} style={choiceStyle(form.type === 'warning', '#f59e0b')}><AlertTriangle size={16} /> Late attendance warning</button>
              <button type="button" onClick={() => setForm(previous => ({ ...previous, type: 'message', subject: '' }))} style={choiceStyle(form.type === 'message', '#3b79f6')}><MessageSquare size={16} /> General message</button>
            </div>

            <div>
              <label style={labelStyle}>Recipients</label>
              <select value={form.sendToAll ? 'all' : form.recipientId} onChange={event => { const value = event.target.value; setForm(previous => ({ ...previous, sendToAll: value === 'all', recipientId: value === 'all' ? '' : value })); }} style={inputStyle}>
                <option value="all">All active employees</option>
                {employees.map(employee => <option key={employee._id} value={employee._id}>{employee.fullName} · {employee.department}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Subject</label>
              <input name="subject" value={form.subject} onChange={setField} required maxLength={140} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Message</label>
              <textarea name="message" value={form.message} onChange={setField} required maxLength={2000} rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            {status.error && <Notice tone="error">{status.error}</Notice>}
            {status.success && <Notice tone="success">{status.success}</Notice>}

            <button type="submit" disabled={sending} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px', border: 0, borderRadius: '10px', padding: '11px 18px', background: '#2567eb', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: sending ? 0.6 : 1 }}>
              <Send size={15} /> {sending ? 'Sending...' : 'Send notification'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function EmployeeNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => notificationService.list().then(setNotifications).catch(err => setError(err.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const markRead = async notification => {
    if (notification.readAt) return;
    try {
      const updated = await notificationService.markRead(notification._id);
      setNotifications(previous => previous.map(item => item._id === updated._id ? updated : item));
    } catch (err) { setError(err.message); }
  };

  return (
    <div style={pageStyle}>
      <header>
        <h1 style={{ margin: 0, color: '#f8f9fc', fontSize: '1.5rem', fontWeight: 800 }}>My Notifications</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.875rem' }}>Attendance warnings and messages from the administrator.</p>
      </header>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? <Spinner /> : notifications.length === 0 ? <div style={cardStyle}><p style={{ margin: 0, color: '#64748b' }}>No messages yet.</p></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map(notification => (
            <button key={notification._id} onClick={() => markRead(notification)} style={{ ...cardStyle, width: '100%', textAlign: 'left', cursor: notification.readAt ? 'default' : 'pointer', borderColor: notification.readAt ? '#1e283b' : notification.type === 'warning' ? 'rgba(245,158,11,0.55)' : 'rgba(59, 121, 246,0.55)', opacity: notification.readAt ? 0.78 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ color: notification.type === 'warning' ? '#fbbf24' : '#6093fa' }}>{notification.type === 'warning' ? <AlertTriangle size={20} /> : <Bell size={20} />}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}><h2 style={{ margin: 0, color: '#f1f4f9', fontSize: '0.95rem' }}>{notification.subject}</h2>{!notification.readAt && <span style={{ color: '#6093fa', fontSize: '0.7rem', fontWeight: 700 }}>NEW</span>}</div>
                  <p style={{ margin: '8px 0', color: '#cbd2e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{notification.message}</p>
                  <small style={{ color: '#64748b' }}>{formatEthiopianDateTime(notification.createdAt)}</small>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function choiceStyle(active, color) {
  return { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 12px', borderRadius: '9px', border: `1px solid ${active ? color : '#333e55'}`, background: active ? `${color}22` : '#1c273d', color: active ? color : '#94a0b8', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' };
}

function Notice({ tone, children }) {
  const color = tone === 'error' ? '#fca5a5' : '#86efac';
  return <div style={{ padding: '11px 13px', borderRadius: '9px', color, background: tone === 'error' ? 'rgba(29, 62, 127,0.3)' : 'rgba(21, 57, 128,0.2)', border: `1px solid ${tone === 'error' ? '#991b1b' : '#166534'}`, fontSize: '0.875rem' }}>{children}</div>;
}
