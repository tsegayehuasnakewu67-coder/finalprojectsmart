export default function Spinner({ fullScreen = false, size = 32 }) {
  const ring = (
    <div
      aria-hidden="true"
      className="app-spinner"
      style={{ width: size, height: size }}
    />
  );
  if (fullScreen) {
    return <div className="app-loading-screen" role="status" aria-label="Loading">{ring}</div>;
  }
  return <div className="app-loading-inline" role="status" aria-label="Loading">{ring}</div>;
}
