/**
 * ManageUsers — /admin/users
 *
 * Layout rules applied:
 *  • Page root: space-y-8 (32 px between every section)
 *  • Filter card: its own surface card, gap-6 between fields
 *  • Table card:  overflow-hidden clips thead to border-radius
 *  • th / td:     px-5 py-4  (20 px × 16 px)
 *  • Every column has an explicit minWidth via inline style
 *  • Horizontal scroll on overflow-x-auto wrapper
 *  • All inputs: zero placeholder attributes
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../services/userService';
import Spinner from '../../components/Spinner';
import { Search, UserPlus, Upload, Camera, Trash2, Pencil, KeyRound, ChevronLeft, ChevronRight, X } from 'lucide-react';
import EmployeeImportDialog from '../../components/EmployeeImportDialog';
import BulkFaceRegistration from '../../components/BulkFaceRegistration';

/* ─── critical card style reused in 2 places ─────────────────────────────── */
const CARD = {
  background:   '#0f182a',
  border:       '1px solid #1e283b',
  borderRadius: '16px',
  overflow:     'hidden',
};

export default function ManageUsers({ readOnly = false }) {
  const navigate = useNavigate();
  const [users,      setUsers]      = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [notice,     setNotice]     = useState('');
  const [resettingId, setResettingId] = useState(null);
  const [search,     setSearch]     = useState('');
  const [dept,       setDept]       = useState('');
  const [depts,      setDepts]      = useState([]);
  const [deleteId,   setDeleteId]   = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [unlinkedEmployees, setUnlinkedEmployees] = useState([]);
  const [unlinkedTotal, setUnlinkedTotal] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [faceImportOpen, setFaceImportOpen] = useState(false);

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const d = await userService.getAll({ search, department: dept, page, limit: 20 });
      setUsers(d.employees);
      setPagination(d.pagination);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [search, dept]);

  const fetchUnlinkedEmployees = useCallback(async () => {
    try {
      const result = await userService.getUnlinkedEmployees({ page: 1, limit: 100 });
      setUnlinkedEmployees(result.employees);
      setUnlinkedTotal(result.pagination.total);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { fetchUsers(1); }, [fetchUsers]);
  useEffect(() => { userService.getDepartments().then(setDepts).catch(() => {}); }, []);
  useEffect(() => {
    if (!readOnly) fetchUnlinkedEmployees();
  }, [fetchUnlinkedEmployees, readOnly]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await userService.remove(deleteId);
      setDeleteId(null);
      fetchUsers(pagination.page);
    } catch (e) { setError(e.message); }
    finally { setDeleting(false); }
  };

  const resetPassword = async user => {
    const action = user.role === 'employee'
      ? 'Reset this employee to the configured default password and require a change at next sign-in?'
      : `Send a password reset link to ${user.email}?`;
    if (!window.confirm(action)) return;
    setError('');
    setNotice('');
    setResettingId(user._id);
    try {
      const response = await userService.resetPassword(user._id);
      setNotice(response.message);
      await fetchUsers(pagination.page);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — PAGE HEADER
          Title left · Register button right
      ═══════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f4f9', letterSpacing: '-0.025em', margin: 0 }}>
            {readOnly ? 'Employee Directory' : 'Employees'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>
            {pagination.total} total employees
          </p>
        </div>

        {!readOnly && (
          <div className="employee-management-actions">
            <button className="employee-management-upload" onClick={() => setFaceImportOpen(true)} type="button">
              <Camera size={16} />
              Bulk face registration
            </button>
            <button className="employee-management-upload" onClick={() => setImportOpen(true)} type="button">
              <Upload size={16} />
              Bulk upload
            </button>
            <button
              className="employee-management-register"
              onClick={() => navigate('/admin/register')}
              type="button"
            >
              <UserPlus size={15} />
              Register Employee
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div role="status" style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(6, 78, 59, 0.35)', border: '1px solid #047857', color: '#a7f3d0', fontSize: '0.875rem' }}>
          {notice}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — FILTER BAR
          Own surface card · gap-6 between controls
          No placeholder text on any input
      ═══════════════════════════════════════════════════════ */}
      <div style={{ ...CARD, overflow: 'visible', padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-end' }}>

          {/* Search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 220px' }}>
            <label style={LABEL_STYLE}>Search name / ID / email</label>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}
              />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...INPUT_STYLE, paddingLeft: '36px' }}
                onFocus={e => { e.target.style.borderColor = '#3b79f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 121, 246,0.15)'; }}
                onBlur={e  => { e.target.style.borderColor = '#333e55'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Department */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
            <label style={LABEL_STYLE}>Department</label>
            <select
              value={dept}
              onChange={e => setDept(e.target.value)}
              style={INPUT_STYLE}
              onFocus={e => { e.target.style.borderColor = '#3b79f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 121, 246,0.15)'; }}
              onBlur={e  => { e.target.style.borderColor = '#333e55'; e.target.style.boxShadow = 'none'; }}
            >
              <option value="">All Departments</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(29, 62, 127,0.3)', border: '1px solid #991b1b', color: '#fca5a5', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — DATA TABLE
          Card with overflow:hidden → thead clips to border-radius
          Inner div: overflow-x:auto → horizontal scroll
          th / td: px-5 py-4 + explicit minWidth per column
      ═══════════════════════════════════════════════════════ */}
      {loading ? <Spinner /> : (
        <div style={CARD}>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>

              {/* ── Table head ── */}
              <thead>
                <tr style={{ background: 'rgba(28, 39, 61,0.8)', borderBottom: '1px solid #1e283b' }}>
                  {(readOnly ? COLUMNS.slice(0, -1) : COLUMNS).map(col => (
                    <th
                      key={col.label}
                      style={{
                        textAlign: 'left',
                        padding: '14px 20px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: '#94a0b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        whiteSpace: 'nowrap',
                        minWidth: col.minWidth,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ── Table body ── */}
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={readOnly ? COLUMNS.length - 1 : COLUMNS.length}
                      style={{ padding: '64px 20px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}
                    >
                      No employees found.
                    </td>
                  </tr>
                )}

                {users.map((u, i) => (
                  <TableRow
                    key={u._id}
                    u={u}
                    isLast={i === users.length - 1}
                    readOnly={readOnly}
                    onEdit={() => navigate(`/admin/register?edit=${u._id}`)}
                    onDelete={() => setDeleteId(u._id)}
                    onResetPassword={() => resetPassword(u)}
                    resetting={resettingId === u._id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination — inside the card, above the bottom rounded edge */}
          {pagination.totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px',
              borderTop: '1px solid #1e283b',
              background: '#0f182a',
            }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Page {pagination.page} of {pagination.totalPages}
                &nbsp;·&nbsp;
                {pagination.total} employees
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <PaginationBtn
                  disabled={pagination.page <= 1}
                  onClick={() => fetchUsers(pagination.page - 1)}
                >
                  <ChevronLeft size={14} />
                </PaginationBtn>
                <PaginationBtn
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchUsers(pagination.page + 1)}
                >
                  <ChevronRight size={14} />
                </PaginationBtn>
              </div>
            </div>
          )}
        </div>
      )}

      {!readOnly && unlinkedTotal > 0 && (
        <section className="employee-import-roster">
          <div className="employee-import-roster-heading">
            <div>
              <h2>Imported employee profiles</h2>
              <p>{unlinkedTotal} profile{unlinkedTotal === 1 ? '' : 's'} without a linked login account</p>
            </div>
            <span className="employee-import-roster-count">{unlinkedTotal}</span>
          </div>
          <p className="employee-import-roster-note">
            These profiles are available for attendance records. Register a login account separately using the same employee ID to link the records.
          </p>
          <div className="employee-import-table-wrap">
            <table className="employee-import-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unlinkedEmployees.map((employee) => (
                  <tr key={employee._id}>
                    <td>{employee.employeeId}</td>
                    <td>{employee.fullName}</td>
                    <td>{employee.email || '—'}</td>
                    <td>{employee.department}</td>
                    <td>{employee.position}</td>
                    <td>{employee.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unlinkedTotal > unlinkedEmployees.length && (
            <p className="employee-import-roster-note">
              Showing the first {unlinkedEmployees.length} imported profiles.
            </p>
          )}
        </section>
      )}

      {importOpen && (
        <EmployeeImportDialog
          onClose={() => setImportOpen(false)}
          onImported={async () => {
            await Promise.all([fetchUsers(pagination.page), fetchUnlinkedEmployees()]);
          }}
        />
      )}
      {faceImportOpen && (
        <div
          className="bulk-face-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFaceImportOpen(false);
          }}
        >
          <div aria-label="Bulk face registration" aria-modal="true" className="bulk-face-modal" role="dialog">
            <BulkFaceRegistration
              onClose={() => setFaceImportOpen(false)}
              onComplete={() => {
                fetchUsers(pagination.page);
                fetchUnlinkedEmployees();
              }}
            />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — DELETE MODAL
      ═══════════════════════════════════════════════════════ */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px',
        }}>
          <div style={{
            background: '#0f182a', border: '1px solid #333e55',
            borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '380px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontWeight: 700, color: '#f1f4f9', fontSize: '1rem', margin: 0 }}>
                Delete Employee
              </h3>
              <button
                onClick={() => setDeleteId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px' }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#94a0b8', lineHeight: 1.6, marginBottom: '24px' }}>
              This permanently removes the employee and all their attendance records.{' '}
              <span style={{ color: '#f87171', fontWeight: 500 }}>This cannot be undone.</span>
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '12px', background: '#1c273d', border: '1px solid #333e55', color: '#cbd2e1', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{ flex: 1, padding: '10px', borderRadius: '12px', background: deleting ? '#1d3e7f' : '#1c50b9', border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Column definitions with explicit min-widths ─────────────────────────── */
const COLUMNS = [
  { label: 'Employee ID', minWidth: '140px' },
  { label: 'Name',        minWidth: '160px' },
  { label: 'Email',       minWidth: '210px' },
  { label: 'Department',  minWidth: '140px' },
  { label: 'Position',    minWidth: '140px' },
  { label: 'Role',        minWidth: '90px'  },
  { label: 'Status',      minWidth: '100px' },
  { label: '',            minWidth: '130px' },
];

/* ── Shared style objects ────────────────────────────────────────────────── */
const LABEL_STYLE = {
  fontSize: '0.6875rem', fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.07em',
};

const INPUT_STYLE = {
  width: '100%', padding: '10px 14px',
  background: '#1c273d', border: '1.5px solid #333e55',
  borderRadius: '10px', color: '#e2e7f0',
  fontSize: '0.875rem', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxSizing: 'border-box',
  appearance: 'none',
};

/* ── Sub-components ──────────────────────────────────────────────────────── */

function TableRow({ u, isLast, onEdit, onDelete, onResetPassword, readOnly, resetting }) {
  const [hovered, setHovered] = useState(false);

  const cellStyle = {
    padding: '16px 20px',
    fontSize: '0.875rem',
    borderBottom: isLast ? 'none' : '1px solid #1e283b',
    background: hovered ? 'rgba(28, 39, 61,0.5)' : 'transparent',
    transition: 'background 0.1s',
  };

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Employee ID */}
      <td style={cellStyle}>
        <code style={{
          fontSize: '0.75rem', background: '#1c273d',
          border: '1px solid #333e55', padding: '3px 8px',
          borderRadius: '6px', color: '#94a0b8', fontFamily: 'monospace',
        }}>
          {u.employeeId}
        </code>
      </td>

      {/* Name */}
      <td style={{ ...cellStyle, fontWeight: 600, color: '#f1f4f9', whiteSpace: 'nowrap' }}>
        {u.fullName}
      </td>

      {/* Email */}
      <td style={{ ...cellStyle, color: '#94a0b8', maxWidth: '210px' }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.email}>
          {u.email}
        </span>
      </td>

      {/* Department */}
      <td style={{ ...cellStyle, color: '#cbd2e1' }}>{u.department}</td>

      {/* Position */}
      <td style={{ ...cellStyle, color: '#94a0b8' }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={u.position}>
          {u.position}
        </span>
      </td>

      {/* Role */}
      <td style={cellStyle}><RoleBadge role={u.role} /></td>

      {/* Status */}
      <td style={cellStyle}>
        <StatusDot active={u.isActive} />
        {u.role === 'employee' && (
          <span style={{ display: 'block', marginTop: '5px', fontSize: '0.6875rem', color: u.mustChangePassword ? '#fbbf24' : '#94a0b8' }}>
            {u.mustChangePassword ? 'Needs password change' : 'Password set'}
          </span>
        )}
      </td>

      {/* Actions */}
      {!readOnly && <td style={cellStyle}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ActionBtn onClick={onEdit}  title="Edit"   hoverColor="rgba(30, 66, 138,0.5)"  color="#6093fa"><Pencil size={13} /></ActionBtn>
          <ActionBtn onClick={onResetPassword} title={u.role === 'employee' ? 'Reset employee password' : 'Email password reset link'} hoverColor="rgba(6,78,59,0.5)" color="#34d399" disabled={resetting}>
            {resetting ? <span style={{ fontSize: '0.65rem' }}>…</span> : <KeyRound size={13} />}
          </ActionBtn>
          <ActionBtn onClick={onDelete} title="Delete" hoverColor="rgba(127,29,29,0.5)" color="#f87171"><Trash2 size={13} /></ActionBtn>
        </div>
      </td>}
    </tr>
  );
}

function ActionBtn({ onClick, title, hoverColor, color, children, disabled = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '7px', borderRadius: '8px',
        background: hovered ? hoverColor : '#1c273d',
        border: '1px solid #333e55',
        color: hovered ? color : '#64748b',
        cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
        opacity: disabled ? 0.55 : 1,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.6875rem', fontWeight: 700,
      padding: '2px 10px', borderRadius: '999px',
      background: isAdmin ? 'rgba(28, 64, 135,0.4)' : 'rgba(29, 91, 216,0.3)',
      color:      isAdmin ? '#b4cdfe' : '#93b6fd',
      border:     isAdmin ? '1px solid rgba(28, 64, 135,0.6)' : '1px solid rgba(29, 91, 216,0.5)',
    }}>
      {role}
    </span>
  );
}

function StatusDot({ active }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 500, whiteSpace: 'nowrap', color: active ? '#4ade80' : '#f87171' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: active ? '#4a7bde' : '#719ef8', flexShrink: 0 }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function PaginationBtn({ disabled, onClick, children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '6px 8px', borderRadius: '8px',
        background: '#1c273d', border: '1px solid #333e55',
        color: '#94a0b8', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1, display: 'flex', alignItems: 'center',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  );
}
