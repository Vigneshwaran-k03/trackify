import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken, getRole, getUserName } from '../../utils/authStorage';
// Import the background image
import backgroundImage from '../../assets/background.png';

export default function ManagerKracreation() {
  const [formData, setFormData] = useState({
    name: '',
    definition: '',
    dept: '',
    manager_name: '',
    employee_name: '',
    scoring_method: 'Percentage',
    target: ''
  });
  const [employees, setEmployees] = useState([]);
  const [userDept, setUserDept] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [myKras, setMyKras] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ kra_id: null, name: '', definition: '', target: '', employee_name: '' });
  const [toast, setToast] = useState('');
  const [admins, setAdmins] = useState([]);
  const [adminSelect, setAdminSelect] = useState({ open: false, mode: '', kra: null, approver: '' }); // mode: 'change' | 'delete'

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    const name = getUserName();

    if (!token || (role || '').toLowerCase() !== 'manager') {
      window.location.href = '/login';
      return;
    }

    setUserName(name || '');
    fetchProfileAndEmployees();
    fetchMyKras();
    // Load admins for routing change/remove requests
    (async () => {
      try {
        const res = await axios.get('http://localhost:3000/users/admins', { headers: { Authorization: `Bearer ${getToken()}` } });
        setAdmins(Array.isArray(res.data) ? res.data : (res.data?.data || []));
      } catch (_) { setAdmins([]); }
    })();
  }, []);

  // Refetch KRAs once dept is known to prefer dept-scoped endpoint
  useEffect(() => {
    if (userDept) fetchMyKras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDept]);

  const fetchProfileAndEmployees = async () => {
    try {
      const profileRes = await axios.get('http://localhost:3000/auth/profile', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const profile = profileRes.data.user || profileRes.data;
      const dept = profile.dept || profile.department || profile.dept_name || '';
      setUserDept(dept);
      setFormData(prev => ({ ...prev, dept: dept }));

      if (dept) {
        const empRes = await axios.get(`http://localhost:3000/users/department/${dept}/employees`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        setEmployees(empRes.data || []);
      }
    } catch (err) {
      console.error('Error fetching profile/employees', err);
    }
  };

  const fetchMyKras = async () => {
    try {
      const dept = userDept;
      const res = await axios.get(dept ? `http://localhost:3000/kra/department/${encodeURIComponent(dept)}` : 'http://localhost:3000/kra', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      const me = (getUserName() || '').toLowerCase();
      const mine = list.filter(k => String(k.created_by || '').toLowerCase() === me);
      setMyKras(mine);
    } catch (_) {
      setMyKras([]);
    }
  };

  const openEdit = (kra) => {
    setEditForm({
      kra_id: kra.kra_id,
      name: kra.name || '',
      definition: kra.definition || '',
      target: typeof kra.target === 'number' ? String(kra.target) : '',
      employee_name: kra.employee_name || '',
    });
    setEditOpen(true);
  };

  const submitRequestChange = async () => {
    try {
      const changes = {};
      if (editForm.name !== '') changes.name = editForm.name;
      if (editForm.definition !== '') changes.definition = editForm.definition;
      if (editForm.target !== '') changes.target = Number(editForm.target);
      if (editForm.employee_name !== '') changes.employee_name = editForm.employee_name;
      if (!Object.keys(changes).length) { setEditOpen(false); return; }
      // open admin selection modal; actual send will be done from modal confirm
      setAdminSelect({ open: true, mode: 'change', kra: { kra_id: Number(editForm.kra_id), changes }, approver: '' });
      setEditOpen(false);
    } catch (_) {
      setEditOpen(false);
    }
  };

  const requestRemove = async (kra) => {
    try {
      setAdminSelect({ open: true, mode: 'delete', kra: { kra_id: Number(kra.kra_id) }, approver: '' });
    } catch (_) {}
  };

  const submitWithApprover = async () => {
    try {
      const approver_name = adminSelect.approver || '';
      if (!approver_name) return;
      if (adminSelect.mode === 'change' && adminSelect.kra) {
        await axios.post('http://localhost:3000/requests/kra-change', {
          kra_id: adminSelect.kra.kra_id,
          requested_changes: adminSelect.kra.changes || {},
          request_comment: 'Manager requested KRA update',
          approver_name,
        }, { headers: { Authorization: `Bearer ${getToken()}` } });
        setToast('Request sent successfully');
        setTimeout(()=> setToast(''), 3000);
      } else if (adminSelect.mode === 'delete' && adminSelect.kra) {
        await axios.post('http://localhost:3000/requests/kra-change', {
          kra_id: adminSelect.kra.kra_id,
          requested_changes: { _action: 'delete' },
          request_comment: 'Manager requested to remove this KRA',
          approver_name,
        }, { headers: { Authorization: `Bearer ${getToken()}` } });
        setToast('Remove request sent');
        setTimeout(()=> setToast(''), 3000);
      }
    } catch (_) {
      // ignore
    } finally {
      setAdminSelect({ open: false, mode: '', kra: null, approver: '' });
    }
  };

  // requestRemove replaced by admin selection modal flow

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post('http://localhost:3000/kra/create', {
        ...formData,
        manager_name: null,
        created_by: userName || getUserName() || '',
        target: formData.target === '' ? null : Number(formData.target),
      }, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.data.success) {
        setMessage('KRA created successfully!');
        setFormData(prev => ({
          ...prev,
          name: '',
          definition: '',
          manager_name: '',
          employee_name: '',
          scoring_method: 'Percentage',
          target: ''
        }));
        // Close modal and refresh list
        setCreateOpen(false);
        fetchMyKras();
      } else {
        setMessage(res.data.message || 'Error creating KRA');
      }
    } catch (err) {
      console.error('Error creating KRA', err);
      setMessage(err.response?.data?.message || 'Error creating KRA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Main Card - Single card wrapping header and table */}
        <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 md:p-8 rounded-lg shadow-lg text-white">
          
          {/* Top Header */}
          <div className="mb-8 flex flex-col sm:flex-row items-start justify-between">
            <div>
              {/* Text from image is "Admin", but code is for "Manager". Sticking to code context. */}
              <h2 className="text-3xl font-bold text-white mb-2">Create New KRA (Manager)</h2>
              <p className="text-white/80">Department: {userDept}</p>
            </div>
            <button
              type="button"
              onClick={()=> setCreateOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors mt-3 sm:mt-0"
            >
              Create KRA
            </button>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg font-semibold ${
              message.toLowerCase().includes('success') ? 'bg-green-500/80 text-white' : 'bg-red-500/80 text-white'
            }`}>{message}</div>
          )}
          
          {/* My Created KRAs Table Section (inside the same card) */}
          <div className="mt-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
              <h3 className="text-2xl font-semibold text-white mb-2 sm:mb-0">My Created KRAs</h3>
              <div className="flex items-center gap-2">
                <label className="text-sm text-white/80">Employee</label>
                <select
                  className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm"
                  value={selectedEmployee}
                  onChange={(e)=> setSelectedEmployee(e.target.value)}
                >
                  <option value="">All</option>
                  {Array.from(new Set(myKras.map(k => k.employee_name).filter(Boolean))).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/30">
              <table className="min-w-full text-left text-white">
                <thead>
                  {/* Darker header strip like in the image */}
                  <tr className="bg-black/40 border-b border-white/30">
                    <th className="p-3 font-semibold text-white">Name</th>
                    <th className="p-3 font-semibold text-white">Definition</th>
                    <th className="p-3 font-semibold text-white">Target</th>
                    <th className="p-3 font-semibold text-white">Assigned To</th>
                    <th className="p-3 font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedEmployee ? myKras.filter(k => String(k.employee_name||'') === selectedEmployee) : myKras).map(k => (
                    <tr key={k.kra_id} className="border-t border-white/20">
                      <td className="p-3 text-white/90">{k.name}</td>
                      <td className="p-3 max-w-xs truncate text-white/90" title={k.definition}>{k.definition}</td>
                      <td className="p-3 text-white/90">{typeof k.target === 'number' ? k.target : '-'}</td>
                      <td className="p-3 text-white/90">{k.employee_name || '-'}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors"
                            onClick={()=> openEdit(k)}
                          >
                            Change
                          </button>
                          {/* Faded red button style from image */}
                          <button
                            type="button"
                            className="px-3 py-1 rounded bg-red-800/30 text-red-200 text-sm hover:bg-red-800/50 transition-colors"
                            onClick={()=> requestRemove(k)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!myKras.length && (
                    <tr><td className="p-3 text-white/70" colSpan="5">No KRAs created by you yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div> {/* End of single main card */}

        {/* Create KRA Modal */}
        {createOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-lg rounded-lg shadow-xl p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Create KRA</h3>
                <button className="text-white/80 hover:text-white text-2xl font-bold" onClick={()=> setCreateOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">KRA Name *</label>
                  <input type="text" name="name" placeholder="Enter KRA Name" value={formData.name} onChange={handleInputChange} className="w-full p-3 border border-white/50 rounded-md bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">Definition *</label>
                  <textarea name="definition" placeholder="Enter KRA Definition" value={formData.definition} onChange={handleInputChange} rows={4} className="w-full p-3 border border-white/50 rounded-md bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">Department *</label>
                  <input type="text" name="dept" value={formData.dept} disabled className="w-full p-3 border border-white/50 rounded-md bg-white/10 text-white/70 opacity-70 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">KRA Target (0-100)</label>
                  <input type="number" min="0" max="100" name="target" placeholder="e.g., 100" value={formData.target} onChange={handleInputChange} className="w-full p-3 border border-white/50 rounded-md bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">Assign To (Employee)</label>
                  <select name="employee_name" value={formData.employee_name} onChange={handleInputChange} className="w-full p-3 border border-white/50 rounded-md bg-white/30 text-gray-900 focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select Employee</option>
                    <option value="all">All</option>
                    {employees.map((e) => (
                      <option key={e.user_id} value={e.name}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">Scoring Method *</label>
                  <input type="text" name="scoring_method" value={formData.scoring_method} readOnly className="w-full p-3 border border-white/50 rounded-md bg-white/10 text-white/70 opacity-70 cursor-not-allowed" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="px-4 py-2 rounded border border-white/50 text-white hover:bg-white/20 transition-colors" onClick={()=> setCreateOpen(false)}>Cancel</button>
                  <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50">{loading ? 'Creating...' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit KRA Modal */}
        {editOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-md rounded-lg shadow-xl p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Request Change: {editForm.name}</h3>
                <button className="text-white/80 hover:text-white text-2xl font-bold" onClick={()=> setEditOpen(false)}>✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/90">KRA Name</label>
                  <input className="w-full p-2 border border-white/50 rounded-md bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" value={editForm.name} onChange={(e)=> setEditForm(prev=>({ ...prev, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/90">Definition</label>
                  <textarea className="w-full p-2 border border-white/50 rounded-md bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" rows={3} value={editForm.definition} onChange={(e)=> setEditForm(prev=>({ ...prev, definition: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/90">Target</label>
                  <input type="number" min="0" max="100" className="w-full p-2 border border-white/50 rounded-md bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" value={editForm.target} onChange={(e)=> setEditForm(prev=>({ ...prev, target: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/90">Assign To (Employee)</label>
                  <select className="w-full p-2 border border-white/50 rounded-md bg-white/30 text-gray-900" value={editForm.employee_name} onChange={(e)=> setEditForm(prev=>({ ...prev, employee_name: e.target.value }))}>
                    <option value="">Select Employee</option>
                    <option value="all">All</option>
                    {employees.map((e)=> (
                      <option key={e.user_id} value={e.name}>{e.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button className="px-4 py-2 rounded border border-white/50 text-white hover:bg-white/20 transition-colors" onClick={()=> setEditOpen(false)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors" onClick={submitRequestChange}>Send Request</button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Message */}
        {!!toast && (
          <div className="fixed right-4 bottom-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg">{toast}</div>
        )}

        {/* Admin Select Modal */}
        {adminSelect.open && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-sm rounded-lg shadow-xl p-6 text-white">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-white">Select Admin</h3>
                <button className="text-white/80 hover:text-white text-2xl font-bold" onClick={()=> setAdminSelect({ open: false, mode: '', kra: null, approver: '' })}>✕</button>
              </div>
              <select className="w-full border border-white/50 rounded p-2 bg-white/30 text-gray-900" value={adminSelect.approver} onChange={(e)=> setAdminSelect(prev=> ({ ...prev, approver: e.target.value }))}>
                <option value="">Choose an Admin</option>
                {admins.map(a => (
                  <option key={a.user_id || a.email || a.name} value={a.name}>{a.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button className="px-4 py-2 rounded border border-white/50 text-white hover:bg-white/20 transition-colors" onClick={()=> setAdminSelect({ open: false, mode: '', kra: null, approver: '' })}>Cancel</button>
                <button className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors" onClick={submitWithApprover}>Send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}