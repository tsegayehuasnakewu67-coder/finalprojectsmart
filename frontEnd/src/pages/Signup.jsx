/**
 * Signup.jsx
 * - Fills form → captures face → AUTO-SUBMITS immediately after capture
 * - If face capture not needed, manual Submit button still works
 * - On success → auto-redirects to /login
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadModels, getDescriptor } from '../utils/faceApi';
import { CUSTOM_OPTION, DEPARTMENTS, POSITION_OPTIONS } from '../utils/employmentOptions';
import api from '../services/api';
import {
  UserPlus, Camera, CheckCircle2,
  ArrowLeft, Eye, EyeOff, X, RefreshCw, Loader2,
} from 'lucide-react';

const BACKGROUND_IMAGES = [
  'mau7.jfif',
  'mau1.jfif',
  'mau2.jfif',
  'mau3.jfif',
  'mau4.jfif',
  'mau5.jfif',
  'mau6.jfif',
];

const BACKGROUND_STYLES = `
  .signup-background {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    background: #0a2e31;
  }

  .signup-background::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(135deg, rgba(8, 40, 43, 0.42), rgba(14, 69, 73, 0.32) 52%, rgba(8, 46, 50, 0.5)),
      radial-gradient(circle at 50% 45%, rgba(45, 212, 191, 0.18), rgba(2, 25, 18, 0.24));
  }

  .signup-background-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    opacity: 0;
    transform: scale(1.06);
    filter: brightness(1.18) saturate(1.08);
    animation: signupBackgroundCycle 42s ease-in-out infinite;
  }

  @keyframes signupBackgroundCycle {
    0%, 12% { opacity: 1; transform: scale(1.04); }
    17%, 100% { opacity: 0; transform: scale(1.12); }
  }

  @media (prefers-reduced-motion: reduce) {
    .signup-background-image {
      animation: none;
      opacity: 0;
      transform: none;
    }

    .signup-background-image:first-child { opacity: 1; }
  }
`;

const INIT = {
  fullName: '', employeeId: '', email: '',
  password: '', confirmPassword: '',
  department: '', customDepartment: '', position: '', customPosition: '',
};

const CAM = {
  CLOSED: 'closed', OPENING: 'opening', LIVE: 'live',
  SCANNING: 'scanning', DONE: 'done', ERROR: 'error',
};

export default function Signup() {
  const navigate = useNavigate();

  const [form,     setForm]     = useState(INIT);
  const [face,     setFace]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const [camPhase, setCamPhase] = useState(CAM.CLOSED);
  const [camMsg,   setCamMsg]   = useState('');
  const [modelsOk, setModelsOk] = useState(false);

  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  // Keep latest form in a ref so the auto-submit after capture sees current values
  const formRef   = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  useEffect(() => {
    loadModels().then(() => setModelsOk(true)).catch(() => {});
    return () => stopStream();
  }, []);

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  /* ── Stream helpers ─────────────────────────────────────── */
  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startStream = useCallback(async () => {
    setCamMsg('Requesting camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      const vid = videoRef.current;
      if (vid) {
        vid.srcObject = stream;
        vid.onloadedmetadata = () =>
          vid.play()
            .then(() => { setCamPhase(CAM.LIVE); setCamMsg('Face the camera clearly, then click Capture.'); })
            .catch(() => { setCamMsg('Could not play video.'); setCamPhase(CAM.ERROR); });
      }
    } catch (err) {
      setCamMsg(err.name === 'NotAllowedError'
        ? 'Camera access denied. Allow permissions and retry.'
        : `Camera error: ${err.message}`);
      setCamPhase(CAM.ERROR);
    }
  }, []);

  useEffect(() => {
    if (camPhase === CAM.OPENING) startStream();
  }, [camPhase, startStream]);

  const openCamera = () => {
    if (!modelsOk) return;
    setFace(null); setError('');
    setCamPhase(CAM.OPENING);
    setCamMsg('Starting…');
  };

  const closeCamera = () => { stopStream(); setCamPhase(CAM.CLOSED); setCamMsg(''); };

  /* ── Submit helper (reused by both manual button and auto-submit) ── */
  const doSubmit = useCallback(async (descriptor) => {
    const f = formRef.current;
    setError(''); setSuccess('');

    if (f.password !== f.confirmPassword) { setError('Passwords do not match.'); return false; }
    if (f.password.length < 6)            { setError('Password must be at least 6 characters.'); return false; }

    setLoading(true);
    try {
      const payload = {
        fullName:        f.fullName.trim(),
        employeeId:      f.employeeId.trim(),
        email:           f.email.trim(),
        password:        f.password,
        confirmPassword: f.confirmPassword,
        department:      f.department === CUSTOM_OPTION ? f.customDepartment.trim() : f.department,
        position:        f.position === CUSTOM_OPTION ? f.customPosition.trim() : f.position,
      };
      if (descriptor) payload.faceDescriptor = descriptor;

      await api.post('/auth/signup', payload);
      setSuccess('✅ Account created! Redirecting to sign in…');
      setForm(INIT); setFace(null); closeCamera();
      setTimeout(() => navigate('/login'), 2000);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  /* ── Capture — then auto-submit immediately ─────────────── */
  const captureFrame = async () => {
    if (camPhase !== CAM.LIVE || !videoRef.current) return;
    setCamPhase(CAM.SCANNING);
    setCamMsg('Detecting face…');
    try {
      const descriptor = await getDescriptor(videoRef.current);
      if (!descriptor) {
        setCamMsg('No face detected. Adjust position/lighting and try again.');
        setCamPhase(CAM.LIVE);
        return;
      }
      // Stop camera immediately
      stopStream();
      setFace(descriptor);
      setCamPhase(CAM.DONE);
      setCamMsg('Face captured! Submitting registration…');

      // Validate required fields before auto-submitting
      const f = formRef.current;
      const missing = ['fullName','employeeId','email','password','confirmPassword','department','position']
        .filter(k => !f[k]?.trim());
      if (f.department === CUSTOM_OPTION && !f.customDepartment.trim()) missing.push('custom department');
      if (f.position === CUSTOM_OPTION && !f.customPosition.trim()) missing.push('custom position');
      if (missing.length > 0) {
        setCamMsg('Face captured. Please complete all required fields, then click Create Account.');
        return;
      }
      // All fields filled — auto-submit
      await doSubmit(descriptor);
    } catch {
      setCamMsg('Detection failed. Try again.');
      setCamPhase(CAM.LIVE);
    }
  };

  /* ── Manual submit (no face required) ──────────────────── */
  const handleSubmit = async e => {
    e.preventDefault();
    await doSubmit(face);
  };

  const cameraVisible = [CAM.OPENING, CAM.LIVE, CAM.SCANNING, CAM.DONE, CAM.ERROR].includes(camPhase);

  return (
    <div className="legacy-page relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-900 py-10 px-4 flex items-start justify-center">
      <style>{BACKGROUND_STYLES}</style>
      <div className="signup-background" aria-hidden="true">
        {BACKGROUND_IMAGES.map((image, index) => (
          <img
            key={image}
            className="signup-background-image"
            src={`/login-backgrounds/${image}`}
            alt=""
            style={{ animationDelay: `-${index * 6}s` }}
          />
        ))}
      </div>
      <div className="relative z-10 w-full max-w-2xl">

        {/* Brand */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-3 shadow-lg shadow-blue-900/40 overflow-hidden p-1">
            <img src="/mau-logo.png" alt="Mekdela Amba University logo" className="w-full h-full object-contain rounded-xl" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Smart Attendance System</h1>
          <p className="text-sm text-slate-500 mt-1">Corporate Attendance System</p>
        </div>

        <div className="bg-[#0d3d3f] border border-[#2eb8a6] rounded-2xl p-7 shadow-2xl space-y-5">

          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200">Create your account</h2>
            <Link to="/login" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft size={13} /> Back to Sign In
            </Link>
          </div>

          <form onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name"   name="fullName"   value={form.fullName}   onChange={set} required />
              <Field label="Employee ID" name="employeeId" value={form.employeeId} onChange={set} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email Address" name="email" type="email" value={form.email} onChange={set} required />
              <SelectField
                label="Department"
                name="department"
                value={form.department}
                onChange={set}
                options={DEPARTMENTS}
                required
              />
            </div>
            {form.department === CUSTOM_OPTION && (
              <Field label="Department Name" name="customDepartment" value={form.customDepartment} onChange={set} required />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Position / Job Title"
                name="position"
                value={form.position}
                onChange={set}
                options={POSITION_OPTIONS}
                required
              />
            </div>
            {form.position === CUSTOM_OPTION && (
              <Field label="Position Title" name="customPosition" value={form.customPosition} onChange={set} required />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PasswordField label="Password"         name="password"        value={form.password}        onChange={set} show={showPass} toggle={() => setShowPass(p => !p)} required />
              <PasswordField label="Confirm Password" name="confirmPassword" value={form.confirmPassword} onChange={set} show={showConf} toggle={() => setShowConf(p => !p)} required />
            </div>

            {/* ── Face section ──────────────────────────────── */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Camera size={15} className="text-blue-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Face Recognition</span>
                  <span className="text-[10px] text-slate-600">(Required for kiosk check-in)</span>
                </div>
                {face
                  ? <span className="flex items-center gap-1 text-xs font-bold text-green-400"><CheckCircle2 size={12}/> Captured</span>
                  : <span className="text-xs text-slate-500">Not captured</span>}
              </div>

              <div className="p-4 space-y-3">
                {/* Inline camera */}
                {cameraVisible && (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full">
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline
                      style={{ display: camPhase === CAM.OPENING ? 'none' : 'block' }} />

                    {/* Guide frame */}
                    {(camPhase === CAM.LIVE || camPhase === CAM.SCANNING) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className={`w-36 h-44 border-2 rounded-2xl ${camPhase === CAM.SCANNING ? 'border-yellow-400' : 'border-blue-400 opacity-70'}`} />
                      </div>
                    )}

                    {camPhase === CAM.OPENING && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                        <div className="spin rounded-full border-4 border-slate-700 border-t-blue-500 w-8 h-8 mb-2"/>
                        <p className="text-xs text-slate-400">Starting camera…</p>
                      </div>
                    )}

                    {camPhase === CAM.SCANNING && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                        <div className="spin rounded-full border-4 border-slate-600 border-t-yellow-400 w-10 h-10 mb-2"/>
                        <p className="text-xs text-yellow-300 font-semibold">Detecting face…</p>
                      </div>
                    )}

                    {camPhase === CAM.DONE && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-950/85">
                        <CheckCircle2 size={52} className="text-green-400 mb-2"/>
                        <p className="text-sm font-bold text-green-300">Face Captured!</p>
                        {loading && <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><Loader2 size={12} className="spin"/> Saving account…</p>}
                      </div>
                    )}

                    {camPhase === CAM.ERROR && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/85 p-4 text-center">
                        <p className="text-sm text-red-300">{camMsg}</p>
                      </div>
                    )}

                    <button type="button" onClick={closeCamera}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-green/50 hover:bg-green/80 text-white transition-colors">
                      <X size={14}/>
                    </button>
                  </div>
                )}

                {camMsg && ![CAM.ERROR, CAM.DONE].includes(camPhase) && (
                  <p className="text-xs text-slate-400 text-center">{camMsg}</p>
                )}

                {/* Camera action buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  {(!cameraVisible || camPhase === CAM.DONE) && (
                    <button type="button" onClick={openCamera} disabled={!modelsOk || loading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      <Camera size={14}/>
                      {face ? 'Recapture Face' : modelsOk ? 'Open Camera' : 'Loading models…'}
                    </button>
                  )}

                  {camPhase === CAM.LIVE && (
                    <button type="button" onClick={captureFrame}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-colors">
                      <Camera size={14}/> Capture Face
                    </button>
                  )}

                  {camPhase === CAM.ERROR && (
                    <button type="button" onClick={openCamera} disabled={!modelsOk}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold text-slate-200 transition-colors">
                      <RefreshCw size={14}/> Retry
                    </button>
                  )}

                  {face && camPhase === CAM.DONE && (
                    <button type="button" onClick={() => { setFace(null); setCamPhase(CAM.CLOSED); setCamMsg(''); }}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                      Remove
                    </button>
                  )}

                  {(camPhase === CAM.LIVE || camPhase === CAM.SCANNING) && (
                    <button type="button" onClick={closeCamera} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                      Cancel
                    </button>
                  )}
                </div>

                {!cameraVisible && !face && (
                  <p className="text-xs text-slate-600">Capture your face to enable touchless kiosk check-in. After capture, registration saves automatically.</p>
                )}
              </div>
            </div>

            {error   && <Alert type="error"   text={error} />}
            {success && <Alert type="success" text={success} />}

            {/* Manual submit button — always available */}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#22c55e] via-[#14b8a6] to-[#0ea5e9] hover:brightness-110 text-sm font-bold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? <><Loader2 size={16} className="spin"/> Saving…</> : <><UserPlus size={16}/> Create Account</>}
            </button>

          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-500 hover:text-blue-400 font-semibold transition-colors">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

/* ── Field components ────────────────────────────────────── */
const inputBase = 'w-full px-3.5 py-2.5 rounded-xl bg-[#0b2f32] border border-[#2fa89d] text-slate-100 text-sm focus:outline-none focus:border-[#5eead4] transition-colors';

function SelectField({ label, name, value, onChange, options, required }) {
  const uid = `su_${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={uid} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select id={uid} name={uid} value={value} required={required}
        onChange={e => onChange({ target: { name, value: e.target.value } })}
        className={inputBase}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
        <option value={CUSTOM_OPTION}>Other (enter custom value)</option>
      </select>
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', required }) {
  const uid = `su_${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={uid} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input id={uid} name={uid}
        type={type === 'email' ? 'text' : type}
        inputMode={type === 'email' ? 'email' : undefined}
        autoComplete="off" value={value} required={required}
        onChange={e => onChange({ target: { name, value: e.target.value } })}
        className={inputBase} />
    </div>
  );
}

function PasswordField({ label, name, value, onChange, show, toggle, required }) {
  const uid = `su_${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={uid} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input id={uid} name={uid} type={show ? 'text' : 'password'}
          autoComplete="new-password" value={value} required={required}
          onChange={e => onChange({ target: { name, value: e.target.value } })}
          className={inputBase + ' pr-10'} />
        <button type="button" onClick={toggle} tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
          {show ? <EyeOff size={14}/> : <Eye size={14}/>}
        </button>
      </div>
    </div>
  );
}

function Alert({ type, text }) {
  return (
    <div className={`px-4 py-3 rounded-xl border text-sm ${type === 'error' ? 'bg-red-950/60 border-red-800 text-red-300' : 'bg-green-950/60 border-green-800 text-green-300'}`}>
      {text}
    </div>
  );
}
