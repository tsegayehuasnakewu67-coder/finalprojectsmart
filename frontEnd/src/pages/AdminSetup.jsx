/**
 * AdminSetup — First-time admin account creation.
 * Accessible at /setup. Redirects to /login on success.
 * The backend blocks this endpoint if an admin already exists.
 * No employeeId field — backend auto-generates it as ADMIN-<timestamp>.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Building2, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';

const INIT = { fullName: '', email: '', password: '', confirmPassword: '' };

export default function AdminSetup() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState(INIT);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [showCf,  setShowCf]  = useState(false);

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    if (form.password.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(form.password)) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.'); return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/setup-admin', {
        fullName:        form.fullName.trim(),
        email:           form.email.trim(),
        password:        form.password,
        confirmPassword: form.confirmPassword,
      });
      setSuccess(res.data.message + ' Redirecting to sign in…');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="legacy-page min-h-screen bg-[#020917] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'32px' }}>
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50"
            style={{ marginBottom:'16px' }}>
            <Building2 size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Smart Attendance System</h1>
          <p className="text-sm text-slate-500" style={{ marginTop:'4px' }}>First-Time Setup</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl"
          style={{ padding:'28px 24px 32px' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'24px' }}>
            <ShieldCheck size={18} className="text-blue-400" style={{ flexShrink:0 }} />
            <div>
              <h2 className="text-base font-bold text-slate-200" style={{ lineHeight:1.3 }}>
                Create Admin Account
              </h2>
              <p className="text-xs text-slate-500" style={{ marginTop:'2px' }}>
                This can only be done once
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate autoComplete="off">

            {/* Full Name */}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                name="fullName" type="text" value={form.fullName} onChange={set}
                autoComplete="off" required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Email */}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Email Address <span className="text-red-400">*</span>
              </label>
              <input
                name="email" type="email" value={form.email} onChange={set}
                autoComplete="off" required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Password <span className="text-red-400">*</span>
              </label>
              <div style={{ position:'relative' }}>
                <input
                  name="password" type={showPw ? 'text' : 'password'}
                  value={form.password} onChange={set}
                  autoComplete="new-password" required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ paddingRight:'40px' }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'24px' }}>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <div style={{ position:'relative' }}>
                <input
                  name="confirmPassword" type={showCf ? 'text' : 'password'}
                  value={form.confirmPassword} onChange={set}
                  autoComplete="new-password" required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  style={{ paddingRight:'40px' }}
                />
                <button type="button" onClick={() => setShowCf(p => !p)} tabIndex={-1}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  {showCf ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error   && (
              <div className="rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm"
                style={{ padding:'12px 16px', marginBottom:'20px' }}>
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-green-950/60 border border-green-800 text-green-300 text-sm"
                style={{ padding:'12px 16px', marginBottom:'20px' }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'10px 0' }}
            >
              {loading
                ? <><Loader2 size={15} className="spin" /> Creating…</>
                : <><ShieldCheck size={15} /> Create Admin Account</>}
            </button>

          </form>
        </div>

        <p className="text-center text-sm text-slate-600" style={{ marginTop:'20px' }}>
          Already set up?{' '}
          <Link to="/login" className="text-blue-500 hover:text-blue-400 font-semibold transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
