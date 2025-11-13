import { useEffect, useMemo, useState } from 'react';
import { getToken } from '../../utils/authStorage';

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

  // Update assigned KRAs based on mode and selection
  useEffect(() => {
    if (!deptKras.length) { setAssignedKras([]); return; }
    if (mode === 'employee') {
      if (!employee) { setAssignedKras([]); return; }
      setAssignedKras(deptKras.filter(k => String(k.employee_name || '') === String(employee)));
      return;
    }
    // manager mode
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
        // fetch dept KRAs for KRA options
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

  // Auto-fetch when filters are sufficient
  useEffect(() => {
    if (!dept) { setLogs([]); setLoading(false); return; }
    if (mode === 'manager') {
      // Dept is sufficient, manager optional
      fetchLogs();
      return;
    }
    // Employee mode requires an employee selection
    if (employee) {
      fetchLogs();
    } else {
      setLogs([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dept, manager, employee]);

  const renderChanges = (json) => {
    if (!json) return <span>No details</span>;
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = Object.keys(obj);
      if (!keys.length) return <span>No details</span>;
      return (
        <ul className="list-disc pl-5 space-y-1">
          {keys.map((k) => (
            <li key={k}><span className="font-medium">{k}</span>: {String(obj[k]?.from ?? 'null')} → {String(obj[k]?.to ?? 'null')}</li>
          ))}
        </ul>
      );
    } catch {
      return <span>Invalid</span>;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">KPI Log</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <button className={`px-3 py-1 rounded ${mode==='manager'?'bg-indigo-600 text-white':'bg-gray-200'}`} onClick={()=>{ setMode('manager'); setEmployee(''); }}>Manager</button>
            <button className={`px-3 py-1 rounded ${mode==='employee'?'bg-indigo-600 text-white':'bg-gray-200'}`} onClick={()=> setMode('employee')}>Employee</button>
          </div>
          <select className="border rounded px-2 py-1" value={dept} onChange={(e)=>{ setDept(e.target.value); setManager(''); setEmployee(''); }}>
            <option value="">Select dept</option>
            {departments.map(d => (
              <option key={d.id || d.name} value={d.name || d}>{d.name || d}</option>
            ))}
          </select>
          <select className="border rounded px-2 py-1" value={manager} onChange={(e)=>{ setManager(e.target.value); if (mode==='manager') setEmployee(''); }}>
            <option value="">Select manager (optional)</option>
            {managers.map(m => (
              <option key={m.user_id || m.id || m.email} value={m.name}>{m.name}</option>
            ))}
          </select>
          {mode === 'employee' && (
            <select className="border rounded px-2 py-1" value={employee} onChange={(e)=>setEmployee(e.target.value)}>
              <option value="">Select employee (required)</option>
              {employees.map(emp => (
                <option key={emp.user_id || emp.id || emp.email} value={emp.name}>{emp.name}</option>
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
