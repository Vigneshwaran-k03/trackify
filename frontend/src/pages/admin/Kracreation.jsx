import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken, getRole, getUserName, getEmail } from '../../utils/authStorage';

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

  if (!userRole) return <div>Loading...</div>;
  if ((userRole || '').toLowerCase() !== 'admin') return <div>Unauthorized</div>;

  return (
    <div className="min-h-screen bg-white p-8 rounded-lg shadow-lg">
      <div className="mb-8 flex items-start justify-between">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Create New KRA (Admin)</h2>
        <button type="button" onClick={()=> setCreateOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Create KRA</button>
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
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create KRA</h3>
              <button className="text-gray-600" onClick={()=> setCreateOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KRA Name *</label>
                <input type="text" placeholder="Enter KRA Name" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-black" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Definition *</label>
                <textarea placeholder="Enter Definition" name="definition" value={formData.definition} onChange={handleInputChange} rows={4} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-black" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                <select name="dept" value={formData.dept} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-black" required>
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KRA Target (0-100)</label>
                <input type="number" min="0" max="100" name="target" placeholder="e.g., 100" value={formData.target} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager *</label>
                <select name="manager_name" value={formData.manager_name} onChange={handleInputChange} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-black" required disabled={!formData.dept}>
                  <option value="">{!formData.dept ? 'Select Department First' : 'Select Manager'}</option>
                  {!!formData.dept && <option value="all">All</option>}
                  {managers.map((m) => (
                    <option key={m.user_id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scoring Method *</label>
                <input type="text" name="scoring_method" value={formData.scoring_method} readOnly className="w-full p-3 border border-gray-300 rounded-md bg-gray-100 text-gray-700" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="px-4 py-2 rounded border" onClick={()=> setCreateOpen(false)}>Cancel</button>
                <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-2xl font-semibold">My Created KRAs</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Dept</label>
            <select className="p-2 border rounded text-sm" value={deptFilter} onChange={(e)=> { setDeptFilter(e.target.value); setManagerFilter(''); }}>
              <option value="">All</option>
              {departments.map(d => (
                <option key={d.id || d.name} value={d.name || d}>{d.name || d}</option>
              ))}
            </select>
            <label className="text-sm text-gray-600">Manager</label>
            <select className="p-2 border rounded text-sm" value={managerFilter} onChange={(e)=> setManagerFilter(e.target.value)}>
              <option value="">All</option>
              {managers.map(m => (
                <option key={m.user_id || m.id || m.email} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-left text-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Name</th>
                <th className="p-2">Definition</th>
                <th className="p-2">Dept</th>
                <th className="p-2">Manager</th>
                <th className="p-2">Employee</th>
                <th className="p-2">Target</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(myKras
                .filter(k => !deptFilter || String(k.dept || '') === String(deptFilter))
                .filter(k => !managerFilter || String(k.manager_name || '') === String(managerFilter))
              ).map(k => (
                <tr key={k.kra_id} className="border-t">
                  <td className="p-2">{k.name}</td>
                  <td className="p-2 max-w-xs truncate" title={k.definition}>{k.definition}</td>
                  <td className="p-2">{k.dept}</td>
                  <td className="p-2">{k.manager_name || '-'}</td>
                  <td className="p-2">{k.employee_name || '-'}</td>
                  <td className="p-2">{typeof k.target === 'number' ? k.target : '-'}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button type="button" className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={()=> openEdit(k)}>Change</button>
                      <button type="button" className="px-3 py-1 rounded border" onClick={()=> removeDirect(k)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!myKras.length && (
                <tr><td className="p-3 text-gray-600" colSpan="7">No KRAs created by you yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Update KRA: {editForm.name}</h3>
              <button className="text-gray-600" onClick={()=> setEditOpen(false)}>✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">KRA Name</label>
                <input className="w-full p-2 border rounded text-black" value={editForm.name} onChange={(e)=> setEditForm(prev=>({ ...prev, name: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Definition</label>
                <textarea className="w-full p-2 border rounded text-black" rows={3} value={editForm.definition} onChange={(e)=> setEditForm(prev=>({ ...prev, definition: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target</label>
                <input type="number" min="0" max="100" className="w-full p-2 border rounded text-black" value={editForm.target} onChange={(e)=> setEditForm(prev=>({ ...prev, target: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Manager</label>
                <select className="w-full p-2 border rounded text-black" value={editForm.manager_name} onChange={(e)=> setEditForm(prev=>({ ...prev, manager_name: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {managers.map(m => (<option key={m.user_id || m.name} value={m.name}>{m.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Employee</label>
                <select className="w-full p-2 border rounded text-black" value={editForm.employee_name} onChange={(e)=> setEditForm(prev=>({ ...prev, employee_name: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {employees.map(emp => (<option key={emp.user_id || emp.name} value={emp.name}>{emp.name}</option>))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 rounded border" onClick={()=> setEditOpen(false)}>Cancel</button>
              <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={submitDirectUpdate}>Update</button>
            </div>
          </div>
        </div>
      )}
      {!!toast && (
        <div className="fixed right-4 bottom-4 bg-green-600 text-white px-4 py-2 rounded shadow">{toast}</div>
      )}
    </div>
  );
}
