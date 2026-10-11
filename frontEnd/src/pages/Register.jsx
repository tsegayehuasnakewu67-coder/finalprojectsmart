/**
 * Register — Admin onboards a new employee, HR user, or administrator.
 *
 * Layout guarantees (inline styles — immune to Tailwind JIT purge):
 *  • Form card: max-width 960px, background #0f182a,
 *    border 1px solid #1e283b, borderRadius 16px, overflow hidden
 *  • All inputs: zero placeholder attributes — labels above only
 *  • Confirm Password: real-time match validation (border colour + hint)
 *  • Password fields: show/hide toggle
 *  • 32px gap between every form row
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { loadModels, getDescriptor } from '../utils/faceApi';
import { CUSTOM_OPTION, DEPARTMENTS, POSITION_OPTIONS } from '../utils/employmentOptions';
import { Camera, CheckCircle2, UserPlus, ArrowLeft, X, Eye, EyeOff } from 'lucide-react';

const INIT = {
  fullName: '', employeeId: '', email: '', password: '', confirmPassword: '',
  department: '', customDepartment: '', position: '', customPosition: '', role: 'employee',
  phone: '', gender: '', dateOfBirth: '', address: '', photo: '', status: 'Active',
};

/* ── Style tokens ───────────────────────────────────────────────────────── */
const CARD = {
  background:   'var(--color-surface)',
  border:       '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  overflow:     'hidden',
  padding:      '32px',
};

const LABEL_STYLE = {
  display: 'block',
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '6px',
};

const buildInputStyle = (extra = {}) => ({
  width: '100%',
  padding: '11px 14px',
  background: 'var(--color-surface-muted)',
  border: '1.5px solid var(--color-border)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--color-text)',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  appearance: 'none',
  ...extra,
});

const SECTION_DIVIDER = {
  borderTop: '1px solid var(--color-border)',
  marginTop: '8px',
  paddingTop: '24px',
};

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editUserId = searchParams.get('edit');
  const [form,    setForm]    = useState(INIT);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [editLoading, setEditLoading] = useState(Boolean(editUserId));
  const [face,    setFace    ] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const [showPw,  setShowPw]  = useState(false);
  const [showCPw, setShowCPw] = useState(false);

  const [camOpen,   setCamOpen]   = useState(false);
  const [modelsOk,  setModelsOk]  = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [camMsg,    setCamMsg]    = useState('');
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadModels().then(() => setModelsOk(true)).catch(() => {});
    return () => stopCam();
  }, []);

  useEffect(() => {
    if (!camOpen) return;

    let cancelled = false;
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error('Camera preview is not ready.');
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setCamMsg('Position your face in the frame and click Capture.');
      } catch {
        if (!cancelled) setCamMsg('Camera access denied. Please allow permissions and try again.');
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
    };
  }, [camOpen]);

  useEffect(() => {
    if (!editUserId) return;
    setEditLoading(true);
    userService.getById(editUserId)
      .then(user => {
        setEmployeeProfile(user);
        setForm(current => ({
          ...current,
          fullName: user.fullName,
          employeeId: user.employeeId,
          email: user.email,
          department: user.department,
          position: user.position,
          role: user.role,
          phone: user.phone || '',
          gender: user.gender || '',
          dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '',
          address: user.address || '',
          photo: user.photo || '',
          status: user.status || (user.isActive ? 'Active' : 'Inactive'),
        }));
      })
      .catch(err => setError(err.message))
      .finally(() => setEditLoading(false));
  }, [editUserId]);

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const pwMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;
  const pwMatch    = form.confirmPassword.length > 0 && form.password === form.confirmPassword;

  /* ── Camera helpers ── */
  const openCam = () => {
    setCamOpen(true); setCamMsg('Starting camera…');
  };
  const stopCam = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  const closeCam = () => { stopCam(); setCamOpen(false); setCapturing(false); setCamMsg(''); };

  const captureFrame = async () => {
    if (!videoRef.current || !modelsOk) return;
    setCapturing(true); setCamMsg('Detecting face…');
    try {
      const desc = await getDescriptor(videoRef.current);
      if (!desc) { setCamMsg('No face detected — adjust lighting and try again.'); setCapturing(false); return; }
      setFace(desc); setCamMsg('Face captured!');
      stopCam();
      setTimeout(closeCam, 800);
    } catch { setCamMsg('Detection failed. Please try again.'); }
    finally { setCapturing(false); }
  };

  /* ── Submit ── */
  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!editUserId && form.role !== 'employee' && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!editUserId && form.role !== 'employee'
      && (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(form.password) || form.password.length < 12)) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.');
      return;
    }
    if (editUserId) {
      const fullName = form.fullName.trim();
      const email = form.email.trim();
      const employeeId = form.employeeId.trim();
      const department = form.department.trim();
      const position = form.position.trim();
      if (!fullName || !employeeId || !department || !position || !email) {
        setError('Full name, employee ID, email, department, and position are required.');
        return;
      }
      if (fullName.length > 201 || employeeId.length > 64 || email.length > 254
        || department.length > 100 || position.length > 100 || form.phone.trim().length > 32
        || form.gender.length > 40 || form.address.trim().length > 300 || form.photo.trim().length > 500) {
        setError('One or more fields exceed the allowed length.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid email address.');
        return;
      }
      setLoading(true);
      try {
        const profile = {
          fullName,
          employeeId,
          email,
          department,
          position,
          role: form.role,
          phone: form.phone.trim(),
          gender: form.gender,
          dateOfBirth: form.dateOfBirth || null,
          address: form.address.trim(),
          photo: form.photo.trim(),
          status: form.status,
        };
        let updated;
        if (employeeProfile?.employeeProfileId) {
          updated = await userService.updateEmployee(employeeProfile.employeeProfileId, {
            employeeId,
            firstName: fullName.split(/\s+/)[0],
            lastName: fullName.split(/\s+/).slice(1).join(' ') || 'Unknown',
            email,
            department,
            position,
            role: form.role,
            phone: form.phone.trim(),
            gender: form.gender,
            dateOfBirth: form.dateOfBirth || null,
            address: form.address.trim(),
            photo: form.photo.trim(),
            status: form.status,
          });
        } else {
          updated = await userService.update(editUserId, {
            ...profile,
            isActive: form.status !== 'Inactive',
          });
        }
        setEmployeeProfile(current => ({ ...current, ...profile, ...updated }));
        setSuccess('Employee profile changes saved.');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    const department = form.department === CUSTOM_OPTION ? form.customDepartment.trim() : form.department;
    const position = form.position === CUSTOM_OPTION ? form.customPosition.trim() : form.position;
    if (!editUserId && (!department || !position)) { setError('Select or enter a department and position.'); return; }
    if (!face) { setError('Capture the employee face before registering so attendance can recognize them.'); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      delete payload.confirmPassword;
      delete payload.customDepartment;
      delete payload.customPosition;
      if (form.role === 'employee') {
        delete payload.password;
      }
      payload.department = department;
      payload.position = position;
      payload.faceDescriptor = face;
      const data = await authService.register(payload);
      setSuccess(form.role === 'employee'
        ? `Employee "${data.user.fullName}" registered. They must change the server-configured default password at first sign-in.`
        : `Employee "${data.user.fullName}" registered successfully.`);
      setForm(INIT); setFace(null);
      setTimeout(() => navigate('/admin/users'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFaceUpdate = async () => {
    if (!face) {
      setError('Open the camera and capture a face before updating face recognition.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const names = form.fullName.trim().split(/\s+/);
      await userService.registerFace({
        employeeId: form.employeeId.trim(),
        firstName: names[0],
        lastName: names.slice(1).join(' ') || 'Unknown',
        department: form.department.trim(),
        position: form.position.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        faceDescriptor: face,
      });
      setEmployeeProfile(current => ({ ...current, faceRegistered: true }));
      setFace(null);
      setSuccess(`Face recognition updated for "${form.fullName.trim()}".`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackBtn onClick={() => navigate(-1)} />
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 2px', letterSpacing: '-0.025em' }}>
            {editUserId ? 'Edit Employee' : 'Register Employee'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            {editUserId ? `Update profile details for ${form.fullName || 'employee'}` : 'Add a new employee to the system'}
          </p>
        </div>
      </div>

      {/* ── Form card — max-width 960px ── */}
      <div style={{ maxWidth: '960px' }}>
        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          <div style={CARD}>

            {editUserId && (
              <section className="employee-edit-section">
                {employeeProfile?.photo && (
                  <img
                    src={employeeProfile.photo}
                    alt={`${employeeProfile.fullName} profile`}
                    className="employee-edit-photo"
                  />
                )}
                <div className="employee-edit-fields">
                  <h2 className="employee-edit-heading">Employee Information</h2>
                  {editLoading ? (
                    <p className="employee-edit-message">Loading employee details…</p>
                  ) : employeeProfile ? (
                    <>
                      <div className="employee-edit-grid">
                        <EditField label="Full name" name="fullName" value={form.fullName} onChange={set} required />
                        <EditField label="Employee ID" name="employeeId" value={form.employeeId} onChange={set} required />
                        <EditField label="Email" name="email" type="email" value={form.email} onChange={set} required />
                        <EditField label="Phone number" name="phone" type="tel" value={form.phone} onChange={set} />
                        <EditField label="Department" name="department" value={form.department} onChange={set} required />
                        <EditField label="Position" name="position" value={form.position} onChange={set} required />
                        <div className="employee-edit-field">
                          <label htmlFor="edit-role">Role</label>
                          <select id="edit-role" name="role" value={form.role} onChange={set}>
                            <option value="employee">Employee</option>
                            <option value="hr">Human Resources</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>
                        <div className="employee-edit-field">
                          <label htmlFor="edit-status">Employment status</label>
                          <select id="edit-status" name="status" value={form.status} onChange={set}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="On Leave">On leave</option>
                          </select>
                        </div>
                        <div className="employee-edit-field">
                          <label htmlFor="edit-gender">Gender</label>
                          <select id="edit-gender" name="gender" value={form.gender} onChange={set}>
                            <option value="">Select gender</option>
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <EditField label="Date of birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={set} />
                        <EditField label="Profile photo URL" name="photo" type="url" value={form.photo} onChange={set} />
                        <div className="employee-edit-field employee-edit-field-wide">
                          <label htmlFor="edit-address">Address</label>
                          <textarea id="edit-address" name="address" value={form.address} onChange={set} rows={3} maxLength={300} />
                        </div>
                      </div>
                      {!employeeProfile.employeeProfileId && (
                        <p className="employee-edit-message">
                          This login does not have a separate employee profile. Saving updates its account and profile fields.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="employee-edit-error">Employee details could not be loaded.</p>
                  )}
                </div>
              </section>
            )}

            {/* ── Row 1: Full Name + Employee ID ── */}
            {!editUserId && <>
            <TwoCol>
              <FormField label="Full Name"   name="fullName"   value={form.fullName}   onChange={set} required />
              <FormField label="Employee ID" name="employeeId" value={form.employeeId} onChange={set} required />
            </TwoCol>

            {/* ── Row 2: Email + Role ── */}
            <TwoCol mt>
              <FormField label="Email Address" name="email" type="email" value={form.email} onChange={set} required />
              <div>
                <label style={LABEL_STYLE}>
                  Role <Asterisk />
                </label>
                <select
                  name="role"
                  value={form.role}
                  onChange={set}
                  style={buildInputStyle()}
                  onFocus={e => { e.target.style.borderColor = '#3b79f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 121, 246,0.15)'; }}
                  onBlur={e  => { e.target.style.borderColor = '#333e55'; e.target.style.boxShadow = 'none'; }}
                >
                  <option value="employee">Employee</option>
                  <option value="hr">Human Resources</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </TwoCol>

            {/* ── Row 3: Department + Position ── */}
            <TwoCol mt>
              {/* Department — dropdown with standard departments */}
              <div>
                <label htmlFor="department" style={LABEL_STYLE}>
                  Department <Asterisk />
                </label>
                <DeptSelect
                  name="department"
                  value={form.department}
                  onChange={set}
                  required
                />
                {form.department === CUSTOM_OPTION && (
                  <input
                    name="customDepartment"
                    value={form.customDepartment}
                    onChange={set}
                    required
                    aria-label="Custom department name"
                    style={{ ...buildInputStyle(), marginTop: '8px' }}
                  />
                )}
              </div>
              <div>
                <label htmlFor="position" style={LABEL_STYLE}>
                  Position / Title <Asterisk />
                </label>
                <select
                  id="position"
                  name="position"
                  value={form.position}
                  onChange={set}
                  required
                  style={buildInputStyle()}
                >
                  <option value="">Select position title</option>
                  {POSITION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value={CUSTOM_OPTION}>Other (enter custom title)</option>
                </select>
                {form.position === CUSTOM_OPTION && (
                  <input
                    name="customPosition"
                    value={form.customPosition}
                    onChange={set}
                    required
                    aria-label="Custom position title"
                    style={{ ...buildInputStyle(), marginTop: '8px' }}
                  />
                )}
              </div>
            </TwoCol>

            {/* ── Admin and HR accounts set their own initial passwords. ── */}
            {form.role !== 'employee' && <>
            <TwoCol mt>
              {/* Password */}
              <div>
                <label htmlFor="password" style={LABEL_STYLE}>
                  Password <Asterisk />
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={form.password}
                  onChange={set}
                  show={showPw}
                  onToggle={() => setShowPw(v => !v)}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" style={LABEL_STYLE}>
                  Confirm Password <Asterisk />
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={set}
                  show={showCPw}
                  onToggle={() => setShowCPw(v => !v)}
                  borderColor={pwMismatch ? '#ef4444' : pwMatch ? '#22c55e' : undefined}
                />
                {pwMismatch && (
                  <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#719ef8', flexShrink: 0 }} />
                    Passwords do not match
                  </p>
                )}
                {pwMatch && (
                  <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={11} color="#4ade80" />
                    Passwords match
                  </p>
                )}
              </div>
            </TwoCol>
            </>}
            {form.role === 'employee' && (
              <p style={{ margin: '20px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                A secure default password is assigned by the server. The employee must change it before accessing their dashboard.
              </p>
            )}
            </>}

            {/* ── Face Recognition ── */}
            <div style={SECTION_DIVIDER}>
              <p style={{ ...LABEL_STYLE, marginBottom: '12px' }}>
                {editUserId ? 'Face Recognition (separate from profile changes)' : 'Face Recognition'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  {face
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: '#4ade80', fontWeight: 500 }}>
                        <CheckCircle2 size={16} color="#4ade80" />
                        Face descriptor captured (128 values); select Update Face to save it
                      </span>
                    : <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {editUserId
                          ? employeeProfile?.faceRegistered ? 'Face recognition is registered.' : 'No face is registered yet.'
                          : 'No face captured — required for attendance'}
                      </span>
                  }
                </div>
                <CameraBtn onClick={openCam} disabled={!modelsOk} hasFace={!!face} />
              </div>
              {editUserId && (
                <button
                  type="button"
                  onClick={handleFaceUpdate}
                  disabled={!face || loading || editLoading}
                  className="employee-edit-primary employee-edit-face-action"
                >
                  {loading ? 'Updating face…' : 'Update Face'}
                </button>
              )}
            </div>

            {/* ── Feedback ── */}
            {error   && <AlertBanner type="error"   text={error}   />}
            {success && <AlertBanner type="success" text={success} />}

            {/* ── Form actions ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px' }}>
              <button
                type="button"
                onClick={() => navigate('/admin/users')}
                style={{
                  padding: '10px 20px', borderRadius: '10px',
                  background: '#1c273d', border: '1px solid #333e55',
                  cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#94a0b8',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#333e55'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1e283b'; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || editLoading || pwMismatch}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 24px', borderRadius: '10px',
                  background: loading || editLoading || pwMismatch ? '#1e428a' : '#2567eb',
                  border: 'none', cursor: loading || editLoading || pwMismatch ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem', fontWeight: 600, color: '#fff',
                  opacity: loading || editLoading || pwMismatch ? 0.6 : 1,
                  transition: 'background 0.15s, opacity 0.15s',
                  boxShadow: '0 4px 12px rgba(37, 103, 235,0.3)',
                }}
                onMouseEnter={e => { if (!loading && !editLoading && !pwMismatch) e.currentTarget.style.background = '#3b79f6'; }}
                onMouseLeave={e => { if (!loading && !editLoading && !pwMismatch) e.currentTarget.style.background = '#2567eb'; }}
              >
                <UserPlus size={15} />
                {editLoading ? 'Loading…' : loading ? (editUserId ? 'Saving…' : 'Registering…') : (editUserId ? 'Save All Changes' : 'Register Employee')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Camera modal ── */}
      {camOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 50, padding: '16px',
        }}>
          <div style={{
            background: '#0f182a', border: '1px solid #333e55',
            borderRadius: '20px', padding: '24px',
            width: '100%', maxWidth: '440px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f4f9', margin: 0 }}>Capture Face</h3>
              <button
                onClick={closeCam}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000000', aspectRatio: '4/3', marginBottom: '12px' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline />
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a0b8', margin: '0 0 16px', minHeight: '1rem' }}>
              {camMsg}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={closeCam}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#1c273d', border: '1px solid #333e55', color: '#94a0b8', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={captureFrame}
                disabled={capturing || !videoRef.current?.srcObject}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#2567eb', border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: capturing || !videoRef.current?.srcObject ? 'not-allowed' : 'pointer', opacity: capturing || !videoRef.current?.srcObject ? 0.6 : 1 }}
              >
                {capturing ? 'Scanning…' : 'Capture'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared sub-components ─────────────────────────────────────────────── */

function TwoCol({ children, mt }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
      ...(mt ? { marginTop: '24px' } : {}),
    }}>
      {children}
    </div>
  );
}

function EditField({ label, name, value, onChange, type = 'text', required = false }) {
  const maxLength = {
    fullName: 201,
    employeeId: 64,
    email: 254,
    phone: 32,
    department: 100,
    position: 100,
    photo: 500,
  }[name];
  return (
    <div className="employee-edit-field">
      <label htmlFor={`edit-${name}`}>{label}{required ? ' *' : ''}</label>
      <input
        id={`edit-${name}`}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
      />
    </div>
  );
}

function FormField({ label, name, value, onChange, type = 'text', required }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={name} style={LABEL_STYLE}>
        {label}{required && <Asterisk />}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        /* no placeholder — label above provides context */
        style={buildInputStyle({
          borderColor: focused ? '#3b79f6' : '#333e55',
          boxShadow:   focused ? '0 0 0 3px rgba(59, 121, 246,0.15)' : 'none',
        })}
        onFocus={() => setFocused(true)}
        onBlur={()  => setFocused(false)}
      />
    </div>
  );
}

function PasswordInput({ id, name, value, onChange, show, onToggle, borderColor }) {
  const [focused, setFocused] = useState(false);
  const activeBorder = borderColor ?? (focused ? '#3b79f6' : '#333e55');
  const activeShadow = focused
    ? borderColor
      ? `0 0 0 3px ${borderColor}33`
      : '0 0 0 3px rgba(59, 121, 246,0.15)'
    : 'none';

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required
        /* no placeholder */
        style={buildInputStyle({ paddingRight: '40px', borderColor: activeBorder, boxShadow: activeShadow })}
        onFocus={() => setFocused(true)}
        onBlur={()  => setFocused(false)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={onToggle}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748b', display: 'flex', alignItems: 'center', padding: '2px',
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#94a0b8'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function CameraBtn({ onClick, disabled, hasFace }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '9px 18px', borderRadius: '10px',
        background: hovered && !disabled ? '#2a3b5e' : '#1c273d',
        border: '1px solid #333e55', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.875rem', fontWeight: 600, color: '#e2e7f0',
        opacity: disabled ? 0.5 : 1, transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <Camera size={15} />
      {disabled ? 'Loading models…' : hasFace ? 'Re-capture' : 'Open Camera'}
    </button>
  );
}

function BackBtn({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px', borderRadius: '8px',
        background: hovered ? '#2a3b5e' : '#1c273d',
        border: '1px solid #333e55', cursor: 'pointer',
        color: hovered ? '#f1f4f9' : '#64748b',
        display: 'flex', alignItems: 'center',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      <ArrowLeft size={16} />
    </button>
  );
}

function AlertBanner({ type, text }) {
  const isErr = type === 'error';
  return (
    <div style={{
      marginTop: '20px',
      padding: '12px 16px',
      borderRadius: '10px',
      borderLeft: `3px solid ${isErr ? '#ef4444' : '#22c55e'}`,
      background: isErr ? 'rgba(29, 62, 127,0.25)' : 'rgba(21, 57, 128,0.2)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
      color: isErr ? '#fca5a5' : '#86efac',
      fontSize: '0.875rem',
    }}>
      {text}
    </div>
  );
}

function Asterisk() {
  return <span style={{ color: '#f87171', marginLeft: '2px' }}>*</span>;
}

/* ── Department dropdown ───────────────────────────────────────────────── */
function DeptSelect({ name, value, onChange, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      style={buildInputStyle({
        borderColor: focused ? '#3b79f6' : '#333e55',
        boxShadow:   focused ? '0 0 0 3px rgba(59, 121, 246,0.15)' : 'none',
        /* show a dim "unselected" cue without using placeholder text */
        color: value === '' ? '#64748b' : '#f1f4f9',
      })}
      onFocus={() => setFocused(true)}
      onBlur={()  => setFocused(false)}
    >
      {/* First option acts as the empty state label — not a placeholder */}
      <option value="" disabled style={{ color: '#64748b', background: '#1c273d' }}>
        Select department
      </option>
      {DEPARTMENTS.map(d => (
        <option key={d} value={d} style={{ background: '#1c273d', color: '#f1f4f9' }}>
          {d}
        </option>
      ))}
      <option value={CUSTOM_OPTION} style={{ background: '#1c273d', color: '#f1f4f9' }}>
        Other (enter custom department)
      </option>
    </select>
  );
}
