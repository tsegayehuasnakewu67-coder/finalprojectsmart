import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const roleHome = { admin: '/admin', hr: '/hr', employee: '/me' };

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const toggle = name => setVisible(current => ({ ...current, [name]: !current[name] }));

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (form.newPassword.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(form.newPassword)) {
      setError('Use at least 12 characters with uppercase, lowercase, a number, and a symbol.');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      const updated = await changePassword(form);
      navigate(roleHome[updated.role] || '/', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    ['currentPassword', 'Current password'],
    ['newPassword', 'New password'],
    ['confirmPassword', 'Confirm new password'],
  ];

  return (
    <main className="legacy-page min-h-screen bg-slate-950 px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="text-emerald-400" size={26} />
          <div>
            <h1 className="text-xl font-bold text-slate-100">Change your password</h1>
            <p className="text-sm text-slate-400">{user?.fullName || user?.employeeId}</p>
          </div>
        </div>
        <p role="status" className="mb-6 rounded-lg border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200">
          For your account security, please change your default password before continuing.
        </p>
        <form className="space-y-4" onSubmit={submit}>
          {fields.map(([name, label]) => (
            <div key={name}>
              <label className="mb-1.5 block text-sm font-medium text-slate-300" htmlFor={name}>{label}</label>
              <div className="relative">
                <input
                  autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
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
                  onClick={() => toggle(name)}
                  type="button"
                >
                  {visible[name] ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs leading-5 text-slate-400">
            Password requirements: at least 12 characters, including uppercase and lowercase letters, a number, and a symbol.
          </p>
          {error && <p className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300" role="alert">{error}</p>}
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60" disabled={loading} type="submit">
            {loading ? <><Loader2 className="animate-spin" size={17} /> Changing password…</> : 'Change Password'}
          </button>
          <button className="w-full py-2 text-sm text-slate-400 hover:text-slate-200" onClick={() => { logout(); navigate('/login', { replace: true }); }} type="button">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
