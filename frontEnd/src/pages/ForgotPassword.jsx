import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: email.trim() });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit the request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="legacy-page min-h-screen bg-slate-950 px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <Mail className="mb-4 text-emerald-400" size={28} />
        <h1 className="text-xl font-bold text-slate-100">Forgot password?</h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-400">Enter the registered account email. If it matches an account, reset instructions will be sent.</p>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-300" htmlFor="reset-email">Email address</label>
          <input
            autoComplete="email"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-3 text-slate-100 outline-none focus:border-emerald-400"
            id="reset-email"
            onChange={event => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          {message && <p className="rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200" role="status">{message}</p>}
          {error && <p className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300" role="alert">{error}</p>}
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60" disabled={loading} type="submit">
            {loading ? <><Loader2 className="animate-spin" size={17} /> Sending…</> : 'Send reset instructions'}
          </button>
        </form>
        <Link className="mt-5 block text-center text-sm text-emerald-300 hover:text-emerald-200" to="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
