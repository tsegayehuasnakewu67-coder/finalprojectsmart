/**
 * AttendanceStation — Smart dual-session face-recognition kiosk
 *
 * Public page (/kiosk). No auth required.
 *
 * SESSION FLOW:
 *   Morning window     → face scan → morning check-in
 *   Lunch window       → face scan → morning check-out (going to break)
 *   After-lunch window → face scan → after-lunch check-in
 *   End of day         → face scan → after-lunch check-out
 *   Shift end passed   → auto check-out applied on next scan
 *
 * The backend (POST /api/attendance/mark) is the single smart endpoint
 * that determines which action to apply based on time & existing record.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadModels, getDescriptor, drawDetections } from '../utils/faceApi';
import { attendanceService } from '../services/attendanceService';
import { formatEthiopianDate, formatEthiopianTime } from '../utils/ethiopianDateTime';

// ── State machine phases ────────────────────────────────────────────────────
const S = {
  LOADING:  'loading',
  SCANNING: 'scanning',
  SUCCESS:  'success',
  INFO:     'info',      // in_break / day_complete / too_early
  ERROR:    'error',
};

const SCAN_INTERVAL_MS = 500;
const RESET_DELAY_MS   = 6000;

// ── Helpers ─────────────────────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (h, m) => `${pad2(h)}:${pad2(m)}`;
const fmtDate = formatEthiopianTime;

// ── Action → human label maps ────────────────────────────────────────────────
const ACTION_LABEL = {
  morning_checkin:     { icon: '🌅', title: 'Morning Check-In',        color: '#22c55e' },
  afterlunch_checkin:  { icon: '🔙', title: 'After-Lunch Check-In',    color: '#3b79f6' },
  afterlunch_checkout: { icon: '🌇', title: 'End of Day Check-Out',    color: '#5c8ff6' },
  auto_checkout:       { icon: '⏰', title: 'Auto Check-Out Applied',  color: '#64748b' },
};

// ── Session row helper ───────────────────────────────────────────────────────
const buildSessionRows = (data) => {
  if (!data) return [];
  const rows = [];
  if (data.checkInTime)
    rows.push({ label: 'Morning Check-In',       time: fmtDate(data.checkInTime),        icon: '🌅' });
  if (data.checkOutTime)
    rows.push({ label: 'Auto Lunch Check-Out',   time: fmtDate(data.checkOutTime),       icon: '☕' });
  if (data.afterLunchCheckIn)
    rows.push({ label: 'After-Lunch Check-In',   time: fmtDate(data.afterLunchCheckIn),  icon: '🔙' });
  if (data.afterLunchCheckOut)
    rows.push({ label: 'Evening Check-Out',       time: fmtDate(data.afterLunchCheckOut), icon: '🌇' });
  return rows;
};

export default function AttendanceStation() {
  const [phase, setPhase]         = useState(S.LOADING);
  const [result, setResult]       = useState(null);   // { action, data, message, isError }
  const [kioskMode, setKioskMode] = useState('morning'); // morning|break|afterlunch|closed
  const [shift, setShift]         = useState(null);

  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const scanTimer  = useRef(null);
  const resetTimer = useRef(null);

  // ── Boot: load models + fetch shift info ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const [, statusData] = await Promise.all([
          loadModels(),
          attendanceService.getKioskStatus().catch(() => null),
        ]);
        if (!cancelled) {
          if (statusData) {
            setKioskMode(statusData.kioskMode);
            setShift(statusData.shift);
          }
          await startCamera();
        }
      } catch {
        if (!cancelled) {
          setResult({ isError: true, message: 'Failed to load face recognition models. Ensure /public/models is populated.' });
          setPhase(S.ERROR);
        }
      }
    };

    boot();
    return () => {
      cancelled = true;
      clearInterval(scanTimer.current);
      clearTimeout(resetTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startScanning();
    } catch {
      setResult({ isError: true, message: 'Camera access denied. Please allow camera permissions and reload.' });
      setPhase(S.ERROR);
    }
  };

  // ── Scan loop ─────────────────────────────────────────────────────────────
  const startScanning = useCallback(() => {
    setPhase(S.SCANNING);
    scanTimer.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        await drawDetections(videoRef.current, canvasRef.current);
        const descriptor = await getDescriptor(videoRef.current);
        if (!descriptor) return;
        clearInterval(scanTimer.current);
        await submitScan(descriptor);
      } catch { /* transient — keep scanning */ }
    }, SCAN_INTERVAL_MS);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const submitScan = async (descriptor) => {
    try {
      const res = await attendanceService.mark(descriptor);

      if (res.success) {
        setResult({ action: res.action, data: res.data, message: res.message, isError: false });
        setPhase(S.SUCCESS);
        if (res.data?.session) refreshKioskMode();
      } else if (res.morningActive) {
        setResult({ action: 'morning_active', data: res.data, message: res.message, isError: false });
        setPhase(S.INFO);
      } else if (res.inBreak) {
        setResult({ action: 'in_break', data: res.data, message: res.message, isError: false });
        setPhase(S.INFO);
      } else if (res.dayComplete) {
        setResult({ action: 'day_complete', data: res.data, message: res.message, isError: false });
        setPhase(S.INFO);
      } else if (res.tooEarly) {
        setResult({ action: 'too_early', data: res.data, message: res.message, isError: false });
        setPhase(S.INFO);
      } else if (res.autoCheckout) {
        setResult({ action: 'auto_checkout', data: res.data, message: res.message, isError: false });
        setPhase(S.SUCCESS);
      } else {
        setResult({ isError: true, message: res.message || 'Unrecognised face.' });
        setPhase(S.ERROR);
      }
    } catch (err) {
      setResult({ isError: true, message: err?.response?.data?.message || err.message || 'Server error.' });
      setPhase(S.ERROR);
    }

    resetTimer.current = setTimeout(resetKiosk, RESET_DELAY_MS);
  };

  const refreshKioskMode = async () => {
    try {
      const s = await attendanceService.getKioskStatus();
      if (s) { setKioskMode(s.kioskMode); setShift(s.shift); }
    } catch { /* non-critical */ }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetKiosk = useCallback(() => {
    clearInterval(scanTimer.current);
    clearTimeout(resetTimer.current);
    setResult(null);
    if (canvasRef.current) {
      canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    startScanning();
  }, [startScanning]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>🎯</span>
        <div>
          <h1 style={styles.headerTitle}>SmartAttend Kiosk</h1>
          <p style={styles.headerSub}>Face Recognition Attendance</p>
        </div>
        <div style={styles.headerRight}>
          <Clock />
          {shift && <KioskModeBanner mode={kioskMode} shift={shift} />}
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={styles.main}>
        {/* Camera feed */}
        <div style={styles.cameraBox}>
          <video ref={videoRef} style={styles.video} muted playsInline />
          <canvas ref={canvasRef} style={styles.canvas} width={640} height={480} />

          {/* Scan frame overlay */}
          {phase === S.SCANNING && (
            <div style={styles.scanOverlay}>
              <div style={styles.scanFrame} />
              <p style={styles.scanText}>Look straight at the camera…</p>
            </div>
          )}

          {/* Result overlay */}
          {(phase === S.SUCCESS || phase === S.INFO || phase === S.ERROR) && (
            <ResultOverlay phase={phase} result={result} onReset={resetKiosk} />
          )}

          {/* Loading overlay */}
          {phase === S.LOADING && (
            <div style={styles.loadingOverlay}>
              <div style={styles.spinner} />
              <p style={styles.loadingText}>Loading face recognition models…</p>
            </div>
          )}
        </div>

        {/* Status bar */}
        <StatusBar phase={phase} kioskMode={kioskMode} />

        {/* Session guide */}
        {shift?.lunchEnabled && phase === S.SCANNING && (
          <SessionGuide shift={shift} kioskMode={kioskMode} />
        )}
      </div>

      <p style={styles.footer}>
        Stand in front of the camera · Look straight ahead · Good lighting helps
      </p>
      <p style={styles.loginHint}>
        Admin? <a href="/login" style={styles.loginLink}>Sign in →</a>
      </p>
    </div>
  );
}

// ── ResultOverlay ────────────────────────────────────────────────────────────
function ResultOverlay({ phase, result, onReset }) {
  if (!result) return null;

  const isSuccess = phase === S.SUCCESS;
  const isInfo    = phase === S.INFO;
  const isError   = phase === S.ERROR;

  let bg, icon, title;

  if (isError) {
    bg    = 'rgba(220,38,38,0.93)';
    icon  = '❌';
    title = 'Not Recognised';
  } else if (result.action === 'morning_active') {
    bg    = 'rgba(34,197,94,0.93)';
    icon  = '✅';
    title = 'Already Checked In';
  } else if (result.action === 'in_break') {
    bg    = 'rgba(245,158,11,0.93)';
    icon  = '☕';
    title = 'Lunch Break';
  } else if (result.action === 'day_complete') {
    bg    = 'rgba(100,116,139,0.93)';
    icon  = '✅';
    title = 'Day Complete';
  } else if (result.action === 'too_early') {
    bg    = 'rgba(30, 78, 175,0.93)';
    icon  = '⏳';
    title = 'Too Early';
  } else {
    const meta = ACTION_LABEL[result.action] || { icon: '✅', title: 'Recorded', color: '#22c55e' };
    bg    = hexToRgba(meta.color, 0.93);
    icon  = meta.icon;
    title = meta.title;
  }

  const emp       = result.data?.employee;
  const sessionRows = isSuccess ? buildSessionRows(result.data) : [];

  return (
    <div style={{ ...styles.resultOverlay, background: bg }}>
      <span style={styles.resultIcon}>{icon}</span>
      <h2 style={styles.resultName}>{emp ? emp.fullName : title}</h2>

      {emp && (
        <>
          <p style={styles.resultDept}>{emp.department}</p>
          <p style={styles.resultEmpId}>{emp.employeeId}</p>
        </>
      )}

      {/* Status pill for morning check-in */}
      {result.data?.status && (
        <StatusPill status={result.data.status} lateLabel={result.data.lateLabel} />
      )}

      {/* Session table */}
      {sessionRows.length > 0 && (
        <div style={styles.sessionTable}>
          {sessionRows.map((row) => (
            <div key={row.label} style={styles.sessionRow}>
              <span style={styles.sessionRowIcon}>{row.icon}</span>
              <span style={styles.sessionRowLabel}>{row.label}</span>
              <span style={styles.sessionRowTime}>{row.time}</span>
            </div>
          ))}
        </div>
      )}

      <p style={styles.resultMsg}>{result.message}</p>
      <p style={styles.resetHint}>Resetting in a few seconds…</p>
      <button onClick={onReset} style={styles.resetBtn}>Next person</button>
    </div>
  );
}

// ── KioskModeBanner ──────────────────────────────────────────────────────────
function KioskModeBanner({ mode, shift }) {
  const map = {
    morning:    { color: '#22c55e', bg: 'rgba(34, 88, 197,0.12)',   icon: '🌅', label: 'Morning Check-In' },
    break:      { color: '#f59e0b', bg: 'rgba(14, 90, 242,0.12)',  icon: '☕', label: 'Lunch Break — Auto Check-Out Active' },
    afterlunch: { color: '#3b79f6', bg: 'rgba(60, 122, 245,0.12)',  icon: '🔙', label: 'After-Lunch Check-In' },
    closed:     { color: '#64748b', bg: 'rgba(74, 104, 165,0.12)', icon: '🌙', label: 'Shift Ended' },
  };
  const { color, bg, icon, label } = map[mode] ?? map.morning;

  let hint = '';
  if (mode === 'morning' && shift.lunchEnabled) {
    hint = `Auto check-out at ${hhmm(shift.lunchStartHour, shift.lunchStartMinute)}`;
  } else if (mode === 'break') {
    const lunchEndH = shift.lunchStartHour + Math.floor((shift.lunchStartMinute + shift.lunchDuration) / 60);
    const lunchEndM = (shift.lunchStartMinute + shift.lunchDuration) % 60;
    hint = `After-lunch check-in opens at ${hhmm(lunchEndH, lunchEndM)}`;
  } else if (mode === 'afterlunch') {
    hint = `Shift ends at ${hhmm(shift.endHour, shift.endMinute)}`;
  }

  return (
    <div style={{ ...styles.modeBanner, background: bg, borderColor: color }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontWeight: 700, color, fontSize: 13 }}>{label}</p>
        {hint && <p style={{ margin: 0, color: '#94a0b8', fontSize: 11 }}>{hint}</p>}
      </div>
    </div>
  );
}

// ── SessionGuide ─────────────────────────────────────────────────────────────
function SessionGuide({ shift, kioskMode }) {
  const lunchEndH = shift.lunchStartHour + Math.floor((shift.lunchStartMinute + shift.lunchDuration) / 60);
  const lunchEndM = (shift.lunchStartMinute + shift.lunchDuration) % 60;

  // 4-step flow — step 2 (auto checkout) has a special "auto" badge
  const steps = [
    {
      icon: '🌅', label: 'Morning\nCheck-In',
      time: hhmm(shift.startHour, shift.startMinute),
      active: kioskMode === 'morning',
      auto: false,
    },
    {
      icon: '☕', label: 'Auto\nLunch Out',
      time: hhmm(shift.lunchStartHour, shift.lunchStartMinute),
      active: kioskMode === 'break',
      auto: true,
    },
    {
      icon: '🔙', label: 'After-Lunch\nCheck-In',
      time: hhmm(lunchEndH, lunchEndM),
      active: kioskMode === 'afterlunch',
      auto: false,
    },
    {
      icon: '🌇', label: 'Evening\nCheck-Out',
      time: hhmm(shift.endHour, shift.endMinute),
      active: false,
      auto: false,
    },
  ];

  return (
    <div style={styles.guide}>
      {steps.map((s, i) => (
        <div key={i} style={{ ...styles.guideStep, opacity: s.active ? 1 : 0.45 }}>
          <span style={styles.guideIcon}>{s.icon}</span>
          <div style={{ position: 'relative' }}>
            {s.auto && (
              <span style={styles.autoBadge}>AUTO</span>
            )}
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: s.active ? '#f1f4f9' : '#64748b', whiteSpace: 'pre-line' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 10, color: '#94a0b8' }}>{s.time}</p>
          </div>
          {i < steps.length - 1 && <span style={styles.guideArrow}>›</span>}
        </div>
      ))}
    </div>
  );
}

// ── StatusBar ─────────────────────────────────────────────────────────────────
function StatusBar({ phase, kioskMode }) {
  const modeColor = { morning: '#22c55e', break: '#f59e0b', afterlunch: '#3b79f6', closed: '#64748b' };
  const map = {
    [S.LOADING]:  { color: '#64748b', text: 'Initialising…',                         dot: '#94a0b8' },
    [S.SCANNING]: { color: modeColor[kioskMode] || '#3b79f6', text: 'Scanning — look at the camera', dot: modeColor[kioskMode] || '#3b79f6' },
    [S.SUCCESS]:  { color: '#22c55e', text: 'Attendance recorded!',                  dot: '#22c55e' },
    [S.INFO]:     { color: '#f59e0b', text: 'Information',                           dot: '#f59e0b' },
    [S.ERROR]:    { color: '#ef4444', text: 'Scan failed',                           dot: '#ef4444' },
  };
  const { color, text, dot } = map[phase] ?? map[S.LOADING];
  return (
    <div style={styles.statusBar}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ color, fontWeight: 600, fontSize: 14 }}>{text}</span>
    </div>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────────
function StatusPill({ status, lateLabel }) {
  return (
    <span style={{ background: 'rgba(59, 130, 246, 0.22)', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 6, display: 'inline-block' }}>
      {status}{lateLabel ? ` — ${lateLabel}` : ''}
    </span>
  );
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f4f9', fontVariantNumeric: 'tabular-nums' }}>
        {formatEthiopianTime(time, { seconds: true })}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: '#94a0b8' }}>
        {formatEthiopianDate(time, { weekday: 'short', month: 'short', day: 'numeric' })}
      </p>
    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0f182a 0%, #1c273d 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
    width: '100%',
    maxWidth: 700,
  },
  headerIcon:  { fontSize: 36, flexShrink: 0 },
  headerTitle: { margin: '0 0 2px', fontSize: 24, fontWeight: 700, color: '#f1f4f9' },
  headerSub:   { margin: 0, color: '#64748b', fontSize: 13 },
  headerRight: { marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  modeBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    border: '1px solid', borderRadius: 10,
    padding: '6px 12px',
  },
  main: { width: '100%', maxWidth: 680 },
  cameraBox: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    background: '#000000',
    aspectRatio: '4/3',
    width: '100%',
    boxShadow: '0 0 0 3px #1e4eaf, 0 20px 60px rgba(0,0,0,0.6)',
  },
  video:  { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  scanOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  scanFrame: {
    width: 200, height: 240,
    border: '3px solid #3b79f6',
    borderRadius: 12,
    boxShadow: '0 0 0 2000px rgba(0,0,0,0.15)',
  },
  scanText: {
    marginTop: 14, color: '#93b6fd', fontWeight: 600,
    fontSize: 14, textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  },
  resultOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    color: '#fff', padding: '20px 24px', textAlign: 'center', overflowY: 'auto',
  },
  resultIcon: { fontSize: 48, marginBottom: 10 },
  resultName: { margin: '0 0 4px', fontSize: 24, fontWeight: 800 },
  resultDept: { margin: '0 0 2px', opacity: 0.85, fontSize: 14 },
  resultEmpId:{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: 13, opacity: 0.8 },
  resultMsg:  { margin: '10px 0 4px', opacity: 0.9, fontSize: 14, maxWidth: 320 },
  sessionTable: {
    marginTop: 12, width: '100%', maxWidth: 340,
    background: 'rgba(0, 0, 0,0.25)', borderRadius: 10,
    padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 2,
  },
  sessionRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 14px', fontSize: 13,
  },
  sessionRowIcon:  { fontSize: 16, flexShrink: 0 },
  sessionRowLabel: { flex: 1, textAlign: 'left', opacity: 0.85 },
  sessionRowTime:  { fontVariantNumeric: 'tabular-nums', fontWeight: 700 },
  resetHint: { margin: '10px 0 6px', opacity: 0.65, fontSize: 11 },
  resetBtn: {
    background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 8, padding: '8px 20px', color: '#fff', fontSize: 13,
    fontWeight: 600, cursor: 'pointer',
  },
  loadingOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0, 0, 0,0.7)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  spinner: {
    width: 40, height: 40, borderRadius: '50%',
    border: '4px solid rgba(255,255,255,0.2)',
    borderTopColor: '#3b79f6',
    animation: 'spin 0.75s linear infinite',
  },
  loadingText: { color: '#94a0b8', fontSize: 14, margin: 0 },
  statusBar: {
    marginTop: 12, background: '#1c273d', borderRadius: 10,
    padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
  },
  guide: {
    marginTop: 12, background: '#1c273d', borderRadius: 10,
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    gap: 6, flexWrap: 'wrap',
  },
  guideStep: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  guideIcon:  { fontSize: 18 },
  guideArrow: { color: '#333e55', fontSize: 18, margin: '0 2px' },
  autoBadge: {
    display: 'inline-block',
    fontSize: 8, fontWeight: 800, letterSpacing: 1,
    background: '#0e5af2', color: '#000',
    borderRadius: 4, padding: '1px 4px',
    marginBottom: 2,
  },
  footer: { marginTop: 16, color: '#475569', fontSize: 12, textAlign: 'center' },
  loginHint: { marginTop: 6, color: '#475569', fontSize: 12 },
  loginLink: { color: '#3b79f6', textDecoration: 'none' },
};
