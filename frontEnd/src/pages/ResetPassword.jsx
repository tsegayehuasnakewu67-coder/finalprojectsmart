import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is invalid or expired. Request a new one.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.newPassword.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(form.newPassword)) {
      setError('Use at least 12 characters with uppercase, lowercase, a number, and a symbol.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, ...form });
      navigate('/login', { replace: true, state: { message: 'Password reset successfully. Sign in with your new password.' } });
    } catch (requestError) {
      setError(requestError.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="legacy-page min-h-screen bg-slate-950 px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <ShieldCheck className="mb-4 text-emerald-400" size={28} />
        <h1 className="mb-2 text-xl font-bold text-slate-100">Set a new password</h1>
        <p className="mb-6 text-sm text-slate-400">Choose a unique password that meets the security requirements.</p>
        <form className="space-y-4" onSubmit={submit}>
          {['newPassword', 'confirmPassword'].map((name, index) => {
            const label = index === 0 ? 'New password' : 'Confirm new password';
            return (
              <div key={name}>
                <label className="mb-1.5 block text-sm font-medium text-slate-300" htmlFor={name}>{label}</label>
                <div className="relative">
                  <input
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 pr-11 text-slate-100 outline-none focus:border-emerald-400"
                    id={name}
                    name={name}
                    onChange={update}
                    required
                    type={visible[name] ? 'text' : 'password'}
                    value={form[name]}
                  />
                  <button
                    aria-label={visible[name] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    onClick={() => setVisible(current => ({ ...current, [name]: !current[name] }))}
                    type="button"
                  >
                    {visible[name] ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            );
          })}
          <p className="text-xs leading-5 text-slate-400">At least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
          {error && <p className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300" role="alert">{error}</p>}
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60" disabled={loading} type="submit">
            {loading ? <><Loader2 className="animate-spin" size={17} /> Resetting…</> : 'Reset Password'}
          </button>
        </form>
        <Link className="mt-5 block text-center text-sm text-emerald-300 hover:text-emerald-200" to="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
