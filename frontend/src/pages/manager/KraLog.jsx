import { useEffect, useMemo, useState } from 'react';
import { getToken, getUserName } from '../../utils/authStorage';

export default function ManagerKraLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Toggle between My Changes and Admin Changes
  const [tab, setTab] = useState('mine'); // 'mine' | 'admin'
  const [showModal, setShowModal] = useState(false);
  const [modalLog, setModalLog] = useState(null);
  const managerName = getUserName() || '';

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('http://localhost:3000/kra/logs', { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        if (!res.ok || data?.success !== true) throw new Error(data?.message || 'Failed to load KRA logs');
        const arr = Array.isArray(data.data) ? data.data : [];
        setLogs(arr);
      } catch (e) {
        setError(e.message || 'Failed to load KRA logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);


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
    if (tab === 'mine') {
      return grouped.map(g => ({
        ...g,
        entries: g.entries.filter(l => {
          const me = String(managerName).toLowerCase();
          const upd = String(l.updated_by || '').toLowerCase();
          const crt = String(l.created_by || '').toLowerCase();
          return upd === me || crt === me;
        }),
        latest: g.entries.find(l => {
          const me = String(managerName).toLowerCase();
          const upd = String(l.updated_by || '').toLowerCase();
          const crt = String(l.created_by || '').toLowerCase();
          return upd === me || crt === me;
        }) || g.latest,
      })).filter(g => g.entries.length);
    }
    // admin changes: logs where admin updated entries for KRAs assigned to this manager (manager_name == me)
    return grouped.map(g => ({
      ...g,
      entries: g.entries.filter(l => String(l.manager_name || '').toLowerCase() === String(managerName).toLowerCase() && String(l.updated_by || '').toLowerCase() !== String(managerName).toLowerCase()),
      latest: g.entries.find(l => String(l.manager_name || '').toLowerCase() === String(managerName).toLowerCase() && String(l.updated_by || '').toLowerCase() !== String(managerName).toLowerCase()) || g.latest,
    })).filter(g => g.entries.length);
  }, [grouped, tab, managerName]);

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
        <div className="flex gap-2">
          <button className={`px-3 py-1 rounded border ${tab==='mine' ? 'bg-indigo-600 text-white' : ''}`} onClick={()=> setTab('mine')}>My Changes</button>
          <button className={`px-3 py-1 rounded border ${tab==='admin' ? 'bg-indigo-600 text-white' : ''}`} onClick={()=> setTab('admin')}>Admin Changes</button>
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
