import { useEffect, useMemo, useState } from 'react';
import { getToken } from '../../utils/authStorage';

// [CHANGE] Import your background image
// !! You may need to change this path depending on your file structure !!
import backgroundImage from '../../assets/background.png';

export default function ManagerKpiLog() {
  // [LOGIC UNCHANGED]
  const [tab, setTab] = useState('my'); // 'my' | 'employee'
  const [dept, setDept] = useState('');
  const [managerName, setManagerName] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKpiId, setModalKpiId] = useState(null);
  const [kraFilter, setKraFilter] = useState('');
  const [deptKras, setDeptKras] = useState([]);
  const [assignedKras, setAssignedKras] = useState([]);

  // [LOGIC UNCHANGED]
  useEffect(() => {
    const init = async () => {
      try {
        const prof = await fetch('http://localhost:3000/auth/profile', { headers: { Authorization: `Bearer ${getToken()}` } });
        const me = await prof.json();
        const d = me?.dept || '';
        setDept(d);
        const mname = me?.name || '';
        setManagerName(mname);
        if (d) {
          const esRes = await fetch(`http://localhost:3000/users/department/${encodeURIComponent(d)}/employees`, { headers: { Authorization: `Bearer ${getToken()}` } });
          const es = await esRes.json();
          setEmployees(Array.isArray(es) ? es : (es?.data || []));
          try {
            const kRes = await fetch(`http://localhost:3000/kra/department/${encodeURIComponent(d)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
            const kd = await kRes.json();
            let list = Array.isArray(kd?.data) ? kd.data : [];
            if (!list.length) {
              try {
                const allRes = await fetch('http://localhost:3000/kra', { headers: { Authorization: `Bearer ${getToken()}` } });
                const all = await allRes.json();
                const payload = Array.isArray(all) ? all : (all?.data || []);
                const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim().replace(/\s*department\s*$/,'');
                const deptNorm = norm(d);
                list = payload.filter(k => norm(k.dept) === deptNorm);
              } catch (_) { /* ignore */ }
            }
            setDeptKras(list);
          } catch (_) { setDeptKras([]); }
        }
      } catch (_) {}
    };
    init();
  }, []);

  // [LOGIC UNCHANGED]
  const grouped = useMemo(() => {
    const byKpi = new Map();
    for (const l of logs) {
      if (!byKpi.has(l.kpi_id)) byKpi.set(l.kpi_id, []);
      byKpi.get(l.kpi_id).push(l);
    }
    for (const arr of byKpi.values()) arr.sort((a,b)=> (b.version||0) - (a.version||0));
    return Array.from(byKpi.entries()).map(([kpi_id, arr]) => ({ kpi_id, entries: arr, latest: arr[0] }));
  }, [logs]);

  // [LOGIC UNCHANGED]
  useEffect(() => {
    if (!deptKras.length) { setAssignedKras([]); return; }
    if (tab === 'employee') {
      if (!selectedEmployee) { setAssignedKras([]); return; }
      const sel = String(selectedEmployee || '').toLowerCase().trim();
      setAssignedKras(deptKras.filter(k => String(k.employee_name || '').toLowerCase().trim() === sel));
      return;
    }
    const me = String(managerName || '').toLowerCase().trim();
    setAssignedKras(deptKras.filter(k => String(k.manager_name || '').toLowerCase().trim() === me));
  }, [deptKras, tab, selectedEmployee, managerName]);

  // [LOGIC UNCHANGED]
  const kraOptions = useMemo(() => {
    const set = new Set();
    assignedKras.forEach(k => {
      const label = k?.name || k?.kra_name;
      if (label) set.add(String(label));
    });
    return Array.from(set).sort();
  }, [assignedKras]);

  // [LOGIC UNCHANGED]
  const groupedFiltered = useMemo(() => {
    if (!kraFilter) return grouped;
    return grouped.filter(g => String(g.latest?.kra_name || '') === String(kraFilter));
  }, [grouped, kraFilter]);

  // [LOGIC UNCHANGED]
  const buildQuery = () => {
    const q = new URLSearchParams();
    if (tab === 'employee' && selectedEmployee) q.set('employee', selectedEmployee);
    return q.toString();
  };

  // [LOGIC UNCHANGED]
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

  // [LOGIC UNCHANGED]
  useEffect(() => {
    if (tab === 'employee') {
      if (!selectedEmployee) { setLogs([]); setLoading(false); return; }
      fetchLogs();
      return;
    }
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedEmployee]);

  // [LOGIC UNCHANGED]
  const renderChanges = (json) => {
    if (!json) return <span className="text-white/70">No details</span>; // [STYLE CHANGE]
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = Object.keys(obj);
      if (!keys.length) return <span className="text-white/70">No details</span>; // [STYLE CHANGE]
      return (
        // [STYLE CHANGE] Text color inherits from parent (white)
        <ul className="list-disc pl-5 space-y-1 text-white/90">
          {keys.map((k) => {
            const v = obj[k];
            if (v && typeof v === 'object' && ('from' in v || 'to' in v)) {
              // [STYLE CHANGE]
              return <li key={k}><span className="font-medium text-white">{k}</span>: {String(v.from ?? 'null')} → {String(v.to ?? 'null')}</li>;
            }
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
              // [STYLE CHANGE]
              return <li key={k}><span className="font-medium text-white">{k}</span>: {String(v)}</li>;
            }
            // [STYLE CHANGE]
            return <li key={k}><span className="font-medium text-white">{k}</span>: {JSON.stringify(v)}</li>;
          })}
        </ul>
      );
    } catch {
      return <span className="text-red-400">Invalid</span>; // [STYLE CHANGE]
    }
  };

  return (
    // [STYLE CHANGE] New wrapper for background image
    <div
      className="min-h-screen w-full py-8 px-4"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* [STYLE CHANGE] Main card with frosted glass effect */}
      <div className="max-w-6xl mx-auto bg-white/10 backdrop-blur-md p-6 md:p-8 rounded-lg shadow-xl border border-white/20 text-white">
        
        <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
          <h1 className="text-2xl font-semibold">KPI Log</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* [STYLE CHANGE] Styled tabs */}
            <button 
              className={`px-3 py-1 rounded transition-colors ${tab === 'my' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`} 
              onClick={()=>{ setTab('my'); setSelectedEmployee(''); }}
            >
              My Log
            </button>
            <button 
              className={`px-3 py-1 rounded transition-colors ${tab === 'employee' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`} 
              onClick={()=>setTab('employee')}
            >
              Employee Log
            </button>
            
            {/* [STYLE CHANGE] Styled select */}
            {tab === 'employee' && (
              <select 
                className="border border-white/50 rounded px-2 py-1 bg-white/30 text-gray-900" 
                value={selectedEmployee} 
                onChange={(e)=>setSelectedEmployee(e.target.value)}
              >
                <option className="text-black" value="">Select employee</option>
                {employees.map(e => (
                  <option className="text-black" key={e.user_id || e.id || e.email} value={e.name}>{e.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-2">
            {/* [STYLE CHANGE] Light text label */}
            <label className="text-sm text-gray-200">KRA</label>
            {/* [STYLE CHANGE] Styled select */}
            <select 
              className="p-2 border border-white/50 rounded text-sm bg-white/30 text-gray-900" 
              value={kraFilter} 
              onChange={(e)=>setKraFilter(e.target.value)}
            >
              <option className="text-black" value="">All</option>
              {kraOptions.map(name => (<option className="text-black" key={name} value={name}>{name}</option>))}
            </select>
          </div>
        </div>
        
        {/* [STYLE CHANGE] Light text for loading/empty states */}
        {loading && <div className="text-white text-center p-4">Loading...</div>}
        {/* [STYLE CHANGE] High-contrast error message */}
        {error && <div className="bg-red-600 text-white p-3 rounded-md mb-3">{error}</div>}
        {!loading && !groupedFiltered.length && <div className="text-gray-300 text-center p-4">No logs found.</div>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groupedFiltered.map(({ kpi_id, latest }) => (
            // [STYLE CHANGE] Frosted glass log item card
            <div key={`card-${kpi_id}`} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">{latest.kpi_name}</div>
                  {/* [STYLE CHANGE] Light text */}
                  <div className="text-sm text-gray-300">KRA: {latest.kra_name} • Dept: {latest.dept || '-'} • Due: {latest.due_date ? new Date(latest.due_date).toLocaleDateString() : '-'}</div>
                </div>
                {/* [STYLE CHANGE] Light text */}
                <div className="text-sm text-gray-300 text-left sm:text-right mt-2 sm:mt-0 flex-shrink-0">
                  <div>Last Update By: {latest.updated_by}</div>
                  <div>At: {new Date(latest.updated_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button className="px-3 py-1 rounded bg-indigo-600 text-white text-sm" onClick={()=>{ setModalKpiId(kpi_id); setModalOpen(true); }}>See changes</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* [MODAL] */}
      {modalOpen && modalKpiId !== null && (
        // [STYLE CHANGE] Frosted glass backdrop
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {/* [STYLE CHANGE] Frosted glass modal card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 w-full max-w-2xl rounded-lg shadow-xl p-6 text-white">
            
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">KPI Change History</h3>
              {/* [STYLE CHANGE] Light text */}
              <button className="text-gray-200 text-2xl" onClick={()=>{ setModalOpen(false); setModalKpiId(null); }}>✕</button>
            </div>
            
            {/* [STYLE CHANGE] Added max-h and overflow for modal responsiveness */}
            <div className="space-y-3 max-h-[calc(80vh-100px)] overflow-y-auto pr-2">
              {(grouped.find(g=> g.kpi_id===modalKpiId)?.entries || []).map((log) => (
                // [STYLE CHANGE] Frosted glass history item
                <div key={`log-${log.kpi_id}-${log.version}-${log.updated_at}`} className="border border-white/20 bg-white/10 rounded p-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                    {/* [STYLE CHANGE] Light text */}
                    <div className="text-sm text-gray-200">Version v{log.version}</div>
                    <div className="text-sm text-gray-300">By {log.updated_by} • {new Date(log.updated_at).toLocaleString()}</div>
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