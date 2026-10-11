/**
 * LoadingSpinner
 * Props:
 *   fullScreen {boolean} — centres spinner in the full viewport
 *   size       {number}  — diameter in px (default 40)
 *   color      {string}  — spinner colour (default #3b79f6)
 */
export default function LoadingSpinner({ fullScreen = false, size = 40, color = '#3b79f6' }) {
  const spinner = (
    <div style={{ ...styles.spinner, width: size, height: size, borderTopColor: color }} />
  );

  if (fullScreen) {
    return <div style={styles.overlay}>{spinner}</div>;
  }

  return <div style={styles.inline}>{spinner}</div>;
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15, 23, 42, 0.72)',
    zIndex: 9999,
  },
  inline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  spinner: {
    borderRadius: '50%',
    border: '4px solid #e2e7f0',
    borderTopColor: '#3b79f6',
    animation: 'spin 0.75s linear infinite',
  },
};

// Inject keyframe once
if (typeof document !== 'undefined' && !document.getElementById('spinner-style')) {
  const style = document.createElement('style');
  style.id = 'spinner-style';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
