import PropTypes from 'prop-types';

export default function AttendanceScanner({ videoRef, active = false, faceStatus = '' }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <video
        ref={videoRef}
        aria-label="Live attendance camera"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transform: 'scaleX(-1)',
        }}
        muted
        playsInline
      />

      {active && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: '16px',
          }}
        >
          <div
            className="kiosk-scan-ring"
            aria-hidden="true"
            style={{
              width: 'min(48vw, 192px)',
              height: 'min(56vw, 224px)',
              borderRadius: '20px',
              border: '2.5px solid #6093fa',
            }}
          />
          <p style={{
            marginTop: '16px',
            maxWidth: '90%',
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#f8f9fc',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}>
            {faceStatus}
          </p>
        </div>
      )}
    </div>
  );
}

AttendanceScanner.propTypes = {
  videoRef: PropTypes.object,
  active: PropTypes.bool,
  faceStatus: PropTypes.string,
};
