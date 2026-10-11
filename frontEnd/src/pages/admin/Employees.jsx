import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../services/userService';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function Employees() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEmployees = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await userService.getAll({ search, department, page, limit: 20 });
      setEmployees(data.employees);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, department]);

  useEffect(() => { fetchEmployees(1); }, [fetchEmployees]);

  useEffect(() => {
    userService.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await userService.remove(deleteId);
      setDeleteId(null);
      fetchEmployees(pagination.page);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Employees</h2>
          <p style={styles.pageSub}>{pagination.total} total employees</p>
        </div>
        <button onClick={() => navigate('/admin/employees/new')} style={styles.addBtn}>
          + Register Employee
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          style={styles.select}
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {/* Table */}
      {loading ? <LoadingSpinner /> : (
        <>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Employee ID', 'Name', 'Email', 'Department', 'Position', 'Role', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr><td colSpan={8} style={styles.empty}>No employees found.</td></tr>
                )}
                {employees.map((emp) => (
                  <tr key={emp._id} style={styles.tr}>
                    <td style={styles.td}><code style={styles.empId}>{emp.employeeId}</code></td>
                    <td style={styles.td}>
                      <p style={styles.empName}>{emp.fullName}</p>
                    </td>
                    <td style={styles.td}><span style={styles.smallText}>{emp.email}</span></td>
                    <td style={styles.td}>{emp.department}</td>
                    <td style={styles.td}><span style={styles.smallText}>{emp.position}</span></td>
                    <td style={styles.td}><RoleBadge role={emp.role} /></td>
                    <td style={styles.td}><StatusDot active={emp.isActive} /></td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button
                          onClick={() => navigate(`/admin/employees/new?edit=${emp._id}`)}
                          style={styles.editBtn}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(emp._id)}
                          style={styles.deleteBtn}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchEmployees(pagination.page - 1)}
                style={styles.pageBtn}
              >
                ← Prev
              </button>
              <span style={styles.pageInfo}>Page {pagination.page} of {pagination.totalPages}</span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchEmployees(pagination.page + 1)}
                style={styles.pageBtn}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: '0 0 12px', color: '#0f182a' }}>Delete Employee</h3>
            <p style={{ color: '#64748b', marginBottom: 20 }}>
              This will permanently delete the employee and all their attendance records. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={styles.cancelBtn}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={styles.confirmDeleteBtn}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  return (
    <span style={{
      background: role === 'admin' ? '#e9f0fe' : '#f0f5fe',
      color: role === 'admin' ? '#3a76ed' : '#3b79f6',
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    }}>
      {role}
    </span>
  );
}

function StatusDot({ active }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: active ? '#16a34a' : '#dc2626' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#2258c5' : '#447def', display: 'inline-block' }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#0f182a' },
  pageSub: { margin: 0, color: '#64748b', fontSize: 13 },
  addBtn: {
    background: '#3c7af5', color: '#fff', border: 'none',
    borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  filters: { display: 'flex', gap: 12, marginBottom: 16 },
  searchInput: {
    flex: 1, padding: '9px 14px', border: '1px solid #e2e7f0',
    borderRadius: 8, fontSize: 14, outline: 'none',
  },
  select: {
    padding: '9px 14px', border: '1px solid #e2e7f0',
    borderRadius: 8, fontSize: 14, background: '#f4f8ff', cursor: 'pointer',
  },
  error: { background: '#f1f5fe', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 12 },
  tableWrap: { background: '#f4f8ff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f4f6fa', borderBottom: '1px solid #e2e7f0', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tr: { borderBottom: '1px solid #f1f4f9' },
  td: { padding: '12px 16px', fontSize: 13, color: '#333e55', verticalAlign: 'middle' },
  empId: { background: '#f1f4f9', padding: '2px 6px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' },
  empName: { margin: 0, fontWeight: 600, color: '#1e283b' },
  smallText: { color: '#64748b', fontSize: 12 },
  empty: { textAlign: 'center', padding: 32, color: '#94a0b8', fontSize: 14 },
  actions: { display: 'flex', gap: 6 },
  editBtn: { background: '#f0f5fe', color: '#3b79f6', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  deleteBtn: { background: '#f1f5fe', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
  pageBtn: { background: '#f4f8ff', border: '1px solid #e2e7f0', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
  pageInfo: { fontSize: 13, color: '#64748b' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#f4f8ff', borderRadius: 12, padding: 28, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  cancelBtn: { background: '#f1f4f9', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, cursor: 'pointer' },
  confirmDeleteBtn: { background: '#2663dc', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
};
