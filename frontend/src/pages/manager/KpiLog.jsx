import { useEffect, useMemo, useState } from 'react';
import { getToken } from '../../utils/authStorage';

export default function ManagerKpiLog() {
  const [tab, setTab] = useState('my'); // default to My Log; 'my' | 'employee'
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
          // fetch department KRAs for KRA options
          try {
            const kRes = await fetch(`http://localhost:3000/kra/department/${encodeURIComponent(d)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
            const kd = await kRes.json();
            let list = Array.isArray(kd?.data) ? kd.data : [];
            // Fallback: if empty, fetch all and filter by dept client-side (like ManagerDashboard)
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

  const grouped = useMemo(() => {
    const byKpi = new Map();
    for (const l of logs) {
      if (!byKpi.has(l.kpi_id)) byKpi.set(l.kpi_id, []);
      byKpi.get(l.kpi_id).push(l);
    }
    for (const arr of byKpi.values()) arr.sort((a,b)=> (b.version||0) - (a.version||0));
    return Array.from(byKpi.entries()).map(([kpi_id, arr]) => ({ kpi_id, entries: arr, latest: arr[0] }));
  }, [logs]);

  // Update assigned KRAs when tab or selection changes
  useEffect(() => {
    if (!deptKras.length) { setAssignedKras([]); return; }
    if (tab === 'employee') {
      if (!selectedEmployee) { setAssignedKras([]); return; }
      const sel = String(selectedEmployee || '').toLowerCase().trim();
      setAssignedKras(deptKras.filter(k => String(k.employee_name || '').toLowerCase().trim() === sel));
      return;
    }
    // My Log: KRAs assigned to this manager (manager_name == me)
    const me = String(managerName || '').toLowerCase().trim();
    setAssignedKras(deptKras.filter(k => String(k.manager_name || '').toLowerCase().trim() === me));
  }, [deptKras, tab, selectedEmployee, managerName]);

  const kraOptions = useMemo(() => {
    const set = new Set();
    assignedKras.forEach(k => {
      const label = k?.name || k?.kra_name;
      if (label) set.add(String(label));
    });
    return Array.from(set).sort();
  }, [assignedKras]);

  const groupedFiltered = useMemo(() => {
    if (!kraFilter) return grouped;
    return grouped.filter(g => String(g.latest?.kra_name || '') === String(kraFilter));
  }, [grouped, kraFilter]);

  const buildQuery = () => {
    const q = new URLSearchParams();
    if (tab === 'employee' && selectedEmployee) q.set('employee', selectedEmployee);
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

  // Auto-fetch: My tab always fetches; Employee tab fetches only when an employee is selected
  useEffect(() => {
    if (tab === 'employee') {
      if (!selectedEmployee) { setLogs([]); setLoading(false); return; }
      fetchLogs();
      return;
    }
    // My Log
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedEmployee]);

  const renderChanges = (json) => {
    if (!json) return <span>No details</span>;
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = Object.keys(obj);
      if (!keys.length) return <span>No details</span>;
      return (
        <ul className="list-disc pl-5 space-y-1">
          {keys.map((k) => {
            const v = obj[k];
            if (v && typeof v === 'object' && ('from' in v || 'to' in v)) {
              return <li key={k}><span className="font-medium">{k}</span>: {String(v.from ?? 'null')} → {String(v.to ?? 'null')}</li>;
            }
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
              return <li key={k}><span className="font-medium">{k}</span>: {String(v)}</li>;
            }
            return <li key={k}><span className="font-medium">{k}</span>: {JSON.stringify(v)}</li>;
          })}
        </ul>
      );
    } catch {
      return <span>Invalid</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">KPI Log</h1>
        <div className="flex items-center gap-2">
          <button className={`px-3 py-1 rounded ${tab === 'my' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`} onClick={()=>{ setTab('my'); setSelectedEmployee(''); }}>My Log</button>
          <button className={`px-3 py-1 rounded ${tab === 'employee' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`} onClick={()=>setTab('employee')}>Employee Log</button>
          {tab === 'employee' && (
            <select className="border rounded px-2 py-1" value={selectedEmployee} onChange={(e)=>setSelectedEmployee(e.target.value)}>
              <option value="">Select employee</option>
              {employees.map(e => (
                <option key={e.user_id || e.id || e.email} value={e.name}>{e.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">KRA</label>
          <select className="p-2 border rounded text-sm" value={kraFilter} onChange={(e)=>setKraFilter(e.target.value)}>
            <option value="">All</option>
            {kraOptions.map(name => (<option key={name} value={name}>{name}</option>))}
          </select>
        </div>
      </div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600 mb-3">{error}</div>}
      {!loading && !groupedFiltered.length && <div>No logs found.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groupedFiltered.map(({ kpi_id, latest }) => (
          <div key={`card-${kpi_id}`} className="bg-white border rounded p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{latest.kpi_name}</div>
                <div className="text-sm text-gray-600">KRA: {latest.kra_name} • Dept: {latest.dept || '-'} • Due: {latest.due_date ? new Date(latest.due_date).toLocaleDateString() : '-'}</div>
              </div>
              <div className="text-sm text-gray-600 text-right">
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

      {modalOpen && modalKpiId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded shadow p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">KPI Change History</h3>
              <button className="text-gray-600" onClick={()=>{ setModalOpen(false); setModalKpiId(null); }}>✕</button>
            </div>
            <div className="space-y-3">
              {(grouped.find(g=> g.kpi_id===modalKpiId)?.entries || []).map((log) => (
                <div key={`log-${log.kpi_id}-${log.version}-${log.updated_at}`} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">Version v{log.version}</div>
                    <div className="text-sm text-gray-600">By {log.updated_by} • {new Date(log.updated_at).toLocaleString()}</div>
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
