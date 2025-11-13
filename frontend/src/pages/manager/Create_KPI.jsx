import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { getToken, getRole } from '../../utils/authStorage';

export default function Create_KPI_Manager() {
  const [form, setForm] = useState({ name: '', def: '', kra_id: '', due_date: '', scoring_method: '', target: '' });
  const [kras, setKras] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [myKpis, setMyKpis] = useState([]);
  const [kraFilter, setKraFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active'); // Active | End | All
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, kpi: null });
  const [editForm, setEditForm] = useState({ name: '', def: '', due_date: '', scoring_method: '', target: '', comment: '' });
  const [admins, setAdmins] = useState([]);
  const [adminSelect, setAdminSelect] = useState({ open: false, mode: '', kpi: null, approver: '' }); // mode: 'change' | 'delete'
  const selectedKra = kras.find(k => String(k.kra_id) === String(form.kra_id));

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    if (!token || (role || '').toLowerCase() !== 'manager') {
      window.location.href = '/login';
      return;
    }
    fetchAvailableKras();
    fetchMyKpis(statusFilter);
    // Load admins for routing requests
    (async () => {
      try {
        const res = await axios.get('http://localhost:3000/users/admins', { headers: { Authorization: `Bearer ${getToken()}` } });
        setAdmins(Array.isArray(res.data) ? res.data : (res.data?.data || []));
      } catch (_) { setAdmins([]); }
    })();
  }, []);

  const fetchAvailableKras = async () => {
    try {
      const res = await axios.get('http://localhost:3000/kpi/available', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setKras(res.data.data || []);
    } catch (err) {
      console.error('Error loading KRAs', err);
    }
  };

  const openRemove = (kpi) => {
    setAdminSelect({ open: true, mode: 'delete', kpi, approver: '' });
  };

  // Derived and handlers for request flow (moved inside component)
  const filteredKpis = myKpis.filter(k => (kraFilter ? String(k.kra_id) === String(kraFilter) : true));

  const openChange = (kpi) => {
    try { console.log('[Manager] Change clicked for KPI', kpi?.id, kpi); } catch {}
    setEditForm({
      name: kpi.name || '',
      def: kpi.def || '',
      due_date: kpi.due_date ? String(kpi.due_date).slice(0,10) : '',
      scoring_method: kpi.scoring_method || '',
      target: (kpi.target ?? '') === null ? '' : String(kpi.target ?? ''),
      comment: '',
    });
    setEditModal({ open: true, kpi });
    try { console.log('[Manager] editModal set to open'); } catch {}
  };

  const submitRequest = async () => {
    const payload = {};
    if (editForm.name !== editModal.kpi.name) payload.name = editForm.name;
    if (editForm.def !== editModal.kpi.def) payload.def = editForm.def;
    if (editForm.due_date && String(editForm.due_date).slice(0,10) !== String(editModal.kpi.due_date || '').slice(0,10)) payload.due_date = editForm.due_date;
    if (editForm.scoring_method !== editModal.kpi.scoring_method) payload.scoring_method = editForm.scoring_method;
    const tgt = editForm.target === '' ? null : Number(editForm.target);
    if ((editModal.kpi.target ?? null) !== tgt) payload.target = tgt;
    if (Object.keys(payload).length === 0) {
      setMessage('No changes to request');
      return;
    }
    // prompt for admin selection
    setAdminSelect({ open: true, mode: 'change', kpi: editModal.kpi, approver: '' });
    // actual send happens from adminSelect modal submit
    setEditModal({ open: false, kpi: null });
    setEditForm({ name: '', def: '', due_date: '', scoring_method: '', target: '', comment: '' });
    setMessage('');
  };

  const submitWithApprover = async () => {
    try {
      const approver_name = adminSelect.approver || '';
      if (!approver_name) return;
      if (adminSelect.mode === 'change' && adminSelect.kpi) {
        const k = adminSelect.kpi;
        const payload = {};
        if (editForm.name !== k.name) payload.name = editForm.name;
        if (editForm.def !== k.def) payload.def = editForm.def;
        if (editForm.due_date && String(editForm.due_date).slice(0,10) !== String(k.due_date || '').slice(0,10)) payload.due_date = editForm.due_date;
        if (editForm.scoring_method !== k.scoring_method) payload.scoring_method = editForm.scoring_method;
        const tgt = editForm.target === '' ? null : Number(editForm.target);
        if ((k.target ?? null) !== tgt) payload.target = tgt;
        await axios.post('http://localhost:3000/requests/kpi-change', {
          kpi_id: k.id,
          requested_changes: payload,
          request_comment: editForm.comment || null,
          approver_name,
        }, { headers: { Authorization: `Bearer ${getToken()}` } });
        setMessage('Request sent successfully');
      } else if (adminSelect.mode === 'delete' && adminSelect.kpi) {
        await axios.post('http://localhost:3000/requests/kpi-change', {
          kpi_id: adminSelect.kpi.id,
          requested_changes: {},
          action: 'delete',
          request_comment: 'Manager requested to remove this KPI',
          approver_name,
        }, { headers: { Authorization: `Bearer ${getToken()}` } });
        setMessage('Remove request sent successfully');
      }
    } catch (e) {
      // swallow
    } finally {
      setAdminSelect({ open: false, mode: '', kpi: null, approver: '' });
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const fetchMyKpis = async (status = statusFilter) => {
    try {
      const params = {};
      if (status && status !== 'All') params.status = status;
      const res = await axios.get('http://localhost:3000/kpi/my', { headers: { Authorization: `Bearer ${getToken()}` }, params });
      const list = res.data?.data || [];
      setMyKpis(list);
    } catch (_) {
      setMyKpis([]);
    }
  };

  useEffect(() => {
    fetchMyKpis(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await axios.post('http://localhost:3000/kpi/create', {
        ...form,
        kra_id: parseInt(form.kra_id, 10),
        target: form.target === '' ? null : Number(form.target),
      }, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        }
      });
      setMessage('KPI created successfully');
      setForm({ name: '', def: '', kra_id: '', due_date: '', scoring_method: '', target: '' });
      fetchMyKpis(statusFilter);
      setShowModal(false);
    } catch (err) {
      console.error('Error creating KPI', err);
      setMessage(err.response?.data?.message || 'Error creating KPI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-black mx-auto bg-white p-8 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Create & My KPI</h2>
        <button onClick={()=>setShowModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded">New KPI</button>
      </div>
      {message && (
        <div className="mb-4 p-3 rounded bg-green-50 text-green-800">{message}</div>
      )}
      <div className="mt-2">
        <h3 className="text-xl font-semibold mb-2">My Created KPIs</h3>
        <div className="mb-3 flex items-center gap-4">
          <label className="text-sm mr-2">Filter:</label>
          <select className="border rounded px-2 py-1" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
            <option value="Active">Active</option>
            <option value="End">End</option>
            <option value="All">All</option>
          </select>
          <label className="text-sm">KRA:</label>
          <select className="border rounded px-2 py-1" value={kraFilter} onChange={(e)=>setKraFilter(e.target.value)}>
            <option value="">All</option>
            {[...new Map(myKpis.map(k=>[k.kra_id, k.kra_name]))].map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        {!myKpis.length && <div className="text-sm text-gray-600">No KPIs created yet.</div>}
        <ul className="divide-y">
          {filteredKpis.map(k => (
            <li key={k.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{k.name}</div>
                <div className="text-xs text-gray-600">KRA: {k.kra_name} • Due: {k.due_date ? new Date(k.due_date).toLocaleDateString() : '-'}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs">Status: {k.kpi_status}</div>
                {String(k.kpi_status || '').toLowerCase() !== 'end' && (
                  <>
                    <button className="px-2 py-1 border rounded" onClick={()=>openChange(k)}>Change</button>
                    <button className="px-2 py-1 border rounded" onClick={()=>openRemove(k)}>Remove</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editModal.open && ReactDOM.createPortal(
        (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" style={{ zIndex: 9999, pointerEvents: 'auto' }}>
            <div className="w-full max-w-2xl bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Request KPI Change</h3>
                <button className="text-gray-600" onClick={()=>setEditModal({ open: false, kpi: null })}>✕</button>
              </div>
              {message && (
                <div className="mb-4 p-3 rounded bg-blue-50 text-blue-800">{message}</div>
              )}
              <form onSubmit={submitRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">KPI Name *</label>
                  <input className="w-full p-2 border rounded text-black" placeholder="Enter KPI Name" name="name" value={editForm.name} onChange={handleEditChange} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Definition *</label>
                  <textarea className="w-full p-2 border rounded text-black" placeholder="Enter Definition" name="def" value={editForm.def} onChange={handleEditChange} rows={4} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date *</label>
                  <input type="date" className="w-full p-2 border rounded text-black bg-gray-300" name="due_date" value={editForm.due_date} onChange={handleEditChange} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Target (0-100)</label>
                  <input type="number" min="0" max="100" className="w-full p-2 border rounded text-black" name="target" placeholder="e.g., 100" value={editForm.target} onChange={handleEditChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Scoring Method *</label>
                  <select className="w-full p-2 border rounded text-black" name="scoring_method" value={editForm.scoring_method} onChange={handleEditChange} required>
                    <option value="">Select Scoring Method</option>
                    <option value="Percentage">Percentage</option>
                    <option value="Scale (1-5)">Scale (1-5)</option>
                    <option value="Scale (1-10)">Scale (1-10)</option>
                    <option value="Rating">Rating</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Comment</label>
                  <textarea className="w-full p-2 border rounded text-black" placeholder="Enter Comment" name="comment" value={editForm.comment} onChange={handleEditChange} rows={4} />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" className="px-4 py-2 rounded border" onClick={()=>setEditModal({ open: false, kpi: null })}>Cancel</button>
                  <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded disabled:opacity-50">
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ),
        document.body
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create KPI (Manager)</h3>
              <button className="text-gray-600" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            {message && (
              <div className="mb-4 p-3 rounded bg-blue-50 text-blue-800">{message}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">KPI Name *</label>
                <input className="w-full p-2 border rounded text-black" placeholder="Enter KPI Name" name="name" value={form.name} onChange={handleChange} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Definition *</label>
                <textarea className="w-full p-2 border rounded text-black" placeholder="Enter Definition" name="def" value={form.def} onChange={handleChange} rows={4} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">KRA *</label>
                <select className="w-full p-2 border rounded text-black" name="kra_id" value={form.kra_id} onChange={handleChange} required>
                  <option value="">Select KRA</option>
                  {kras.map(k => (
                    <option key={k.kra_id} value={k.kra_id}>{k.name}</option>
                  ))}
                </select>
                {selectedKra && (
                  <p className="text-xs text-gray-600 mt-1">KRA Target: {typeof selectedKra.target === 'number' ? `${selectedKra.target}%` : '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date *</label>
                <input type="date" className="w-full p-2 border rounded text-black bg-gray-300" name="due_date" value={form.due_date} onChange={handleChange} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target (0-100)</label>
                <input type="number" min="0" max="100" className="w-full p-2 border rounded text-black" name="target" placeholder="e.g., 100" value={form.target} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scoring Method *</label>
                <select className="w-full p-2 border rounded text-black" name="scoring_method" value={form.scoring_method} onChange={handleChange} required>
                  <option value="">Select Scoring Method</option>
                  <option value="Percentage">Percentage</option>
                  <option value="Scale (1-5)">Scale (1-5)</option>
                  <option value="Scale (1-10)">Scale (1-10)</option>
                  <option value="Rating">Rating</option>
                
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" className="px-4 py-2 rounded border" onClick={()=>setShowModal(false)}>Cancel</button>
                <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create KPI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminSelect.open && ReactDOM.createPortal(
        (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" style={{ zIndex: 9999, pointerEvents: 'auto' }}>
            <div className="w-full max-w-sm bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Select Admin</h3>
                <button className="text-gray-600" onClick={()=> setAdminSelect({ open: false, mode: '', kpi: null, approver: '' })}>✕</button>
              </div>
              <select className="w-full border rounded p-2 text-black" value={adminSelect.approver} onChange={(e)=> setAdminSelect(prev=> ({ ...prev, approver: e.target.value }))}>
                <option value="">Choose an Admin</option>
                {admins.map(a => (
                  <option key={a.user_id || a.email || a.name} value={a.name}>{a.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button className="px-4 py-2 rounded border" onClick={()=> setAdminSelect({ open: false, mode: '', kpi: null, approver: '' })}>Cancel</button>
                <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={submitWithApprover}>Send</button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  );
}
