import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { userService } from '../services/userService';
import { getDescriptorFromImage, loadModels } from '../utils/faceApi';

const TEMPLATE_HEADERS = [
  'employeeId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'department',
  'position',
  'gender',
  'dateOfBirth',
  'address',
  'status',
];

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function downloadTemplate() {
  const csv = `\uFEFF${TEMPLATE_HEADERS.map(csvCell).join(',')}\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'smart-attendance-employees-template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EmployeeImportDialog({ onClose, onImported }) {
  const inputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [faceProgress, setFaceProgress] = useState(null);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [busy, onClose]);

  const chooseFile = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setPreview(null);
    setResult(null);
    setError('');
    setFaceProgress(null);
  };

  const choosePhotos = (event) => {
    setPhotoFiles(Array.from(event.target.files || []));
    setPreview(null);
    setResult(null);
    setError('');
    setFaceProgress(null);
  };

  const previewFile = async () => {
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }
    setBusy(true);
    setError('');
    setPreview(null);
    setResult(null);
    setFaceProgress(null);
    try {
      const parsed = await userService.previewEmployeeImport(file);
      if (!photoFiles.length) {
        setPreview(parsed);
        return;
      }

      await loadModels();
      const photosById = new Map();
      const duplicatePhotoIds = new Set();
      for (const photo of photoFiles) {
        const dot = photo.name.lastIndexOf('.');
        const employeeId = (dot > 0 ? photo.name.slice(0, dot) : photo.name).trim().toUpperCase();
        if (!employeeId) continue;
        if (photosById.has(employeeId)) duplicatePhotoIds.add(employeeId);
        else photosById.set(employeeId, photo);
      }

      const rows = parsed.rows.map((row) => ({ ...row, employee: { ...row.employee }, errors: [...row.errors] }));
      const eligibleRows = rows.filter((row) => row.valid);
      setFaceProgress({ completed: 0, total: eligibleRows.length });
      for (let index = 0; index < eligibleRows.length; index += 1) {
        const row = eligibleRows[index];
        const employeeId = row.employee.employeeId.toUpperCase();
        const photo = photosById.get(employeeId);
        if (duplicatePhotoIds.has(employeeId)) {
          row.errors.push(`More than one photo was selected for employee ${employeeId}.`);
        } else if (!photo) {
          row.errors.push(`Photo not found. Name the image ${employeeId}.jpg (or another supported image type).`);
        } else {
          try {
            const faceEncoding = await getDescriptorFromImage(photo);
            if (!faceEncoding) {
              row.errors.push('Photo must contain exactly one clearly visible face.');
            } else {
              row.employee.faceEncoding = faceEncoding;
            }
          } catch {
            row.errors.push('Unable to read this photo. Use a supported image format and try again.');
          }
        }
        row.valid = row.errors.length === 0;
        setFaceProgress({ completed: index + 1, total: eligibleRows.length });
        if (index < eligibleRows.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
      }
      const summary = {
        total: rows.length,
        valid: rows.filter((row) => row.valid).length,
        invalid: rows.filter((row) => !row.valid).length,
      };
      setPreview({ ...parsed, rows, summary, requireFace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const importValidRows = async () => {
    if (!preview?.rows?.length || !preview.summary?.valid) return;
    setBusy(true);
    setError('');
    try {
      const imported = await userService.importEmployees(preview.rows, Boolean(preview.requireFace));
      setResult(imported);
      setPreview(imported);
      await onImported();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPhotoFiles([]);
    setPreview(null);
    setResult(null);
    setError('');
    setFaceProgress(null);
    if (inputRef.current) inputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  return (
    <div
      className="employee-import-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        aria-labelledby="employee-import-title"
        aria-modal="true"
        className="employee-import-dialog"
        role="dialog"
      >
        <header className="employee-import-header">
          <div className="employee-import-heading">
            <span className="employee-import-icon"><FileSpreadsheet size={20} /></span>
            <div>
              <h2 id="employee-import-title">Bulk employee upload</h2>
              <p>Import employee profiles from a CSV spreadsheet.</p>
            </div>
          </div>
          <button
            aria-label="Close bulk employee upload"
            className="employee-import-close"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="employee-import-content">
          <div className="employee-import-guidance">
            <strong>Start with the template</strong>
            <p>
              Required columns: employeeId, firstName, lastName, email, department, position.
              Each imported employee receives a login account with the server-configured default password and must change it at first sign-in. Dates must use YYYY-MM-DD.
            </p>
            <button className="employee-import-template" onClick={downloadTemplate} type="button">
              <Download size={16} />
              Download CSV template
            </button>
          </div>

          <div className="employee-import-file">
            <label htmlFor="employee-csv-file">CSV file</label>
            <input
              accept=".csv,text/csv"
              id="employee-csv-file"
              onChange={chooseFile}
              ref={inputRef}
              type="file"
            />
            <span className="employee-import-file-note">
              Maximum 5 MB and 1,000 employee rows. Existing IDs, duplicate rows, and duplicate faces are rejected.
            </span>
            <label htmlFor="employee-photo-files">Face photos (optional)</label>
            <input
              accept="image/jpeg,image/png,image/webp"
              id="employee-photo-files"
              multiple
              onChange={choosePhotos}
              ref={photoInputRef}
              type="file"
            />
            <span className="employee-import-file-note">
              Name each photo with its employee ID, such as EMP001.jpg. Images are processed in your browser; only face descriptors are sent to the server.
            </span>
            <button
              className="employee-import-primary"
              disabled={!file || busy}
              onClick={previewFile}
              type="button"
            >
              {busy && !result ? <Loader2 className="employee-import-spin" size={16} /> : <Upload size={16} />}
              {busy && faceProgress
                ? `Extracting face descriptors ${faceProgress.completed}/${faceProgress.total}…`
                : busy ? 'Validating file…' : 'Preview and validate'}
            </button>
          </div>
          {busy && faceProgress && (
            <progress
              aria-label="Face photo processing progress"
              className="employee-import-progress"
              max={faceProgress.total || 1}
              value={faceProgress.completed}
            />
          )}

          {error && <div className="employee-import-alert employee-import-alert--error" role="alert">{error}</div>}

          {preview && (
            <div className="employee-import-results">
              <div className="employee-import-summary">
                <span><strong>{preview.summary.total}</strong> rows found</span>
                <span className="employee-import-valid"><CheckCircle2 size={15} /> {preview.summary.valid} valid</span>
                <span className="employee-import-invalid"><XCircle size={15} /> {preview.summary.invalid} with errors</span>
              </div>

              {result && (
                <div className="employee-import-alert employee-import-alert--success" role="status">
                  <CheckCircle2 size={17} />
                  <span>
                    Imported {result.imported} employee {result.imported === 1 ? 'profile' : 'profiles'}.
                    {result.summary.invalid > 0 && ` ${result.summary.invalid} row${result.summary.invalid === 1 ? ' was' : 's were'} skipped.`}
                  </span>
                </div>
              )}

              <div className="employee-import-table-wrap">
                <table className="employee-import-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Employee ID</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr className={row.errors.length ? 'has-errors' : ''} key={`${row.rowNumber}-${row.employee.employeeId}`}>
                        <td>{row.rowNumber}</td>
                        <td>{row.employee.employeeId || '—'}</td>
                        <td>{[row.employee.firstName, row.employee.lastName].filter(Boolean).join(' ') || '—'}</td>
                        <td>{row.employee.department || '—'}</td>
                        <td>
                          {row.errors.length
                            ? <span className="employee-import-row-error"><AlertTriangle size={14} /> {row.errors.join(' ')}</span>
                            : row.imported
                              ? <span className="employee-import-valid"><CheckCircle2 size={14} /> Imported</span>
                              : <span className="employee-import-valid"><CheckCircle2 size={14} /> Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="employee-import-footnote">
                {result
                  ? 'Imported profiles are available in the unlinked employee roster. They do not create login accounts; an account can be registered separately and linked by employee ID.'
                  : 'Only valid rows will be imported. Invalid rows will be skipped and retained in this report.'}
              </p>
            </div>
          )}
        </div>

        <footer className="employee-import-footer">
          {result ? (
            <>
              <button className="employee-import-secondary" disabled={busy} onClick={reset} type="button">
                Upload another file
              </button>
              <button className="employee-import-primary" disabled={busy} onClick={onClose} type="button">
                Done
              </button>
            </>
          ) : (
            <>
              <button className="employee-import-secondary" disabled={busy} onClick={onClose} type="button">
                Cancel
              </button>
              <button
                className="employee-import-primary"
                disabled={busy || !preview?.summary?.valid}
                onClick={importValidRows}
                type="button"
              >
                {busy ? <Loader2 className="employee-import-spin" size={16} /> : <CheckCircle2 size={16} />}
                {busy ? 'Importing…' : `Import ${preview?.summary?.valid || 0} valid rows`}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
