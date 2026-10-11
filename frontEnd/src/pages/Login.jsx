import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2, ArrowRight, Camera } from 'lucide-react';

const LOGIN_BACKGROUND_IMAGES = [
  'mau7.jfif',
  'mau1.jfif',
  'mau2.jfif',
  'mau3.jfif',
  'mau4.jfif',
  'mau5.jfif',
  'mau6.jfif',
];

/* ─── Inline stylesheet ──────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .login-root {
    position: relative;
    isolation: isolate;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px 56px;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overflow: hidden;
    background:
      radial-gradient(circle at top, rgba(19, 163, 123, 0.22), transparent 28%),
      linear-gradient(135deg, #061b17 0%, #0a2d27 28%, #0d3a32 52%, #0c271f 100%);
  }

  .login-background {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    background: transparent;
  }

  .login-background::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(135deg, rgba(5, 24, 19, 0.34), rgba(7, 34, 28, 0.24) 52%, rgba(5, 20, 15, 0.4)),
      radial-gradient(circle at 50% 45%, rgba(16, 185, 129, 0.1), rgba(3, 9, 8, 0.18));
  }

  .login-background-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    opacity: 0;
    transform: scale(1.06);
    filter: brightness(1.18) saturate(1.08);
    animation: loginBackgroundCycle 42s ease-in-out infinite;
  }

  .login-accents {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
  }

  .login-accent {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.48;
    animation: accentFloat 10s ease-in-out infinite alternate;
  }

  .login-accent--tl {
    top: -50px;
    left: -50px;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(52, 211, 153, 0.9) 0%, rgba(16, 185, 129, 0.72) 42%, transparent 70%);
  }

  .login-accent--br {
    right: -50px;
    bottom: -50px;
    width: 320px;
    height: 320px;
    background: radial-gradient(circle, rgba(110, 231, 183, 0.9) 0%, rgba(5, 150, 105, 0.8) 50%, transparent 72%);
    animation-delay: -4s;
  }

  .login-rings {
    position: absolute;
    left: 50%;
    top: 48%;
    width: 540px;
    height: 540px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 1.5px solid rgba(110, 231, 183, 0.24);
    box-shadow:
      0 0 0 36px rgba(16, 185, 129, 0.05),
      0 0 0 72px rgba(110, 231, 183, 0.03),
      inset 0 0 48px rgba(16, 185, 129, 0.04);
    animation: ringsPulse 8s ease-in-out infinite;
  }

  .login-waves {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 180px;
    opacity: 0.45;
  }

  .login-root > *:not(.login-accents):not(.login-background) {
    position: relative;
    z-index: 2;
  }

  /* ── Brand ── */
  .login-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 32px;
    text-align: center;
    animation: revealDown 0.7s ease both;
  }

  .login-logo {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, #0b2d27 0%, #0f766e 62%, #34d399 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
    box-shadow: 0 8px 28px rgba(16, 185, 129, 0.28);
    border: 2px solid rgba(52, 211, 153, 0.7);
    animation: logoPulse 3.5s ease-in-out infinite;
    position: relative;
    overflow: hidden;
    padding: 4px;
    background: #123a2d;
  }

  .login-logo::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.28), transparent 68%);
    transform: translateX(-120%);
    animation: logoShine 4s ease-in-out infinite;
  }

  .mau-logo-mark {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
  }

  .login-logo-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: relative;
    z-index: 1;
  }

  .mau-logo-mark strong {
    color: #34d399;
    font-size: 1.05rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    margin-left: 0.12em;
  }

  .mau-logo-mark small {
    color: #ffffff;
    font-size: 0.38rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    margin-top: 5px;
  }

  .login-app-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #E2E8F0;
    letter-spacing: -0.5px;
    margin: 0 0 4px;
    line-height: 1.2;
  }

  .login-app-sub {
    font-size: 13px;
    color: #94A3B8;
    margin: 0;
    font-weight: 500;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 11px;
  }

  /* ── Dark sign-in card ── */
  .login-card {
    width: 100%;
    max-width: 480px;
    padding: 3rem;
    background: rgba(13, 31, 27, 0.96);
    border: 1px solid rgba(52, 211, 153, 0.48);
    border-top: 3px solid #34d399;
    border-radius: 24px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48), 0 0 0 8px rgba(16, 185, 129, 0.08);
    backdrop-filter: blur(18px);
    animation: revealUp 0.8s 0.12s ease both;
  }

  .login-card-heading { margin-bottom: 32px; }

  .login-card-heading h2 {
    font-size: 1.875rem;
    font-weight: 700;
    color: #F1F5F9;
    margin: 0 0 8px;
    letter-spacing: -0.4px;
    line-height: 1.2;
    text-wrap: balance;
  }

  .login-card-heading p {
    font-size: 14px;
    color: #94A3B8;
    margin: 0;
  }

  .login-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #214d3d, #34d399, transparent);
    margin-bottom: 28px;
  }

  /* ── Fields ── */
  .login-field { margin-bottom: 20px; }

  .login-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #CBD5E1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }

  .login-label .req {
    color: #EF4444;
    font-weight: 700;
    margin-left: 2px;
  }

  .login-input-wrap { position: relative; }

  .login-input {
    width: 100%;
    height: 52px;
    padding: 0.875rem 1rem;
    font-size: 15px;
    font-family: inherit;
    color: #E2E8F0;
    background: rgba(10, 28, 24, 0.9);
    border: 1.5px solid rgba(94, 234, 212, 0.45);
    border-radius: 12px;
    outline: none;
    box-shadow: 0 1px 2px rgba(15, 24, 42, 0.04);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
    -webkit-appearance: none;
  }

  .login-input::placeholder { color: #8bcab4; }

  .login-input:hover:not(:disabled) {
    border-color: rgba(110, 231, 183, 0.8);
    background: rgba(12, 33, 29, 0.96);
  }

  .login-input:focus {
    border-color: #34d399;
    background: rgba(12, 33, 29, 0.96);
    transform: translateY(-1px);
    box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.14), 0 8px 20px rgba(52, 211, 153, 0.08);
  }

  .login-input--pw { padding-right: 42px; }

  .login-pw-toggle {
    position: absolute;
    right: 11px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: #94A3B8;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: color 0.15s;
  }

  .login-pw-toggle:hover { color: #E2E8F0; }

  .login-pw-toggle:focus-visible {
    outline: 2px solid #10b981;
    outline-offset: 1px;
  }

  /* ── Error banner ── */
  .login-error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 20px;
    background: #321B2A;
    border: 1px solid #7F303B;
    border-left: 3px solid #F87171;
    border-radius: 10px;
    font-size: 13px;
    color: #FCA5A5;
    line-height: 1.5;
    font-weight: 500;
  }

  .login-error-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #F87171;
    margin-top: 5px;
  }

  /* ── Primary sign-in button ── */
  .login-btn {
    width: 100%;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 1rem;
    font-size: 1.125rem;
    font-weight: 700;
    font-family: inherit;
    color: #04150f;
    background: linear-gradient(110deg, #5eead4 0%, #34d399 38%, #10b981 100%);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.38);
    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    letter-spacing: 0.01em;
    position: relative;
    overflow: hidden;
  }

  .login-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 25%, rgba(255, 255, 255, 0.24), transparent 65%);
    transform: translateX(-120%);
    transition: transform 0.55s ease;
  }

  .login-btn:hover:not(:disabled)::after { transform: translateX(120%); }

  .login-btn:hover:not(:disabled) {
    transform: scale(1.02);
    box-shadow: 0 12px 32px rgba(16, 185, 129, 0.52);
    filter: brightness(1.06);
  }

  .login-btn:active:not(:disabled) {
    transform: scale(0.99);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.32);
  }

  .login-btn:disabled {
    background: linear-gradient(to right, #334155, #475569);
    box-shadow: none;
    cursor: not-allowed;
    filter: none;
  }

  .login-btn:focus-visible {
    outline: 2px solid #10b981;
    outline-offset: 3px;
  }

  /* ────────────────────────────────────────────────────────────
     KIOSK CTA — bright, high-visibility card
  ──────────────────────────────────────────────────────────── */
  .kiosk-cta {
    position: relative;
    width: 100%;
    max-width: 480px;
    margin-top: 2rem;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 24px;
    background: linear-gradient(110deg, rgba(13, 31, 27, 0.97), rgba(7, 103, 79, 0.94));
    border: 1.5px solid rgba(52, 211, 153, 0.5);
    border-radius: 18px;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 16px 34px rgba(15, 24, 42, 0.2);
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
  }

  .kiosk-cta:hover {
    background: linear-gradient(110deg, rgba(13, 31, 27, 1), rgba(10, 127, 93, 0.96));
    border-color: #34d399;
    transform: translateY(-3px);
    box-shadow: 0 14px 32px rgba(16, 185, 129, 0.18);
  }

  .kiosk-cta:active {
    transform: translateY(0);
  }

  .kiosk-cta-icon {
    width: 46px;
    height: 46px;
    border-radius: 13px;
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    transition: transform 0.15s ease;
  }

  .kiosk-cta:hover .kiosk-cta-icon {
    transform: scale(1.08);
  }

  .kiosk-cta-text { flex: 1; }

  .kiosk-cta-title {
    font-size: 15px;
    font-weight: 700;
    color: #f8f9fc;
    margin: 0 0 2px;
    letter-spacing: -0.2px;
  }

  .kiosk-cta-sub {
    font-size: 12px;
    color: #cbd2e1;
    margin: 0;
  }

  .kiosk-cta-arrow {
    color: #a7f3d0;
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }

  .kiosk-cta:hover .kiosk-cta-arrow {
    transform: translateX(3px);
  }

  @keyframes revealDown {
    from { opacity: 0; transform: translateY(-18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes revealUp {
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes accentFloat {
    from { transform: translate3d(0, 0, 0) scale(1); }
    to { transform: translate3d(18px, -14px, 0) scale(1.08); }
  }

  @keyframes ringsPulse {
    0%, 100% { transform: translate(-50%, -50%) scale(0.98); opacity: 0.7; }
    50% { transform: translate(-50%, -50%) scale(1.03); opacity: 1; }
  }

  @keyframes logoPulse {
    0%, 100% { box-shadow: 0 8px 28px rgba(16, 185, 129, 0.28); }
    50% { box-shadow: 0 12px 38px rgba(16, 185, 129, 0.45), 0 0 0 6px rgba(52, 211, 153, 0.12); }
  }

  @keyframes logoShine {
    0%, 55% { transform: translateX(-120%); }
    75%, 100% { transform: translateX(120%); }
  }

  @keyframes loginBackgroundCycle {
    0%, 12% { opacity: 1; transform: scale(1.04); }
    17%, 100% { opacity: 0; transform: scale(1.12); }
  }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.75s linear infinite; }

  /* ── Autofill override — keep dark-mode contrast ── */
  .login-input:-webkit-autofill,
  .login-input:-webkit-autofill:hover,
  .login-input:-webkit-autofill:focus,
  .login-input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #0B1425 inset !important;
    box-shadow:         0 0 0 1000px #0B1425 inset !important;
    -webkit-text-fill-color: #E2E8F0 !important;
    caret-color: #E2E8F0;
    border-color: #334155 !important;
    transition: background-color 99999s ease-in-out 0s;
  }

  @media (max-width: 480px) {
    .login-root { padding: 28px 16px 40px; }
    .login-card  { padding: 2rem 1.5rem; border-radius: 20px; }
    .kiosk-cta   { padding: 14px 18px; }
    .login-card-heading h2 { font-size: 1.625rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .login-btn, .kiosk-cta, .kiosk-cta-icon, .kiosk-cta-arrow,
    .login-brand, .login-card, .login-accent, .login-rings, .login-logo {
      transition: none;
      animation: none;
    }
    .login-background-image {
      animation: none;
      opacity: 0;
      transform: none;
    }
    .login-background-image:first-child { opacity: 1; }
  }
`;

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();

  const [form,    setForm]    = useState({ identifier: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.identifier.trim(), form.password);
      navigate(user.mustChangePassword
        ? '/change-password'
        : (({ admin: '/admin', hr: '/hr', employee: '/me' })[user.role] || '/'), { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      setError(err?.response?.data?.message || (
        !err.response && ['ERR_NETWORK', 'ECONNABORTED'].includes(err.code)
          ? 'Unable to reach the login server. Confirm the backend is running and try again.'
          : status >= 500
            ? 'The server could not complete sign-in. Please try again shortly.'
            : err.message || 'Invalid credentials. Please try again.'
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{STYLES}</style>

      <div className="login-root">
        <div className="login-background" aria-hidden="true">
          {LOGIN_BACKGROUND_IMAGES.map((image, index) => (
            <img
              key={image}
              className="login-background-image"
              src={`/login-backgrounds/${image}`}
              alt=""
              style={{ animationDelay: `-${index * 6}s` }}
            />
          ))}
        </div>
        <div className="login-accents" aria-hidden="true">
          <span className="login-accent login-accent--tl" />
          <span className="login-accent login-accent--br" />
          <span className="login-rings" />
          <svg className="login-waves" viewBox="0 0 1440 180" preserveAspectRatio="none">
            <path fill="none" stroke="#7ae7c4" strokeWidth="1.5" d="M0 110 C 240 40, 480 160, 720 100 S 1200 40, 1440 110" />
            <path fill="none" stroke="#dcfce7" strokeWidth="1.5" d="M0 140 C 280 80, 520 180, 800 130 S 1180 90, 1440 150" />
          </svg>
        </div>

        {/* ── Brand ── */}
        <div className="login-brand">
          <div className="login-logo" aria-hidden="true">
            <img className="login-logo-image" src="/mau-logo.png" alt="" />
          </div>
          <h1 className="login-app-name">Mekdela Amba University</h1>
          <p className="login-app-sub">Smart Attendance System</p>
        </div>

        {/* ── Sign-in card ── */}
        <div className="login-card">
          <div className="login-card-heading">
            <h2>Welcome back</h2>
            <p>Sign in to access your dashboard</p>
          </div>
          {location.state?.message && (
            <div role="status" className="login-error" style={{ color: '#a7f3d0', background: '#052e24', borderColor: '#047857', borderLeftColor: '#34d399' }}>
              {location.state.message}
            </div>
          )}

          <div className="login-divider" aria-hidden="true" />

          {/*
            autoComplete="off" on the form prevents Chrome from
            suggesting saved logins on the form level.
            Individual inputs use "new-password" / "username" to
            further suppress credential auto-fill while still
            letting password managers work intentionally.
          */}
          <form onSubmit={handleSubmit} noValidate autoComplete="off">

            {/* Employee ID or email */}
            <div className="login-field">
              <label htmlFor="login-identifier" className="login-label">
                Employee ID or Email<span className="req" aria-hidden="true">*</span>
              </label>
              <div className="login-input-wrap">
                <input
                  id="login-identifier"
                  name="login-identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={form.identifier}
                  onChange={e => setForm(p => ({ ...p, identifier: e.target.value }))}
                  className="login-input"
                  disabled={loading}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-14px', marginBottom: '20px' }}>
              <Link to="/forgot-password" style={{ color: '#6ee7b7', fontSize: '0.8125rem', textDecoration: 'none' }}>
                Forgot Password?
              </Link>
            </div>

            {/* Password */}
            <div className="login-field" style={{ marginBottom: '28px' }}>
              <label htmlFor="login-password" className="login-label">
                Password<span className="req" aria-hidden="true">*</span>
              </label>
              <div className="login-input-wrap">
                <input
                  id="login-password"
                  name="login-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="login-input login-input--pw"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="login-pw-toggle"
                >
                  {showPw
                    ? <EyeOff size={18} strokeWidth={2} />
                    : <Eye    size={18} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div role="alert" className="login-error">
                <span className="login-error-dot" aria-hidden="true" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="login-btn">
              {loading ? (
                <><Loader2 size={15} className="spin" /> Signing in…</>
              ) : (
                <>Sign In <ArrowRight size={20} strokeWidth={2.5} /></>
              )}
            </button>
          </form>
        </div>

        {/* ════════════════════════════════════════════════════
            KIOSK CTA — prominent card, not a tiny footer link
        ════════════════════════════════════════════════════ */}
        <a href="/kiosk" className="kiosk-cta" aria-label="Go to the face recognition attendance set">
          <div className="kiosk-cta-icon" aria-hidden="true">
            <Camera size={22} color="#ffffff" strokeWidth={1.8} />
          </div>
          <div className="kiosk-cta-text">
            <p className="kiosk-cta-title">Mark Attendance — Face Check-In</p>
            <p className="kiosk-cta-sub">Use the camera to record your attendance</p>
          </div>
          <ArrowRight size={18} className="kiosk-cta-arrow" strokeWidth={2.2} />
        </a>

      </div>
    </>
  );
}
