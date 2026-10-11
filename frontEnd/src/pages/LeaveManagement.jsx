import { useEffect, useState } from 'react';
import { CalendarDays, Check, X, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { leaveService } from '../services/leaveService';
import Spinner from '../components/Spinner';

const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '9px', border: '1px solid #333e55', background: '#1c273d', color: '#e2e7f0', fontSize: '0.875rem' };
const card = { background: '#0f182a', border: '1px solid #1e283b', borderRadius: '16px', padding: '22px' };
const label = { display: 'block', marginBottom: '6px', color: '#94a0b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' };

export default function LeaveManagement() {
  const { user } = useAuth();
  return user?.role === 'employee' ? <EmployeeLeaves /> : <AdminLeaves />;
}

function EmployeeLeaves() {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ type: 'annual', startDate: '', endDate: '', reason: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const load = () => leaveService.list().then(setRequests).catch(err => setMessage(err.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const submit = async event => { event.preventDefault(); setMessage(''); try { const result = await leaveService.create(form); setMessage(result.message); setForm({ type: 'annual', startDate: '', endDate: '', reason: '' }); load(); } catch (err) { setMessage(err.message); } };
  return <Page title="My Leave Requests" subtitle="Submit leave and track approval status.">
    <div style={{ ...card, maxWidth: 720 }}>
      <h2 style={sectionTitle}><CalendarDays size={17} /> New leave request</h2>
      <form onSubmit={submit} style={formGrid}>
        <div><label style={label}>Leave type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={input}><option value="annual">Annual leave</option><option value="sick">Sick leave</option><option value="personal">Personal leave</option><option value="other">Other</option></select></div>
        <div><label style={label}>Start date</label><input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} style={input} /></div>
        <div><label style={label}>End date</label><input type="date" required value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} style={input} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={label}>Reason</label><textarea required rows={4} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={{ ...input, resize: 'vertical' }} /></div>
        {message && <Notice>{message}</Notice>}
        <button type="submit" style={primaryButton}><Send size={15} /> Submit request</button>
      </form>
    </div>
    <RequestList requests={requests} loading={loading} />
  </Page>;
}

function AdminLeaves() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const load = () => leaveService.list().then(setRequests).catch(err => setMessage(err.message));
  useEffect(() => { load(); }, []);
  const review = async (request, status) => { try { await leaveService.review(request._id, { status }); setMessage(`Request ${status}.`); load(); } catch (err) { setMessage(err.message); } };
  return <Page title="Leave Management" subtitle="Review employee leave requests and approve or reject them.">
    {message && <Notice>{message}</Notice>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {requests.length === 0 && <div style={card}><p style={{ margin: 0, color: '#64748b' }}>No leave requests yet.</p></div>}
      {requests.map(request => <div key={request._id} style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div><h2 style={{ margin: 0, color: '#f1f4f9', fontSize: '0.98rem' }}>{request.employee?.fullName || 'Employee'}</h2><p style={{ margin: '5px 0', color: '#64748b', fontSize: '0.78rem' }}>{request.employee?.employeeId} · {request.employee?.department}</p></div>
          <Status status={request.status} />
        </div>
        <p style={{ color: '#cbd2e1', fontSize: '0.86rem', margin: '14px 0 8px' }}><strong>{request.type}</strong> · {request.startDate} to {request.endDate}</p>
        <p style={{ color: '#94a0b8', margin: '0 0 16px', lineHeight: 1.5 }}>{request.reason}</p>
        {request.status === 'pending' && <div style={{ display: 'flex', gap: 8 }}><button onClick={() => review(request, 'approved')} style={{ ...primaryButton, background: '#153980' }}><Check size={14} /> Approve</button><button onClick={() => review(request, 'rejected')} style={{ ...primaryButton, background: '#1b4599' }}><X size={14} /> Reject</button></div>}
      </div>)}
    </div>
  </Page>;
}

function RequestList({ requests, loading }) { return <div><h2 style={{ ...sectionTitle, color: '#f1f4f9' }}>Request history</h2>{loading ? <Spinner /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{requests.map(request => <div key={request._id} style={{ ...card, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><strong style={{ color: '#e2e7f0' }}>{request.type}</strong><p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.8rem' }}>{request.startDate} to {request.endDate}</p></div><Status status={request.status} /></div>)}</div>}</div>; }
function Page({ title, subtitle, children }) { return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}><header><h1 style={{ margin: 0, color: '#f8f9fc', fontSize: '1.5rem', fontWeight: 800 }}>{title}</h1><p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.875rem' }}>{subtitle}</p></header>{children}</div>; }
function Status({ status }) { const colors = { pending: ['#fbbf24', 'rgba(180,83,9,.2)'], approved: ['#4ade80', 'rgba(21,128,61,.2)'], rejected: ['#f87171', 'rgba(185,28,28,.2)'] }; const [color, background] = colors[status] || colors.pending; return <span style={{ alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 999, color, background, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{status}</span>; }
function Notice({ children }) { return <div style={{ gridColumn: '1 / -1', color: '#86efac', background: 'rgba(21, 57, 128,.2)', border: '1px solid #166534', borderRadius: 9, padding: '10px 12px', fontSize: '0.85rem' }}>{children}</div>; }
const sectionTitle = { display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px', color: '#cbd2e1', fontSize: '0.95rem' };
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 };
const primaryButton = { display: 'inline-flex', alignItems: 'center', gap: 7, width: 'fit-content', border: 0, borderRadius: 9, padding: '10px 15px', background: '#2567eb', color: '#fff', cursor: 'pointer', fontWeight: 700 };
