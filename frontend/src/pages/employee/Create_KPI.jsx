import { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken, getRole } from '../../utils/authStorage';

// --- IMPORTANT ---
// Import your background image like this
import backgroundImage from '../../assets/background.png';

export default function Create_KPI_Employee() {
  const [form, setForm] = useState({ name: '', def: '', kra_id: '', due_date: '', scoring_method: '', target: '' });
  const [kras, setKras] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [myKpis, setMyKpis] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Active'); // Active | End | All
  const [kraFilter, setKraFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, kpi: null });
  const [editForm, setEditForm] = useState({ name: '', def: '', due_date: '', scoring_method: '', target: '', comment: '' });
  const selectedKra = kras.find(k => String(k.kra_id) === String(form.kra_id));

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    if (!token || (role || '').toLowerCase() !== 'employee') {
      window.location.href = '/login';
      return;
    }
    fetchAvailableKras();
    fetchMyKpis(statusFilter);
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

  const filteredKpis = myKpis.filter(k => (kraFilter ? String(k.kra_id) === String(kraFilter) : true));

  const openChange = (kpi) => {
    try { console.log('[Employee] Change clicked for KPI', kpi?.id, kpi); } catch {}
    setEditForm({
      name: kpi.name || '',
      def: kpi.def || '',
      due_date: kpi.due_date ? String(kpi.due_date).slice(0,10) : '',
      scoring_method: kpi.scoring_method || '',
      target: (kpi.target ?? '') === null ? '' : String(kpi.target ?? ''),
      comment: '',
    });
    setEditModal({ open: true, kpi });
    try { console.log('[Employee] editModal set to open'); } catch {}
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
    await axios.post('http://localhost:3000/requests/kpi-change', {
      kpi_id: editModal.kpi.id,
      requested_changes: payload,
      request_comment: editForm.comment || null,
    }, { headers: { Authorization: `Bearer ${getToken()}` } });
    setEditModal({ open: false, kpi: null });
    setEditForm({ name: '', def: '', due_date: '', scoring_method: '', target: '', comment: '' });
    setMessage('Request sent successfully');
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
    // New wrapper div for background image
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Main Frosted Glass Card */}
      <div className="min-h-screen text-white mx-auto bg-white/20 backdrop-blur-md p-8 rounded-lg shadow-xl max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Create & My KPI</h2>
          <button onClick={()=>setShowModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded">New KPI</button>
        </div>
        
        {message && (
          // This message styling is fine as it's a notification
          <div className="mb-4 p-3 rounded bg-green-100 text-green-800">{message}</div>
        )}
        
        <div className="mt-2">
          <h3 className="text-xl font-semibold mb-3 text-white">My Created KPIs</h3>
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm whitespace-nowrap text-gray-100">Status:</label>
                <select 
                  className="border border-white/30 rounded px-2 py-1 bg-white/80 text-black min-w-[120px]" 
                  value={statusFilter} 
                  onChange={(e)=>setStatusFilter(e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="End">End</option>
                  <option value="All">All</option>
                </select>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-sm whitespace-nowrap text-gray-100">Filter by KRA:</label>
                <select 
                  className="border border-white/30 rounded px-2 py-1 bg-white/80 text-black flex-1 min-w-[150px]" 
                  value={kraFilter} 
                  onChange={(e)=>setKraFilter(e.target.value)}
                >
                  <option value="">All KRAs</option>
                  {[...new Map(myKpis.map(k=>[k.kra_id, k.kra_name]))].map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          {!myKpis.length && <div className="text-sm text-gray-200">No KPIs created yet.</div>}
          
          <ul className="divide-y divide-white/20">
            {filteredKpis.map(k => (
              <li key={k.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{k.name}</div>
                  <div className="text-xs text-gray-200">KRA: {k.kra_name} • Due: {k.due_date ? new Date(k.due_date).toLocaleDateString() : '-'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-100">Status: {k.kpi_status}</div>
                  {String(k.kpi_status || '').toLowerCase() !== 'end' && (
                    <button className="px-2 py-1 border border-white/30 rounded text-white hover:bg-white/10" onClick={()=>openChange(k)}>Change</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Create KPI Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl bg-white/20 backdrop-blur-md text-white rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Create KPI (Employee)</h3>
                <button className="text-gray-100 hover:text-white text-2xl" onClick={()=>setShowModal(false)}>✕</button>
              </div>
              {message && (
                <div className="mb-4 p-3 rounded bg-blue-100 text-blue-800">{message}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">KPI Name *</label>
                  <input className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" name="name" placeholder="Enter KPI Name" value={form.name} onChange={handleChange} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Definition *</label>
                  <textarea className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" placeholder="Enter Definition" name="def" value={form.def} onChange={handleChange} rows={4} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">KRA *</label>
                  <select className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" name="kra_id" value={form.kra_id} onChange={handleChange} required>
                    <option value="">Select KRA</option>
                    {kras.map(k => (
                      <option key={k.kra_id} value={k.kra_id}>{k.name}</option>
                    ))}
                  </select>
                  {selectedKra && (
                    <p className="text-xs text-gray-200 mt-1">KRA Target: {typeof selectedKra.target === 'number' ? `${selectedKra.target}%` : '-'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Due Date *</label>
                  <input type="date" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" name="due_date" value={form.due_date} onChange={handleChange} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Target (0-100)</label>
                  <input type="number" min="0" max="100" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" name="target" placeholder="e.g., 100" value={form.target} onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Scoring Method *</label>
                  <select className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" name="scoring_method" value={form.scoring_method} onChange={handleChange} required>
                    <option value="">Select</option>
                    <option value="Percentage">Percentage</option>
                    <option value="Scale (1-5)">Scale (1-5)</option>
                    <option value="Scale (1-10)">Scale (1-10)</option>
                    <option value="Rating">Rating</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" className="px-4 py-2 rounded border border-white/30 text-white hover:bg-white/10" onClick={()=>setShowModal(false)}>Cancel</button>
                  <button type="submit" disabled={loading} className="bg-indigo-600 text-white px-6 py-2 rounded disabled:opacity-50">
                    {loading ? 'Creating...' : 'Create KPI'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit/Request Change Modal */}
        {editModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl bg-white/20 backdrop-blur-md text-white rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Request KPI Change</h3>
                <button className="text-gray-100 hover:text-white text-2xl" onClick={()=>setEditModal({ open: false, kpi: null })}>✕</button>
              </div>
              {message && (
                <div className="mb-4 p-3 rounded bg-blue-100 text-blue-800">{message}</div>
              )}
              <form onSubmit={(e)=>{ e.preventDefault(); submitRequest(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">KPI Name *</label>
                  <input className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" placeholder="Enter KPI Name" name="name" value={editForm.name} onChange={handleEditChange} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Definition *</label>
                  <textarea className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" placeholder="Enter Definition" name="def" value={editForm.def} onChange={handleEditChange} rows={4} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Due Date *</label>
                  <input type="date" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" name="due_date" value={editForm.due_date} onChange={handleEditChange} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Target (0-100)</label>
                  <input type="number" min="0" max="100" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" name="target" placeholder="e.g., 100" value={editForm.target} onChange={handleEditChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Scoring Method *</label>
                  <select className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" name="scoring_method" value={editForm.scoring_method} onChange={handleEditChange} required>
                    <option value="">Select Scoring Method</option>
                    <option value="Percentage">Percentage</option>
                    <option value="Scale (1-5)">Scale (1-5)</option>
                    <option value="Scale (1-10)">Scale (1-10)</option>
                    <option value="Rating">Rating</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Comment</label>
                  <textarea className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" placeholder="Reason for change (optional)" name="comment" value={editForm.comment} onChange={handleEditChange} rows={4} />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" className="px-4 py-2 rounded border border-white/30 text-white hover:bg-white/10" onClick={()=>setEditModal({ open: false, kpi: null })}>Cancel</button>
                  <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded">Submit Request</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}