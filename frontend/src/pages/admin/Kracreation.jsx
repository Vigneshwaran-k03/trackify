import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken, getRole, getUserName, getEmail } from '../../utils/authStorage';
// --- IMPORTANT ---
// Import your background image like this
import backgroundImage from '../../assets/background.png';

export default function Kracreation() {
  const [formData, setFormData] = useState({
    name: '',
    definition: '',
    dept: '',
    manager_name: '',
    employee_name: 'Null',
    scoring_method: 'Percentage',
    target: ''
  });
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [userDept, setUserDept] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [myKras, setMyKras] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ kra_id: null, name: '', definition: '', target: '', manager_name: '', employee_name: '', dept: '' });
  const [toast, setToast] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    const name = getUserName();
    const email = getEmail();

    if (!token) {
      window.location.href = '/login';
      return;
    }

    setUserRole(role);
    setUserName(name);

    fetchUserDetails(email, role);
    fetchDepartments();
    fetchMyKras();
  }, []);

  const fetchUserDetails = async () => {
    try {
      const response = await axios.get('http://localhost:3000/auth/profile', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const userData = response.data.user || response.data;
      const department = userData.dept || userData.department || userData.dept_name || '';
      setUserDept(department || '');
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const removeDirect = async (kra) => {
    try {
      const ok = window.confirm(`Delete KRA "${kra.name}" immediately? This cannot be undone.`);
      if (!ok) return;
      await axios.delete(`http://localhost:3000/kra/${kra.kra_id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      await fetchMyKras();
      setToast('KRA deleted');
      setTimeout(()=> setToast(''), 2500);
    } catch (e) {}
  };

  const fetchMyKras = async () => {
    try {
      const res = await axios.get('http://localhost:3000/kra', { headers: { Authorization: `Bearer ${getToken()}` } });
      const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      const me = (getUserName() || '').toLowerCase();
      const mine = list.filter(k => String(k.created_by || '').toLowerCase() === me);
      setMyKras(mine);
    } catch (_) { setMyKras([]); }
  };

  const openEdit = async (kra) => {
    setEditForm({
      kra_id: kra.kra_id,
      name: kra.name || '',
      definition: kra.definition || '',
      target: typeof kra.target === 'number' ? String(kra.target) : '',
      manager_name: kra.manager_name || '',
      employee_name: kra.employee_name || '',
      dept: kra.dept || '',
    });
    // load managers/employees for this dept
    if (kra.dept) {
      await Promise.all([fetchManagers(kra.dept), fetchEmployeesByDepartment(kra.dept)]);
    }
    setEditOpen(true);
  };

  const submitDirectUpdate = async () => {
    try {
      const payload = {
        name: editForm.name,
        definition: editForm.definition,
        target: editForm.target === '' ? null : Number(editForm.target),
        manager_name: editForm.manager_name === '' ? null : editForm.manager_name,
        employee_name: editForm.employee_name === '' ? null : editForm.employee_name,
      };
      await axios.post(`http://localhost:3000/kra/${editForm.kra_id}/update`, payload, { headers: { Authorization: `Bearer ${getToken()}` } });
      setEditOpen(false);
      await fetchMyKras();
      alert('KRA updated');
    } catch (_) {
      setEditOpen(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get('http://localhost:3000/users/departments', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchManagers = async (dept) => {
    try {
      if (!dept) return;
      const response = await axios.get(
        `http://localhost:3000/users/department/${dept}/managers`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setManagers(response.data || []);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  // Load managers when dept filter changes (for table filter)
  useEffect(() => {
    if (deptFilter) {
      fetchManagers(deptFilter);
    } else {
      setManagers([]);
      setManagerFilter('');
    }
  }, [deptFilter]);

  const fetchEmployeesByDepartment = async (dept) => {
    try {
      const response = await axios.get(
        `http://localhost:3000/users/department/${dept}/employees`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'dept') {
      fetchManagers(value);
      fetchEmployeesByDepartment(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('http://localhost:3000/kra/create', {
        ...formData,
        target: formData.target === '' ? null : Number(formData.target),
      }, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        setMessage('KRA created successfully!');
        setFormData({
          name: '',
          definition: '',
          dept: '',
          manager_name: '',
          employee_name: '',
          scoring_method: 'Percentage',
          target: ''
        });
        setEmployees([]);
        setManagers([]);
        // Close modal on success
        setCreateOpen(false);
        // Refresh KRA list
        await fetchMyKras();
      } else {
        setMessage(response.data.message || 'Error creating KRA');
      }
    } catch (error) {
      console.error('Error creating KRA:', error);
      setMessage(error.response?.data?.message || 'Error creating KRA');
    } finally {
      setLoading(false);
    }
  };

  if (!userRole) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  if ((userRole || '').toLowerCase() !== 'admin') return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Unauthorized</div>;

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Main Content Frosted Card */}
      <div className="bg-white/20 backdrop-blur-md rounded-lg shadow-xl p-4 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <h2 className="text-3xl font-bold text-white mb-2">Create New KRA (Admin)</h2>
          <button type="button" onClick={()=> setCreateOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 shadow-lg">Create KRA</button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded ${
            message.toLowerCase().includes('success')
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

        <div className="mt-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-3 gap-4">
            <h3 className="text-2xl font-semibold text-white">My Created KRAs</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-200">Dept</label>
              <select className="p-2 border border-gray-300/50 rounded text-sm text-black bg-white/80" value={deptFilter} onChange={(e)=> { setDeptFilter(e.target.value); setManagerFilter(''); }}>
                <option value="">All</option>
                {departments.map(d => (
                  <option key={d.id || d.name} value={d.name || d}>{d.name || d}</option>
                ))}
              </select>
              <label className="text-sm text-gray-200">Manager</label>
              <select className="p-2 border border-gray-300/50 rounded text-sm text-black bg-white/80" value={managerFilter} onChange={(e)=> setManagerFilter(e.target.value)}>
                <option value="">All</option>
                {managers.map(m => (
                  <option key={m.user_id || m.id || m.email} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-white/20 text-left">
              <thead>
                <tr className="bg-white/30">
                  <th className="p-2 text-white/90">Name</th>
                  <th className="p-2 text-white/90">Definition</th>
                  <th className="p-2 text-white/90">Dept</th>
                  <th className="p-2 text-white/90">Manager</th>
                  <th className="p-2 text-white/90">Employee</th>
                  <th className="p-2 text-white/90">Target</th>
                  <th className="p-2 text-white/90">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(myKras
                  .filter(k => !deptFilter || String(k.dept || '') === String(deptFilter))
                  .filter(k => !managerFilter || String(k.manager_name || '') === String(managerFilter))
                ).map(k => (
                  <tr key={k.kra_id} className="border-t border-white/20 hover:bg-white/10 transition-colors">
                    <td className="p-2 text-white">{k.name}</td>
                    <td className="p-2 max-w-xs truncate text-white" title={k.definition}>{k.definition}</td>
                    <td className="p-2 text-white">{k.dept}</td>
                    <td className="p-2 text-white">{k.manager_name || '-'}</td>
                    <td className="p-2 text-white">{k.employee_name || '-'}</td>
                    <td className="p-2 text-white">{typeof k.target === 'number' ? k.target : '-'}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button type="button" className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={()=> openEdit(k)}>Change</button>
                        <button type="button" className="px-3 py-1 rounded border border-red-400 text-red-300 hover:bg-red-400 hover:text-white" onClick={()=> removeDirect(k)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!myKras.length && (
                  <tr><td className="p-3 text-gray-100" colSpan="7">No KRAs created by you yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* End Main Content Card */}


      {/* Create KRA Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white/20 backdrop-blur-md w-full max-w-lg rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Create KRA</h3>
              <button className="text-gray-100 hover:text-white" onClick={()=> setCreateOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">KRA Name *</label>
                <input type="text" placeholder="Enter KRA Name" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-3 border border-gray-300/50 rounded-md focus:ring-2 focus:ring-indigo-400 text-black bg-white/80 placeholder-gray-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Definition *</label>
                <textarea placeholder="Enter Definition" name="definition" value={formData.definition} onChange={handleInputChange} rows={4} className="w-full p-3 border border-gray-300/50 rounded-md focus:ring-2 focus:ring-indigo-400 text-black bg-white/80 placeholder-gray-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Department *</label>
                <select name="dept" value={formData.dept} onChange={handleInputChange} className="w-full p-3 border border-gray-300/50 rounded-md focus:ring-2 focus:ring-indigo-400 text-black bg-white/80" required>
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">KRA Target (0-100)</label>
                <input type="number" min="0" max="100" name="target" placeholder="e.g., 100" value={formData.target} onChange={handleInputChange} className="w-full p-3 border border-gray-300/50 rounded-md focus:ring-2 focus:ring-indigo-400 text-black bg-white/80 placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Manager *</label>
                <select name="manager_name" value={formData.manager_name} onChange={handleInputChange} className="w-full p-3 border border-gray-300/50 rounded-md focus:ring-2 focus:ring-indigo-400 text-black bg-white/80" required disabled={!formData.dept}>
                  <option value="">{!formData.dept ? 'Select Department First' : 'Select Manager'}</option>
                  {!!formData.dept && <option value="all">All</option>}
                  {managers.map((m) => (
                    <option key={m.user_id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Scoring Method *</label>
                <input type="text" name="scoring_method" value={formData.scoring_method} readOnly className="w-full p-3 border border-gray-300/50 rounded-md bg-gray-200/80 text-gray-700" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 rounded border border-white/50 text-white hover:bg-white/10" onClick={()=> setCreateOpen(false)}>Cancel</button>
                <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit KRA Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white/20 backdrop-blur-md w-full max-w-lg rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Update KRA: {editForm.name}</h3>
              <button className="text-gray-100 hover:text-white" onClick={()=> setEditOpen(false)}>✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-100 mb-1">KRA Name</label>
                <input className="w-full p-2 border border-gray-300/50 rounded text-black bg-white/80 placeholder-gray-500" value={editForm.name} onChange={(e)=> setEditForm(prev=>({ ...prev, name: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-100 mb-1">Definition</label>
                <textarea className="w-full p-2 border border-gray-300/50 rounded text-black bg-white/80 placeholder-gray-500" rows={3} value={editForm.definition} onChange={(e)=> setEditForm(prev=>({ ...prev, definition: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Target</label>
                <input type="number" min="0" max="100" className="w-full p-2 border border-gray-300/50 rounded text-black bg-white/80 placeholder-gray-500" value={editForm.target} onChange={(e)=> setEditForm(prev=>({ ...prev, target: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Manager</label>
                <select className="w-full p-2 border border-gray-300/50 rounded text-black bg-white/80" value={editForm.manager_name} onChange={(e)=> setEditForm(prev=>({ ...prev, manager_name: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {managers.map(m => (<option key={m.user_id || m.name} value={m.name}>{m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">Employee</label>
                <select className="w-full p-2 border border-gray-300/50 rounded text-black bg-white/80" value={editForm.employee_name} onChange={(e)=> setEditForm(prev=>({ ...prev, employee_name: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {employees.map(emp => (<option key={emp.user_id || emp.name} value={emp.name}>{emp.name}</option>))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 rounded border border-white/50 text-white hover:bg-white/10" onClick={()=> setEditOpen(false)}>Cancel</button>
              <button className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={submitDirectUpdate}>Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {!!toast && (
        <div className="fixed right-4 bottom-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg">{toast}</div>
      )}
    </div>
  );
}