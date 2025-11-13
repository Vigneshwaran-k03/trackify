import { useEffect, useMemo, useState } from 'react';
import { getToken, getUserName } from '../../utils/authStorage';

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
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">KRA Log</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 ml-2">
            <button className={`px-3 py-1 rounded border ${tab==='mine' ? 'bg-indigo-600 text-white' : ''}`} onClick={()=> { setTab('mine'); setManager(''); setEmployee(''); }}>My Changes</button>
            <button className={`px-3 py-1 rounded border ${tab==='manager' ? 'bg-indigo-600 text-white' : ''}`} onClick={()=> { setTab('manager'); }}>Manager Changes</button>
          </div>
          <select className="border rounded px-2 py-1" value={dept} onChange={(e)=>{ setDept(e.target.value); setManager(''); setEmployee(''); }}>
            <option value="">Select dept</option>
            {departments.map(d => (
              <option key={d.id || d.name} value={d.name || d}>{d.name || d}</option>
            ))}
          </select>
          {(tab === 'mine' || tab === 'manager') && (
            <select className="border rounded px-2 py-1" value={manager} onChange={(e)=>{ setManager(e.target.value); if (tab==='mine') setEmployee(''); }}>
              <option value="">Select manager {tab==='mine' ? '(optional)' : ''}</option>
              {managers.map(m => (
                <option key={m.user_id || m.id || m.email} value={m.name}>{m.name}</option>
              ))}
            </select>
          )}
          {tab === 'manager' && (
            <select className="border rounded px-2 py-1" value={employee} onChange={(e)=> setEmployee(e.target.value)}>
              <option value="">Select employee (optional)</option>
              {employees.map(emp => (
                <option key={emp.user_id || emp.id || emp.email} value={emp.name}>{emp.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600 mb-3">{error}</div>}
      {!loading && !groupedFiltered.length && <div>No logs found.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groupedFiltered.map(({ kra_id, latest }) => (
          <div key={`card-${kra_id}`} className="bg-white border rounded p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{latest.kra_name}</div>
                <div className="text-sm text-gray-600">Dept: {latest.dept || '-'} • Version: v{latest.version}</div>
                <div className="text-sm text-gray-600">Manager: {latest.manager_name || '-'}</div>
                <div className="text-sm text-gray-600">Employee: {latest.employee_name || '-'}</div>
              </div>
              <div className="text-sm text-gray-600 text-right">
                <div>Updated By: {latest.updated_by}</div>
                <div>At: {new Date(latest.updated_at).toLocaleString()}</div>
              </div>
            </div>
            <div className="mt-3">
              <button className="px-3 py-1 rounded border" onClick={()=> { setModalLog(latest); setShowModal(true); }}>See Changes</button>
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Changes: {modalLog?.kra_name}</h3>
              <button className="text-gray-600" onClick={()=> setShowModal(false)}>✕</button>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <div>Dept: {modalLog?.dept || '-'}</div>
              <div>Manager: {modalLog?.manager_name || '-'}</div>
              <div>Employee: {modalLog?.employee_name || '-'}</div>
            </div>
            <div className="mt-3">{renderChanges(modalLog?.changes)}</div>
            <div className="mt-4 flex justify-end">
              <button className="px-4 py-2 rounded border" onClick={()=> setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
