import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import { userService } from '../../services/userService';
import { loadModels, getDescriptor, drawDetections } from '../../utils/faceApi';
import LoadingSpinner from '../../components/LoadingSpinner';

const EMPTY_FORM = {
  fullName: '', employeeId: '', email: '', password: '',
  confirmPassword: '', department: '', position: '', role: 'employee',
  phone: '', gender: '', dateOfBirth: '', address: '', photo: '', isActive: true,
};

export default function RegisterEmployee() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEdit = Boolean(editId);

  const [form, setForm] = useState(EMPTY_FORM);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [editLoading, setEditLoading] = useState(Boolean(editId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Face capture
  const [cameraOpen, setCameraOpen] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [captureMsg, setCaptureMsg] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);

  // Load existing employee if editing
  useEffect(() => {
    if (!isEdit) return;
    userService.getById(editId)
      .then((emp) => {
        setFaceRegistered(Boolean(emp.faceRegistered));
        setForm({
          fullName: emp.fullName,
          employeeId: emp.employeeId,
          email: emp.email,
          password: '',
          confirmPassword: '',
          department: emp.department,
          position: emp.position,
          role: emp.role,
          phone: emp.phone || '',
          gender: emp.gender || '',
          dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().slice(0, 10) : '',
          address: emp.address || '',
          photo: emp.photo || '',
          isActive: emp.isActive !== false,
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setEditLoading(false));
  }, [editId, isEdit]);

  // Load face-api models
  useEffect(() => {
    if (isEdit) return;
    loadModels().then(() => setModelsReady(true)).catch(() => {});
  }, [isEdit]);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── Camera ──────────────────────────────────────────────────────────────────
  const openCamera = async () => {
    setCameraOpen(true);
    setCaptureMsg('Positioning camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCaptureMsg('Face the camera, then click Capture.');
    } catch {
      setCaptureMsg('Camera access denied. Please allow camera permissions.');
    }
  };

  const closeCamera = () => {
    clearInterval(scanTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraOpen(false);
    setScanning(false);
    setCaptureMsg('');
  };

  const captureDescriptor = async () => {
    if (!videoRef.current || !modelsReady) return;
    setScanning(true);
    setCaptureMsg('Detecting face…');
    try {
      await drawDetections(videoRef.current, canvasRef.current);
      const desc = await getDescriptor(videoRef.current);
      if (!desc) {
        setCaptureMsg('No face detected. Adjust lighting and try again.');
        setScanning(false);
        return;
      }
      setFaceDescriptor(desc);
      setCaptureMsg('✅ Face captured successfully!');
      setScanning(false);
      setTimeout(closeCamera, 1200);
    } catch {
      setCaptureMsg('Detection failed. Please try again.');
      setScanning(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        const payload = {
          fullName: form.fullName, email: form.email,
          department: form.department, position: form.position, role: form.role,
          phone: form.phone, gender: form.gender, dateOfBirth: form.dateOfBirth,
          address: form.address, photo: form.photo, isActive: form.isActive,
        };
        if (form.password) payload.password = form.password;
        await userService.update(editId, payload);
        setSuccess('Employee updated successfully.');
        setTimeout(() => navigate('/admin/employees'), 1200);
      } else {
        const payload = { ...form };
        if (faceDescriptor) payload.faceDescriptor = faceDescriptor;
        await authService.register(payload);
        setSuccess('Employee registered successfully.');
        setTimeout(() => navigate('/admin/employees'), 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (editLoading) return <LoadingSpinner />;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>{isEdit ? 'Edit Employee' : 'Register Employee'}</h2>
          <p style={styles.pageSub}>{isEdit ? 'Update employee profile' : 'Add a new employee to the system'}</p>
        </div>
        <button onClick={() => navigate('/admin/employees')} style={styles.backBtn}>← Back</button>
      </div>

      <div style={styles.formCard}>
        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.grid}>
            <Field label="Full Name" name="fullName" value={form.fullName} onChange={handleChange} required />
            <Field label="Employee ID" name="employeeId" value={form.employeeId} onChange={handleChange} required disabled={isEdit} />
            <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} required />
            <Field label="Department" name="department" value={form.department} onChange={handleChange} required />
            <Field label="Position / Job Title" name="position" value={form.position} onChange={handleChange} required />
            <Field label="Phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
            <Field label="Gender" name="gender" value={form.gender} onChange={handleChange} />
            <Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
            <Field label="Photo URL" name="photo" type="url" value={form.photo} onChange={handleChange} />
            <div style={{ ...styles.fieldWrap, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Address</label>
              <textarea name="address" value={form.address} onChange={handleChange} style={styles.textarea} rows={3} />
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>Role</label>
              <select name="role" value={form.role} onChange={handleChange} style={styles.select}>
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>Account Status</label>
              <select name="isActive" value={form.isActive ? 'active' : 'inactive'} onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'active' }))} style={styles.select}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <Field label={isEdit ? 'New Password (leave blank to keep)' : 'Password'} name="password" type="password" value={form.password} onChange={handleChange} required={!isEdit} />
            <Field label="Confirm Password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} required={!isEdit} />
          </div>

          {/* Face registration section */}
          {isEdit ? (
            <div style={styles.faceSection}>
              <h3 style={styles.sectionTitle}>Face Recognition</h3>
              <p style={styles.faceNone}>
                {faceRegistered
                  ? 'Face registration is saved and will not be changed when you update this profile.'
                  : 'No face is registered. Profile updates will not change face registration.'}
              </p>
            </div>
          ) : (
            <div style={styles.faceSection}>
              <h3 style={styles.sectionTitle}>Face Recognition</h3>
              <div style={styles.faceRow}>
                <div style={styles.faceStatus}>
                  {faceDescriptor
                    ? <span style={styles.faceDone}>✅ Face descriptor captured (128 points)</span>
                    : <span style={styles.faceNone}>No face registered yet</span>}
                </div>
                <button type="button" onClick={openCamera} disabled={!modelsReady} style={styles.cameraBtn}>
                  {modelsReady ? '📷 Open Camera' : 'Loading models…'}
                </button>
              </div>
            </div>
          )}

          {error   && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.successMsg}>{success}</p>}

          <div style={styles.submitRow}>
            <button type="button" onClick={() => navigate('/admin/employees')} style={styles.cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Register Employee'}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Modal */}
      {cameraOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: '0 0 12px' }}>Capture Face</h3>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <video ref={videoRef} style={styles.video} muted playsInline />
              <canvas ref={canvasRef} style={styles.canvas} />
            </div>
            <p style={{ color: '#64748b', fontSize: 13, margin: '10px 0' }}>{captureMsg}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={closeCamera} style={styles.cancelBtn}>Close</button>
              <button onClick={captureDescriptor} disabled={scanning} style={styles.submitBtn}>
                {scanning ? 'Scanning…' : 'Capture'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', required, disabled }) {
  return (
    <div style={styles.fieldWrap}>
      <label htmlFor={name} style={styles.label}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        style={{ ...styles.input, background: disabled ? '#f4f6fa' : '#f4f8ff', cursor: disabled ? 'not-allowed' : 'text' }}
      />
    </div>
  );
}

const styles = {
  page: {},
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f182a' },
  pageSub: { margin: 0, color: '#64748b', fontSize: 13 },
  backBtn: { background: '#f1f4f9', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#475569', fontWeight: 600 },
  formCard: { background: '#f4f8ff', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px 20px', marginBottom: 24 },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' },
  select: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#f4f8ff' },
  textarea: { padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' },
  faceSection: { borderTop: '1px solid #f1f4f9', paddingTop: 20, marginBottom: 20 },
  sectionTitle: { margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' },
  faceRow: { display: 'flex', alignItems: 'center', gap: 16 },
  faceStatus: { flex: 1 },
  faceDone: { color: '#16a34a', fontSize: 13, fontWeight: 600 },
  faceNone: { color: '#94a0b8', fontSize: 13 },
  cameraBtn: { background: '#0f182a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  error: { background: '#f1f5fe', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  successMsg: { background: '#f0f4fd', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  submitRow: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancelBtn: { background: '#f1f4f9', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, cursor: 'pointer', color: '#475569' },
  submitBtn: { background: '#3c7af5', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#f4f8ff', borderRadius: 12, padding: 24, maxWidth: 500, width: '95%', textAlign: 'center' },
  video: { width: 360, height: 270, borderRadius: 8, background: '#000000', display: 'block' },
  canvas: { position: 'absolute', top: 0, left: 0, width: 360, height: 270 },
};
