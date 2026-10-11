import { useState, useEffect } from 'react';
import { shiftService } from '../../services/shiftService';
import { Clock, Save, Info, CheckCircle2, Loader2, AlertTriangle, UtensilsCrossed, Bell } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');
const fmt24 = (h, m) => `${pad(h)}:${pad(m)}`;
const addMins = (h, m, mins) => {
  const total = h * 60 + m + mins;
  return { h: Math.floor(total / 60) % 24, m: total % 60 };
};

const INIT = {
  startHour: 8,  startMinute: 30,
  gracePeriod: 5,
  endHour: 17,   endMinute: 0,
  lunchEnabled: false,
  lunchStartHour: 12, lunchStartMinute: 0,
  lunchDuration: 60,
  beforeLunchStartHour: 8, beforeLunchStartMinute: 30,
  beforeLunchEndHour: 12, beforeLunchEndMinute: 0,
  afterLunchStartHour: 13, afterLunchStartMinute: 0,
  afterLunchEndHour: 17, afterLunchEndMinute: 0,
  notifyCheckIn: true,
  notifyCheckOut: true,
};

export default function ShiftSettings() {
  const [form,    setForm]    = useState(INIT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    shiftService.getSettings()
      .then(d => setForm({
        startHour:        d.startHour        ?? 8,
        startMinute:      d.startMinute      ?? 30,
        gracePeriod:      d.gracePeriod      ?? 5,
        endHour:          d.endHour          ?? 17,
        endMinute:        d.endMinute        ?? 0,
        lunchEnabled:     d.lunchEnabled     ?? false,
        lunchStartHour:   d.lunchStartHour   ?? 12,
        lunchStartMinute: d.lunchStartMinute ?? 0,
        lunchDuration:    d.lunchDuration    ?? 60,
        beforeLunchStartHour: d.beforeLunchStartHour ?? 8,
        beforeLunchStartMinute: d.beforeLunchStartMinute ?? 30,
        beforeLunchEndHour: d.beforeLunchEndHour ?? 12,
        beforeLunchEndMinute: d.beforeLunchEndMinute ?? 0,
        afterLunchStartHour: d.afterLunchStartHour ?? 13,
        afterLunchStartMinute: d.afterLunchStartMinute ?? 0,
        afterLunchEndHour: d.afterLunchEndHour ?? 17,
        afterLunchEndMinute: d.afterLunchEndMinute ?? 0,
        notifyCheckIn: d.notifyCheckIn ?? true,
        notifyCheckOut: d.notifyCheckOut ?? true,
      }))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set    = (field, val) => { setForm(p => ({ ...p, [field]: Number(val) })); setSuccess(''); };
  const toggle = ()           => { setForm(p => ({ ...p, lunchEnabled: !p.lunchEnabled })); setSuccess(''); };

  const handleSave = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    try {
      await shiftService.updateSettings(form);
      setSuccess('Shift settings saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Derived preview ── */
  const deadlineMins  = form.startHour * 60 + form.startMinute + form.gracePeriod;
  const deadline      = { h: Math.floor(deadlineMins / 60) % 24, m: deadlineMins % 60 };
  const lunchEnd      = addMins(form.lunchStartHour, form.lunchStartMinute, form.lunchDuration);

  const startLabel    = fmt24(form.startHour,       form.startMinute);
  const deadlineLabel = fmt24(deadline.h,            deadline.m);
  const endLabel      = fmt24(form.endHour,          form.endMinute);
  const lunchStartLbl = fmt24(form.lunchStartHour,   form.lunchStartMinute);
  const lunchEndLbl   = fmt24(lunchEnd.h,            lunchEnd.m);

  // Net working hours = (end - start) - lunch duration
  const grossMins = (form.endHour * 60 + form.endMinute) - (form.startHour * 60 + form.startMinute);
  const netMins   = form.lunchEnabled ? grossMins - form.lunchDuration : grossMins;
  const netLabel  = netMins > 0
    ? `${Math.floor(netMins / 60)}h ${netMins % 60 > 0 ? netMins % 60 + 'm' : ''}`.trim()
    : '—';

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#94a0b8', gap:10 }}>
      <Loader2 size={20} style={{ animation:'spin 1s linear infinite' }} /> Loading settings…
    </div>
  );

  return (
    <div style={{ maxWidth:660, margin:'0 auto', padding:'32px 16px', display:'flex', flexDirection:'column', gap:24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f4f9', margin:0 }}>Shift Settings</h1>
        <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>
          Configure work hours, grace period, lunch break and late-arrival rules.
        </p>
      </div>

      <div style={{ ...card, gap:8 }} aria-label="Regional date and time settings">
        <h2 style={{ fontSize:14, fontWeight:700, color:'#e2e7f0', margin:0 }}>Regional Date &amp; Time</h2>
        <p style={{ ...hint, color:'#94a0b8' }}>
          Ethiopian calendar · Addis Ababa time (Africa/Addis_Ababa, UTC+03:00) · 24-hour clock.
          Attendance decisions and timestamps use this time zone. Dates are displayed in the Ethiopian calendar;
          stored dates and date-filter inputs remain Gregorian.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <div style={card}>

          {/* START TIME */}
          <Section title="Start Time" icon={<Clock size={15} />}>
            <p style={hint}>Official check-in time. Employees must arrive by start + grace period.</p>
            <div style={row}>
              <NumField label="Hour (0–23)"   value={form.startHour}   min={0} max={23} onChange={v => set('startHour',   v)} />
              <NumField label="Minute (0–59)" value={form.startMinute} min={0} max={59} onChange={v => set('startMinute', v)} />
            </div>
          </Section>

          <Divider />

          {/* GRACE PERIOD */}
          <Section title="Grace Period" icon={<Info size={15} />}>
            <p style={hint}>Extra minutes allowed after start time before marking <em>Late</em>. Choose between 5 and 20 minutes.</p>
            <NumField label="Grace Period (minutes, 5–20)" value={form.gracePeriod} min={5} max={20} onChange={v => set('gracePeriod', v)} wide />
          </Section>

          <Divider />

          {/* END TIME */}
          <Section title="End Time" icon={<Clock size={15} />}>
            <p style={hint}>Official end-of-day / check-out reference time.</p>
            <div style={row}>
              <NumField label="Hour (0–23)"   value={form.endHour}   min={0} max={23} onChange={v => set('endHour',   v)} />
              <NumField label="Minute (0–59)" value={form.endMinute} min={0} max={59} onChange={v => set('endMinute', v)} />
            </div>
          </Section>

          <Divider />

          {/* LUNCH BREAK */}
          <Section title="Lunch Break" icon={<UtensilsCrossed size={15} />}>
            <p style={hint}>
              When enabled, employees scanning the kiosk during lunch hours are not marked as leaving early.
              Lunch duration is subtracted when calculating net working hours.
            </p>

            {/* Toggle */}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button
                type="button"
                onClick={toggle}
                style={{
                  position:'relative', width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                  background: form.lunchEnabled ? '#2567eb' : '#2a3b5e',
                  transition:'background 0.2s',
                  flexShrink:0,
                }}
              >
                <span style={{
                  position:'absolute', top:3, left: form.lunchEnabled ? 22 : 3,
                  width:18, height:18, borderRadius:'50%', background:'#f4f8ff',
                  transition:'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize:13, color: form.lunchEnabled ? '#f1f4f9' : '#64748b', fontWeight:600 }}>
                {form.lunchEnabled ? 'Lunch break enabled' : 'Lunch break disabled'}
              </span>
            </div>

            {/* Lunch fields — only shown when enabled */}
            {form.lunchEnabled && (
              <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:4,
                padding:'16px', borderRadius:10, background:'#0f182a', border:'1px solid #1e283b' }}>

                <div>
                  <p style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                    letterSpacing:'0.05em', margin:'0 0 10px' }}>Lunch Start Time</p>
                  <div style={row}>
                    <NumField label="Hour (0–23)"   value={form.lunchStartHour}   min={0} max={23} onChange={v => set('lunchStartHour',   v)} />
                    <NumField label="Minute (0–59)" value={form.lunchStartMinute} min={0} max={59} onChange={v => set('lunchStartMinute', v)} />
                  </div>
                </div>

                <div>
                  <p style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase',
                    letterSpacing:'0.05em', margin:'0 0 10px' }}>Lunch Duration</p>
                  <NumField
                    label="Duration (minutes, 0–180)"
                    value={form.lunchDuration} min={0} max={180}
                    onChange={v => set('lunchDuration', v)} wide
                  />
                  <p style={{ fontSize:11, color:'#475569', marginTop:6 }}>
                    Lunch ends at: <strong style={{ color:'#94a0b8' }}>{lunchEndLbl}</strong>
                  </p>
                </div>
              </div>
            )}
          </Section>

          <Divider />

          <Section title="Before Lunch Window" icon={<Clock size={15} />}>
            <p style={hint}>Set the morning attendance window for employee check-in and pre-lunch work.</p>
            <div style={row}>
              <NumField label="Start hour" value={form.beforeLunchStartHour} min={0} max={23} onChange={v => set('beforeLunchStartHour', v)} />
              <NumField label="Start minute" value={form.beforeLunchStartMinute} min={0} max={59} onChange={v => set('beforeLunchStartMinute', v)} />
              <NumField label="End hour" value={form.beforeLunchEndHour} min={0} max={23} onChange={v => set('beforeLunchEndHour', v)} />
              <NumField label="End minute" value={form.beforeLunchEndMinute} min={0} max={59} onChange={v => set('beforeLunchEndMinute', v)} />
            </div>
          </Section>

          <Divider />

          <Section title="After Lunch Window" icon={<Clock size={15} />}>
            <p style={hint}>Set when after-lunch check-in opens and when the afternoon session closes.</p>
            <div style={row}>
              <NumField label="Start hour" value={form.afterLunchStartHour} min={0} max={23} onChange={v => set('afterLunchStartHour', v)} />
              <NumField label="Start minute" value={form.afterLunchStartMinute} min={0} max={59} onChange={v => set('afterLunchStartMinute', v)} />
              <NumField label="End hour" value={form.afterLunchEndHour} min={0} max={23} onChange={v => set('afterLunchEndHour', v)} />
              <NumField label="End minute" value={form.afterLunchEndMinute} min={0} max={59} onChange={v => set('afterLunchEndMinute', v)} />
            </div>
          </Section>

          <Divider />

          <Section title="Employee Notifications" icon={<Bell size={15} />}>
            <p style={hint}>Employees receive a notification after their own check-in or check-out is recorded.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <NotificationToggle label="Send check-in notifications" checked={form.notifyCheckIn} onChange={() => setForm(p => ({ ...p, notifyCheckIn: !p.notifyCheckIn }))} />
              <NotificationToggle label="Send check-out notifications" checked={form.notifyCheckOut} onChange={() => setForm(p => ({ ...p, notifyCheckOut: !p.notifyCheckOut }))} />
            </div>
          </Section>

          <Divider />

          {error   && <Alert type="error"   text={error} />}
          {success && <Alert type="success" text={success} />}

          <button
            type="submit"
            disabled={saving}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              width:'100%', padding:'11px 0', borderRadius:12,
              background:'#2567eb', color:'#fff', fontWeight:700, fontSize:14,
              border:'none', cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1, transition:'opacity 0.15s',
            }}
          >
            {saving
              ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> Save Settings</>}
          </button>

        </div>
      </form>

      {/* LIVE PREVIEW */}
      <div style={card}>
        <h3 style={{ fontSize:14, fontWeight:700, color:'#f1f4f9', margin:'0 0 16px',
          display:'flex', alignItems:'center', gap:8 }}>
          <Info size={15} style={{ color:'#6093fa' }} /> Live Preview
        </h3>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <PreviewRow color="#22c55e" label="Present"
            desc={`Arrived by ${deadlineLabel} (Start ${startLabel}${form.gracePeriod > 0 ? ` + ${form.gracePeriod} min grace` : ''})`} />
          <PreviewRow color="#eab308" label="Late"
            desc={`Arrived after ${deadlineLabel} — minutes late are recorded`} />
          {form.lunchEnabled && (
            <PreviewRow color="#6093fa" label="Lunch Break"
              desc={`${lunchStartLbl} – ${lunchEndLbl} (${form.lunchDuration} min) — kiosk scan during this window is ignored`} />
          )}
          <PreviewRow color="#94a0b8" label="End of Day"
            desc={`Check-out reference: ${endLabel}`} />
        </div>

        {/* Net hours summary */}
        <div style={{ marginTop:16, padding:'14px 16px', borderRadius:10, background:'#0f182a', border:'1px solid #1e283b' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:12, color:'#64748b' }}>Gross work hours</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#94a0b8' }}>
              {Math.floor(grossMins / 60)}h {grossMins % 60 > 0 ? grossMins % 60 + 'm' : ''}
            </span>
          </div>
          {form.lunchEnabled && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:12, color:'#64748b' }}>− Lunch break</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#6093fa' }}>− {form.lunchDuration} min</span>
            </div>
          )}
          <div style={{ borderTop:'1px solid #1e283b', paddingTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#e2e7f0' }}>Net working hours</span>
            <span style={{ fontSize:15, fontWeight:800, color:'#22c55e' }}>{netLabel}</span>
          </div>
        </div>

        <p style={{ fontSize:11, color:'#475569', marginTop:8, lineHeight:1.6 }}>
          <strong style={{ color:'#64748b' }}>Example:</strong> Start {startLabel}, grace {form.gracePeriod} min → deadline {deadlineLabel}.
          {form.lunchEnabled ? ` Lunch ${lunchStartLbl}–${lunchEndLbl}. Net: ${netLabel}.` : ''}
        </p>
      </div>

    </div>
  );
}

/* ── Sub-components ── */
function Section({ title, icon, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <span style={{ color:'#6093fa' }}>{icon}</span>
        <span style={{ fontSize:13, fontWeight:700, color:'#cbd2e1', textTransform:'uppercase', letterSpacing:'0.05em' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function NotificationToggle({ label, checked, onChange }) {
  return (
    <button type="button" onClick={onChange} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', border:'1px solid #1e283b', borderRadius:9, background:'#0f182a', color: checked ? '#e2e7f0' : '#64748b', cursor:'pointer', textAlign:'left' }}>
      <span style={{ position:'relative', width:38, height:22, borderRadius:11, background: checked ? '#2567eb' : '#2a3b5e', transition:'background .2s', flexShrink:0 }}>
        <span style={{ position:'absolute', top:3, left: checked ? 19 : 3, width:16, height:16, borderRadius:'50%', background:'#f4f8ff', transition:'left .2s' }} />
      </span>
      <span style={{ fontSize:13, fontWeight:600 }}>{label}</span>
    </button>
  );
}

function NumField({ label, value, min, max, onChange, wide }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, flex: wide ? 1 : undefined, minWidth: wide ? undefined : 140 }}>
      <label style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</label>
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: wide ? '100%' : 100, padding:'9px 12px', borderRadius:10,
          background:'#0f182a', border:'1px solid #333e55',
          color:'#f1f4f9', fontSize:15, fontWeight:600,
          outline:'none', boxSizing:'border-box',
        }}
      />
    </div>
  );
}

function PreviewRow({ color, label, desc }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
      <span style={{ width:10, height:10, borderRadius:'50%', background:color, marginTop:3, flexShrink:0 }} />
      <div>
        <span style={{ fontSize:13, fontWeight:700, color:'#e2e7f0' }}>{label}</span>
        <span style={{ fontSize:12, color:'#64748b', marginLeft:8 }}>{desc}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop:'1px solid #1e283b', margin:'4px 0' }} />;
}

function Alert({ type, text }) {
  const isErr = type === 'error';
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'11px 14px', borderRadius:10,
      background: isErr ? 'rgba(29, 62, 127,0.4)' : 'rgba(20, 41, 83,0.4)',
      border:`1px solid ${isErr ? '#991b1b' : '#166534'}`,
      color: isErr ? '#fca5a5' : '#86efac', fontSize:13,
    }}>
      {isErr ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
      {text}
    </div>
  );
}

const card = { background:'#0f182a', border:'1px solid #1e283b', borderRadius:16, padding:'24px', display:'flex', flexDirection:'column', gap:20 };
const hint = { fontSize:12, color:'#64748b', margin:0, lineHeight:1.5 };
const row  = { display:'flex', gap:24, flexWrap:'wrap' };
