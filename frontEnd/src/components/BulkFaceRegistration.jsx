import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ErrorBoundary } from 'react-error-boundary';
import { useDropzone } from 'react-dropzone';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileImage,
  FileSpreadsheet,
  LoaderCircle,
  RotateCcw,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import useBulkUpload from '../hooks/useBulkUpload';
import {
  buildResultCsv,
  parseEmployeeCsv,
  summarizeRows,
  validatePhotoMatches,
} from '../utils/bulkFaceRegistration';

const CSV_ACCEPT = { 'text/csv': ['.csv'] };
const PHOTO_ACCEPT = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] };

function DropArea({ title, detail, icon: Icon, files, getRootProps, getInputProps, isDragActive }) {
  return (
    <div
      {...getRootProps({
        className: `bulk-face-dropzone${isDragActive ? ' is-dragging' : ''}`,
        'aria-label': title,
      })}
    >
      <input {...getInputProps()} />
      <span className="bulk-face-drop-icon"><Icon size={22} /></span>
      <strong>{isDragActive ? 'Drop files to add them' : title}</strong>
      <span>{detail}</span>
      {files.length > 0 && (
        <small>{files.length === 1 ? files[0].name : `${files.length} photos selected`}</small>
      )}
    </div>
  );
}

DropArea.propTypes = {
  title: PropTypes.string.isRequired,
  detail: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  files: PropTypes.arrayOf(PropTypes.object).isRequired,
  getRootProps: PropTypes.func.isRequired,
  getInputProps: PropTypes.func.isRequired,
  isDragActive: PropTypes.bool.isRequired,
};

function ResultIcon({ status }) {
  if (status === 'Success') return <CheckCircle2 size={16} aria-hidden="true" />;
  if (status === 'Skipped') return <AlertCircle size={16} aria-hidden="true" />;
  if (status === 'Processing' || status === 'Queued') return <LoaderCircle size={16} aria-hidden="true" />;
  return <XCircle size={16} aria-hidden="true" />;
}

ResultIcon.propTypes = { status: PropTypes.string.isRequired };

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <section className="bulk-face-error-boundary" role="alert">
      <AlertCircle size={28} />
      <h2>Bulk face registration stopped unexpectedly</h2>
      <p>{error.message || 'An unexpected interface error occurred.'}</p>
      <button className="bulk-face-button bulk-face-button--secondary" onClick={resetErrorBoundary} type="button">
        <RotateCcw size={16} /> Try again
      </button>
    </section>
  );
}

ErrorFallback.propTypes = {
  error: PropTypes.shape({ message: PropTypes.string }).isRequired,
  resetErrorBoundary: PropTypes.func.isRequired,
};

function BulkFaceRegistrationContent({ onComplete, onClose }) {
  const [csvFile, setCsvFile] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [validationError, setValidationError] = useState('');
  const [parsing, setParsing] = useState(false);
  const { results, progress, running, complete, run, cancel, reset: resetRun } = useBulkUpload();

  const csvDropzone = useDropzone({
    accept: CSV_ACCEPT,
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    disabled: running,
    onDrop: (accepted, rejected) => {
      if (rejected.length) {
        setValidationError(rejected[0].errors[0]?.message || 'Choose a CSV file smaller than 5 MB.');
        setCsvFile(null);
        setPreviewRows([]);
      } else if (accepted[0]) {
        setCsvFile(accepted[0]);
        setPreviewRows([]);
        setValidationError('');
      }
    },
  });

  const photoDropzone = useDropzone({
    accept: PHOTO_ACCEPT,
    maxFiles: 1000,
    maxSize: 5 * 1024 * 1024,
    multiple: true,
    disabled: running,
    onDrop: (accepted, rejected) => {
      setPhotoFiles((current) => [...current, ...accepted]);
      setPreviewRows([]);
      if (rejected.length) {
        const first = rejected[0];
        setValidationError(`${first.file.name}: ${first.errors[0]?.message || 'Choose a JPG or PNG under 5 MB.'}`);
      } else {
        setValidationError('');
      }
    },
  });

  const summary = useMemo(() => summarizeRows(previewRows), [previewRows]);
  const percent = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0;
  const canStart = previewRows.some((row) => row.valid) && !running;

  const preparePreview = async () => {
    if (!csvFile) {
      setValidationError('Add a CSV file before previewing the batch.');
      return;
    }
    setParsing(true);
    setValidationError('');
    try {
      const parsedRows = await parseEmployeeCsv(csvFile);
      const validated = validatePhotoMatches(parsedRows, photoFiles);
      setPreviewRows(validated);
    } catch (error) {
      setValidationError(error.message || 'Unable to validate these files.');
      setPreviewRows([]);
    } finally {
      setParsing(false);
    }
  };

  const startUpload = async () => {
    if (!canStart) return;
    await run(previewRows);
    onComplete?.();
  };

  const downloadResults = () => {
    const report = buildResultCsv(results);
    const url = URL.createObjectURL(new Blob([report], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `face-registration-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reset = () => {
    resetRun();
    setCsvFile(null);
    setPhotoFiles([]);
    setPreviewRows([]);
    setValidationError('');
    if (csvDropzone.inputRef.current) csvDropzone.inputRef.current.value = '';
    if (photoDropzone.inputRef.current) photoDropzone.inputRef.current.value = '';
  };

  return (
    <main className="bulk-face-registration">
      <header className="bulk-face-page-header">
        <div>
          <span className="bulk-face-eyebrow">EMPLOYEE ENROLLMENT</span>
          <h1>Bulk face registration</h1>
          <p>Validate employee details and enroll one photo at a time.</p>
        </div>
        {onClose && (
          <button aria-label="Close bulk face registration" className="bulk-face-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        )}
        {complete && (
          <button className="bulk-face-button bulk-face-button--secondary" onClick={downloadResults} type="button">
            <Download size={16} /> Download results CSV
          </button>
        )}
      </header>

      <section aria-label="Select employee files" className="bulk-face-card">
        <div className="bulk-face-card-heading">
          <div>
            <h2>Upload employee files</h2>
            <p>CSV up to 5 MB and 1,000 rows; each JPG or PNG photo up to 5 MB.</p>
          </div>
          {previewRows.length > 0 && (
            <div aria-live="polite" className="bulk-face-counts">
              <span>{summary.total} total</span>
              <span className="is-valid">{summary.valid} valid</span>
              <span className="is-invalid">{summary.invalid} invalid</span>
            </div>
          )}
        </div>

        <div className="bulk-face-drop-grid">
          <DropArea
            title="Employee CSV"
            detail="Drop a .csv file or browse"
            icon={FileSpreadsheet}
            files={csvFile ? [csvFile] : []}
            {...csvDropzone}
          />
          <DropArea
            title="Employee photos"
            detail="Drop JPG or PNG photos; filenames must match photoFileName"
            icon={FileImage}
            files={photoFiles}
            {...photoDropzone}
          />
        </div>

        {validationError && <p className="bulk-face-alert" role="alert">{validationError}</p>}

        <div className="bulk-face-actions">
          <button
            className="bulk-face-button bulk-face-button--secondary"
            disabled={!csvFile || parsing || running}
            onClick={preparePreview}
            type="button"
          >
            {parsing ? <LoaderCircle className="is-spinning" size={16} /> : <FileSpreadsheet size={16} />}
            {parsing ? 'Validating…' : 'Preview and validate'}
          </button>
          {previewRows.length > 0 && !complete && (
            <button
              className="bulk-face-button bulk-face-button--primary"
              disabled={!canStart}
              onClick={startUpload}
              type="button"
            >
              {running ? <LoaderCircle className="is-spinning" size={16} /> : <Upload size={16} />}
              {running ? 'Registering faces…' : `Register ${summary.valid} valid rows`}
            </button>
          )}
          {running && (
            <button className="bulk-face-button bulk-face-button--danger" onClick={cancel} type="button">
              Cancel batch
            </button>
          )}
          {complete && (
            <button className="bulk-face-button bulk-face-button--secondary" onClick={reset} type="button">
              <RotateCcw size={16} /> Start another batch
            </button>
          )}
        </div>
      </section>

      {previewRows.length > 0 && (
        <section aria-label="Employee preview" className="bulk-face-card">
          <div className="bulk-face-card-heading">
            <div>
              <h2>{running || complete ? 'Registration results' : 'Preview rows'}</h2>
              <p>{running ? `Processing ${progress.current || 'next employee'} (${progress.processed}/${progress.total})` : 'Review employee identity and matched photo before enrollment.'}</p>
            </div>
            {(running || complete) && (
              <strong className="bulk-face-percent" aria-live="polite">{percent}%</strong>
            )}
          </div>

          {(running || complete) && (
            <div
              aria-label={`Upload progress ${percent}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={percent}
              className="bulk-face-progress-track"
              role="progressbar"
            >
              <span style={{ width: `${percent}%` }} />
            </div>
          )}

          <div className="bulk-face-table-scroll">
            <table className="bulk-face-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Photo</th>
                  <th>Status / Error</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => {
                  const result = results[index];
                  const status = result?.status || (row.valid ? 'Ready' : 'Invalid');
                  const error = result?.error || row.errors.join(' ');
                  return (
                    <tr className={!row.valid || status === 'Failed' ? 'has-error' : ''} key={`${row.rowNumber}-${row.employeeId}`}>
                      <td>{row.employeeId || '—'}</td>
                      <td>{row.name || '—'}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.photoStatus}</td>
                      <td>
                        <span className={`bulk-face-badge bulk-face-badge--${status.toLowerCase()}`}>
                          <ResultIcon status={status} /> {status}
                        </span>
                        {error && <span className="bulk-face-row-error">{error}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {complete && (
        <section aria-live="polite" className="bulk-face-card">
          <div className="bulk-face-card-heading">
            <div>
              <h2>Batch summary</h2>
              <p>{results.filter((result) => result.status === 'Success').length} successful, {results.filter((result) => result.status === 'Skipped').length} skipped, {results.filter((result) => ['Failed', 'Cancelled'].includes(result.status)).length} failed or cancelled.</p>
            </div>
            <button className="bulk-face-button bulk-face-button--secondary" onClick={downloadResults} type="button">
              <Download size={16} /> Export CSV
            </button>
          </div>
          <ul className="bulk-face-error-list">
            {results.filter((result) => result.error).map((result) => (
              <li key={`${result.rowNumber}-${result.fileName}-${result.status}`}>
                <strong>{result.fileName || `Row ${result.rowNumber}`}</strong>: {result.error}
              </li>
            ))}
          </ul>
          {results.every((result) => !result.error) && <p className="bulk-face-success-note">All processed rows completed without errors.</p>}
        </section>
      )}
    </main>
  );
}

BulkFaceRegistrationContent.propTypes = {
  onComplete: PropTypes.func,
  onClose: PropTypes.func,
};

BulkFaceRegistrationContent.defaultProps = {
  onComplete: undefined,
  onClose: undefined,
};

export default function BulkFaceRegistration({ onComplete, onClose }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <BulkFaceRegistrationContent onComplete={onComplete} onClose={onClose} />
    </ErrorBoundary>
  );
}

BulkFaceRegistration.propTypes = {
  onComplete: PropTypes.func,
  onClose: PropTypes.func,
};

BulkFaceRegistration.defaultProps = {
  onComplete: undefined,
  onClose: undefined,
};
