import { useEffect, useMemo, useState } from 'react';
import { getToken } from '../../utils/authStorage';
// 1. Import your background image
import backgroundImage from '../../assets/background.png';

export default function AdminKpiLog() {
  const [mode, setMode] = useState('manager'); // default to manager; 'manager' | 'employee'
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [dept, setDept] = useState('');
  const [manager, setManager] = useState('');
  const [employee, setEmployee] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKpiId, setModalKpiId] = useState(null);
  const [kraFilter, setKraFilter] = useState('');
  const [deptKras, setDeptKras] = useState([]);
  const [assignedKras, setAssignedKras] = useState([]);

  // --- No logic changes below this line ---

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

  const grouped = useMemo(() => {
    const byKpi = new Map();
    for (const l of logs) {
      if (!byKpi.has(l.kpi_id)) byKpi.set(l.kpi_id, []);
      byKpi.get(l.kpi_id).push(l);
    }
    for (const arr of byKpi.values()) arr.sort((a,b)=> (b.version||0) - (a.version||0));
    return Array.from(byKpi.entries()).map(([kpi_id, arr]) => ({ kpi_id, entries: arr, latest: arr[0] }));
  }, [logs]);

  useEffect(() => {
    if (!deptKras.length) { setAssignedKras([]); return; }
    if (mode === 'employee') {
      if (!employee) { setAssignedKras([]); return; }
      setAssignedKras(deptKras.filter(k => String(k.employee_name || '') === String(employee)));
      return;
    }
    if (!manager) { setAssignedKras([]); return; }
    setAssignedKras(deptKras.filter(k => String(k.manager_name || '') === String(manager)));
  }, [deptKras, mode, manager, employee]);

  const kraOptions = useMemo(() => {
    const set = new Set();
    assignedKras.forEach(k => { if (k.name) set.add(String(k.name)); });
    return Array.from(set).sort();
  }, [assignedKras]);

  const groupedFiltered = useMemo(() => {
    if (!kraFilter) return grouped;
    return grouped.filter(g => String(g.latest?.kra_name || '') === String(kraFilter));
  }, [grouped, kraFilter]);

  useEffect(() => {
    const loadPeople = async () => {
      if (!dept) { setManagers([]); setEmployees([]); setManager(''); setEmployee(''); return; }
      try {
        const [mRes, eRes] = await Promise.all([
          fetch(`http://localhost:3000/users/department/${encodeURIComponent(dept)}/managers`, { headers: { Authorization: `Bearer ${getToken()}` } }),
          fetch(`http://localhost:3000/users/department/${encodeURIComponent(dept)}/employees`, { headers: { Authorization: `Bearer ${getToken()}` } })
        ]);
        const m = await mRes.json();
        const e = await eRes.json();
        setManagers(Array.isArray(m) ? m : (m?.data || []));
        setEmployees(Array.isArray(e) ? e : (e?.data || []));
        try {
          const kRes = await fetch(`http://localhost:3000/kra/department/${encodeURIComponent(dept)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
          const kd = await kRes.json();
          setDeptKras(Array.isArray(kd?.data) ? kd.data : []);
        } catch (_) { setDeptKras([]); }
      } catch (_) {
        setManagers([]);
        setEmployees([]);
      }
    };
    loadPeople();
  }, [dept]);

  const buildQuery = () => {
    const q = new URLSearchParams();
    if (dept) q.set('dept', dept);
    if (mode === 'manager') {
      if (manager) q.set('manager', manager);
    } else {
      if (manager) q.set('manager', manager);
      if (employee) q.set('employee', employee);
    }
    return q.toString();
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const q = buildQuery();
      const url = `http://localhost:3000/kpi/logs${q ? `?${q}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (!res.ok || data?.success !== true) throw new Error(data?.message || 'Failed to load KPI logs');
      setLogs(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      setError(e.message || 'Failed to load KPI logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dept) { setLogs([]); setLoading(false); return; }
    if (mode === 'manager') {
      fetchLogs();
      return;
    }
    if (employee) {
      fetchLogs();
    } else {
      setLogs([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dept, manager, employee]);

  // --- STYLING CHANGE: Added text-white classes for readability ---
  const renderChanges = (json) => {
    if (!json) return <span className="text-white/70">No details</span>;
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = Object.keys(obj);
      if (!keys.length) return <span className="text-white/70">No details</span>;
      return (
        <ul className="list-disc pl-5 space-y-1 text-white/90">
          {keys.map((k) => (
            <li key={k}><span className="font-medium text-white">{k}</span>: {String(obj[k]?.from ?? 'null')} → {String(obj[k]?.to ?? 'null')}</li>
          ))}
        </ul>
      );
    } catch {
      return <span className="text-red-300">Invalid data</span>;
    }
  };

  // --- STYLING CHANGES START HERE ---
  return (
    <div 
      className="min-h-screen w-full"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="p-4 sm:p-6">
        
        {/* Filter Bar Card */}
        <div className="bg-black/20 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-4 mb-4">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
            <h1 className="text-2xl font-semibold text-white">KPI Log</h1>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="flex items-center gap-2">
                <button 
                  className={`px-3 py-1 rounded-md text-sm transition ${mode==='manager'?'bg-indigo-600 text-white':'bg-white/20 text-white/80 hover:bg-white/30'}`} 
                  onClick={()=>{ setMode('manager'); setEmployee(''); }}>Manager
                </button>
                <button 
                  className={`px-3 py-1 rounded-md text-sm transition ${mode==='employee'?'bg-indigo-600 text-white':'bg-white/20 text-white/80 hover:bg-white/30'}`} 
                  onClick={()=> setMode('employee')}>Employee
                </button>
              </div>
              <select 
                className="bg-white/10 border border-white/30 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                value={dept} 
                onChange={(e)=>{ setDept(e.target.value); setManager(''); setEmployee(''); }}>
                <option value="" className="text-black">Select dept</option>
                {departments.map(d => (
                  <option key={d.id || d.name} value={d.name || d} className="text-black">{d.name || d}</option>
                ))}
              </select>
              <select 
                className="bg-white/10 border border-white/30 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                value={manager} 
                onChange={(e)=>{ setManager(e.target.value); if (mode==='manager') setEmployee(''); }}>
                <option value="" className="text-black">Select manager (optional)</option>
                {managers.map(m => (
                  <option key={m.user_id || m.id || m.email} value={m.name} className="text-black">{m.name}</option>
                ))}
              </select>
              {mode === 'employee' && (
                <select 
                  className="bg-white/10 border border-white/30 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                  value={employee} 
                  onChange={(e)=>setEmployee(e.target.value)}>
                  <option value="" className="text-black">Select employee (required)</option>
                  {employees.map(emp => (
                    <option key={emp.user_id || emp.id || emp.email} value={emp.name} className="text-black">{emp.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <label className="text-sm text-white/90">KRA</label>
              <select 
                className="bg-white/10 border border-white/30 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                value={kraFilter} 
                onChange={(e)=>setKraFilter(e.target.value)}>
                <option value="" className="text-black">All</option>
                {kraOptions.map(name => (<option key={name} value={name} className="text-black">{name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {loading && <div className="text-center text-white p-4">Loading...</div>}
        {error && <div className="bg-red-500/30 text-red-100 border border-red-400 p-3 rounded-lg mb-3">{error}</div>}
        {!loading && !groupedFiltered.length && <div className="text-center text-white/80 p-4">No logs found.</div>}
        
        {/* Log Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedFiltered.map(({ kpi_id, latest }) => (
            <div key={`card-${kpi_id}`} className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-lg p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                  <div className="text-lg font-semibold text-white">{latest.kpi_name}</div>
                  <div className="text-sm text-white/70 text-left sm:text-right flex-shrink-0">
                    <div>Due: {latest.due_date ? new Date(latest.due_date).toLocaleDateString() : '-'}</div>
                  </div>
                </div>
                <div className="text-sm text-white/70 mb-3">KRA: {latest.kra_name} • Dept: {latest.dept || '-'}</div>
                <div className="text-sm text-white/60">
                  <div>Last Update By: {latest.updated_by}</div>
                  <div>At: {new Date(latest.updated_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button 
                  className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition" 
                  onClick={()=>{ setModalKpiId(kpi_id); setModalOpen(true); }}>
                  See changes
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Popup */}
      {modalOpen && modalKpiId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/50 backdrop-blur-2xl border border-white/20 w-full max-w-2xl rounded-lg shadow-2xl max-h-[90vh]">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/20">
              <h3 className="text-lg font-semibold text-white">KPI Change History</h3>
              <button 
                className="text-white/70 hover:text-white text-2xl font-bold" 
                onClick={()=>{ setModalOpen(false); setModalKpiId(null); }}>
                ✕
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-3 overflow-y-auto max-h-[calc(90vh-81px)]">
              {(grouped.find(g=> g.kpi_id===modalKpiId)?.entries || []).map((log) => (
                <div key={`log-${log.kpi_id}-${log.version}-${log.updated_at}`} className="bg-white/10 border border-white/20 rounded-lg p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-white/90 font-medium">Version v{log.version}</div>
                    <div className="text-sm text-white/70">By {log.updated_by} • {new Date(log.updated_at).toLocaleString()}</div>
                  </div>
                  <div className="mt-2">{renderChanges(log.changes)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}