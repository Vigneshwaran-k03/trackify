import { useEffect, useMemo, useState } from 'react';
import { getToken, getUserName } from '../../utils/authStorage';
// Import the background image
import backgroundImage from '../../assets/background.png';

export default function AdminKraLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalLog, setModalLog] = useState(null);
  const [tab, setTab] = useState('mine'); // 'mine' | 'manager'
  const adminName = getUserName() || '';
  const [dept, setDept] = useState('');
  const [manager, setManager] = useState('');
  const [employee, setEmployee] = useState('');
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [employees, setEmployees] = useState([]);
  // removed kra-specific filters per requirement

  useEffect(() => {
    const loadDepts = async () => {
      try {
        const res = await fetch('http://localhost:3000/users/departments', { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : (data?.data || []));
      } catch (_) {}
    };
    loadDepts();
  }, []);

  useEffect(() => {
    const loadPeople = async () => {
      try {
        if (!dept) { setManagers([]); setEmployees([]); return; }
        const [mRes, eRes] = await Promise.all([
          fetch(`http://localhost:3000/users/department/${encodeURIComponent(dept)}/managers`, { headers: { Authorization: `Bearer ${getToken()}` } }),
          fetch(`http://localhost:3000/users/department/${encodeURIComponent(dept)}/employees`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        ]);
        const m = await mRes.json();
        const e = await eRes.json();
        setManagers(Array.isArray(m) ? m : (m?.data || []));
        setEmployees(Array.isArray(e) ? e : (e?.data || []));
      } catch (_) {
        setManagers([]); setEmployees([]);
      }
    };
    loadPeople();
  }, [dept]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const q = new URLSearchParams();
        if (dept) q.set('dept', dept);
        if (manager) q.set('manager', manager);
        if (employee) q.set('employee', employee);
        const url = `http://localhost:3000/kra/logs${q.toString() ? `?${q.toString()}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        if (!res.ok || data?.success !== true) throw new Error(data?.message || 'Failed to load KRA logs');
        setLogs(Array.isArray(data.data) ? data.data : []);
      } catch (e) {
        setError(e.message || 'Failed to load KRA logs');
      } finally {
        setLoading(false);
      }
    };
    if (dept) fetchLogs();
  }, [dept, manager, employee]);

  // removed assigned KRAs effect (no KRA name filter in this view)

  const grouped = useMemo(() => {
    const byKra = new Map();
    for (const l of logs) {
      if (!byKra.has(l.kra_id)) byKra.set(l.kra_id, []);
      byKra.get(l.kra_id).push(l);
    }
    for (const arr of byKra.values()) arr.sort((a,b)=> (b.version||0) - (a.version||0));
    return Array.from(byKra.entries()).map(([kra_id, arr]) => ({ kra_id, entries: arr, latest: arr[0] }));
  }, [logs]);

  const groupedFiltered = useMemo(() => {
    const me = String(adminName).toLowerCase();
    const base = grouped;
    if (tab === 'mine') {
      // My Changes: created_by = admin; allow Dept/Manager filters to narrow
      const byMine = base.map(g => ({
        ...g,
        entries: g.entries.filter(l => String(l.created_by || '').toLowerCase() === me),
        latest: g.entries.find(l => String(l.created_by || '').toLowerCase() === me) || g.latest,
      })).filter(g => g.entries.length);
      // narrow by dept/manager
      return byMine.map(g => ({
        ...g,
        entries: g.entries.filter(l => (
          (!dept || String(l.dept || '') === String(dept)) &&
          (!manager || String(l.manager_name || '') === String(manager))
        )),
        latest: g.entries.find(l => (
          (!dept || String(l.dept || '') === String(dept)) &&
          (!manager || String(l.manager_name || '') === String(manager))
        )) || g.latest,
      })).filter(g => g.entries.length);
    }
    // Manager Changes: entries created_by a manager (not admin), with optional Manager/Employee filters
    const byMgr = base.map(g => ({
      ...g,
      entries: g.entries.filter(l => String(l.created_by || '').toLowerCase() !== me),
      latest: g.entries.find(l => String(l.created_by || '').toLowerCase() !== me) || g.latest,
    })).filter(g => g.entries.length);
    return byMgr.map(g => ({
      ...g,
      entries: g.entries.filter(l => (
        (!dept || String(l.dept || '') === String(dept)) &&
        (!manager || String(l.manager_name || '') === String(manager)) &&
        (!employee || String(l.employee_name || '') === String(employee))
      )),
      latest: g.entries.find(l => (
        (!dept || String(l.dept || '') === String(dept)) &&
        (!manager || String(l.manager_name || '') === String(manager)) &&
        (!employee || String(l.employee_name || '') === String(employee))
      )) || g.latest,
    })).filter(g => g.entries.length);
  }, [grouped, tab, adminName, dept, manager, employee]);

  const renderChanges = (json) => {
    if (!json) return <span className="text-white/70">No details</span>;
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = Object.keys(obj);
      if (!keys.length) return <span className="text-white/70">No details</span>;
      return (
        <ul className="list-disc pl-5 space-y-1 text-white/90">
          {keys.map((k) => (
            <li key={k}><span className="font-semibold text-white">{k}</span>: {String(obj[k]?.from ?? 'null')} → {String(obj[k]?.to ?? 'null')}</li>
          ))}
        </ul>
      );
    } catch {
      return <span className="text-red-400">Invalid</span>;
    }
  };

  return (
    // Wrapper div for background image
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Content container with padding */}
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header/Filter bar with glassmorphism */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 rounded-lg bg-white/20 backdrop-blur-sm p-4 shadow-md border border-white/30">
          <h1 className="text-3xl font-bold text-white shadow-sm mb-4 md:mb-0">KRA Log</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded border border-white/50 text-white/90 transition-colors ${tab==='mine' ? 'bg-white/90 text-indigo-700 font-semibold border-white' : 'hover:bg-white/20'}`}
                onClick={()=> { setTab('mine'); setManager(''); setEmployee(''); }}
              >
                My Changes
              </button>
              <button
                className={`px-3 py-1 rounded border border-white/50 text-white/90 transition-colors ${tab==='manager' ? 'bg-white/90 text-indigo-700 font-semibold border-white' : 'hover:bg-white/20'}`}
                onClick={()=> { setTab('manager'); }}
              >
                Manager Changes
              </button>
            </div>
            <select
              className="border border-white/50 rounded px-2 py-1 bg-white/30 text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
              value={dept}
              onChange={(e)=>{ setDept(e.target.value); setManager(''); setEmployee(''); }}
            >
              <option value="">Select dept</option>
              {departments.map(d => (
                <option key={d.id || d.name} value={d.name || d}>{d.name || d}</option>
              ))}
            </select>
            {(tab === 'mine' || tab === 'manager') && (
              <select
                className="border border-white/50 rounded px-2 py-1 bg-white/30 text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                value={manager}
                onChange={(e)=>{ setManager(e.target.value); if (tab==='mine') setEmployee(''); }}
              >
                <option value="">Select manager {tab==='mine' ? '(optional)' : ''}</option>
                {managers.map(m => (
                  <option key={m.user_id || m.id || m.email} value={m.name}>{m.name}</option>
                ))}
              </select>
            )}
            {tab === 'manager' && (
              <select
                className="border border-white/50 rounded px-2 py-1 bg-white/30 text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                value={employee}
                onChange={(e)=> setEmployee(e.target.value)}
              >
                <option value="">Select employee (optional)</option>
                {employees.map(emp => (
                  <option key={emp.user_id || emp.id || emp.email} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Loading / Error / Empty States */}
        {loading && <div className="text-white text-lg p-4 font-semibold text-center">Loading...</div>}
        {error && <div className="bg-red-500/80 text-white font-semibold rounded-lg p-3 mb-3 shadow-lg">{error}</div>}
        {!loading && !error && !groupedFiltered.length && (
          <div className="text-white/90 text-lg p-4 bg-black/20 rounded-lg text-center backdrop-blur-sm">
            No logs found matching your criteria.
          </div>
        )}

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedFiltered.map(({ kra_id, latest }) => (
            // Card with glassmorphism
            <div key={`card-${kra_id}`} className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-4 shadow-lg text-white">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                <div>
                  <div className="text-xl font-bold text-white">{latest.kra_name}</div>
                  <div className="text-sm text-gray-100">Dept: {latest.dept || '-'} • Version: v{latest.version}</div>
                  <div className="text-sm text-gray-100">Manager: {latest.manager_name || '-'}</div>
                  <div className="text-sm text-gray-100">Employee: {latest.employee_name || '-'}</div>
                </div>
                <div className="text-sm text-gray-100 text-left sm:text-right flex-shrink-0">
                  <div>Updated By: {latest.updated_by}</div>
                  <div>At: {new Date(latest.updated_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-3">
                <button
                  className="px-3 py-1 rounded border border-white/50 text-white hover:bg-white/20 transition-colors"
                  onClick={()=> { setModalLog(latest); setShowModal(true); }}
                >
                  See Changes
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal with glassmorphism */}
        {showModal && (
          // Modal overlay with padding for responsiveness
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            {/* Modal content */}
            <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-lg shadow-xl w-full max-w-md p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Changes: {modalLog?.kra_name}</h3>
                <button className="text-white/80 hover:text-white text-2xl font-bold" onClick={()=> setShowModal(false)}>✕</button>
              </div>
              <div className="text-sm text-gray-100 space-y-2">
                <div>Dept: {modalLog?.dept || '-'}</div>
                <div>Manager: {modalLog?.manager_name || '-'}</div>
                <div>Employee: {modalLog?.employee_name || '-'}</div>
              </div>
              <div className="mt-3 max-h-60 overflow-y-auto">
                {renderChanges(modalLog?.changes)}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  className="px-4 py-2 rounded border border-white/50 text-white hover:bg-white/20 transition-colors"
                  onClick={()=> setShowModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}