import { useEffect, useMemo, useState } from 'react';
import { getToken } from '../../utils/authStorage';
// Import the background image
import backgroundImage from '../../assets/background.png';

export default function EmployeeKpiLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKpiId, setModalKpiId] = useState(null);
  const [kraFilter, setKraFilter] = useState('');
  const [assignedKras, setAssignedKras] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('http://localhost:3000/kpi/logs', { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        if (!res.ok || data?.success !== true) throw new Error(data?.message || 'Failed to load KPI logs');
        setLogs(Array.isArray(data.data) ? data.data : []);
      } catch (e) {
        setError(e.message || 'Failed to load KPI logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
    // Also fetch assigned KRAs for KRA filter options
    const fetchAssignedKras = async () => {
      try {
        const res = await fetch('http://localhost:3000/kpi/available', { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        const list = Array.isArray(data?.data) ? data.data : [];
        setAssignedKras(list);
      } catch (_) { setAssignedKras([]); }
    };
    fetchAssignedKras();
  }, []);

  // Updated renderChanges to have white text for the new background
  const renderChanges = (json) => {
    if (!json) return <span className="text-white/70">No details</span>;
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = Object.keys(obj);
      if (!keys.length) return <span className="text-white/70">No details</span>;
      return (
        <ul className="list-disc pl-5 space-y-1 text-white/90">
          {keys.map((k) => {
            const v = obj[k];
            if (v && typeof v === 'object' && ('from' in v || 'to' in v)) {
              return <li key={k}><span className="font-medium text-white">{k}</span>: {String(v.from ?? 'null')} → {String(v.to ?? 'null')}</li>;
            }
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
              return <li key={k}><span className="font-medium text-white">{k}</span>: {String(v)}</li>;
            }
            return <li key={k}><span className="font-medium text-white">{k}</span>: {JSON.stringify(v)}</li>;
          })}
        </ul>
      );
    } catch {
      return <span className="text-red-400">Invalid</span>;
    }
  };

  const grouped = useMemo(() => {
    const byKpi = new Map();
    for (const l of logs) {
      if (!byKpi.has(l.kpi_id)) byKpi.set(l.kpi_id, []);
      byKpi.get(l.kpi_id).push(l);
    }
    // sort each group by version desc
    for (const arr of byKpi.values()) {
      arr.sort((a,b)=> (b.version||0) - (a.version||0));
    }
    return Array.from(byKpi.entries()).map(([kpi_id, arr]) => ({ kpi_id, entries: arr, latest: arr[0] }));
  }, [logs]);

  const kraOptions = useMemo(() => {
    const set = new Set();
    assignedKras.forEach(k => { if (k.name) set.add(String(k.name)); });
    return Array.from(set).sort();
  }, [assignedKras]);

  const groupedFiltered = useMemo(() => {
    if (!kraFilter) return grouped;
    return grouped.filter(g => String(g.latest?.kra_name || '') === String(kraFilter));
  }, [grouped, kraFilter]);

  return (
    // Wrapper div for background image
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* Header/Filter bar with glassmorphism */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 bg-white/20 backdrop-blur-sm border border-white/30 p-4 rounded-lg shadow-lg">
          <h1 className="text-2xl font-semibold text-white mb-3 sm:mb-0">My KPI Log</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/80">KRA</label>
            <select
              className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-white"
              value={kraFilter}
              onChange={(e)=>setKraFilter(e.target.value)}
            >
              <option value="">All</option>
              {kraOptions.map(name => (<option key={name} value={name}>{name}</option>))}
            </select>
          </div>
        </div>

        {/* Loading/Error/Empty States */}
        {loading && <div className="text-white text-lg font-semibold text-center p-4">Loading...</div>}
        {error && <div className="bg-red-500/80 text-white font-semibold rounded-lg p-3 mb-3 shadow-lg">{error}</div>}
        {!loading && !error && !groupedFiltered.length && (
          <div className="text-white/90 text-lg p-4 bg-black/20 rounded-lg text-center backdrop-blur-sm">
            No logs found matching your criteria.
          </div>
        )}

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedFiltered.map(({ kpi_id, latest, entries }) => (
            // Card with glassmorphism
            <div key={`card-${kpi_id}`} className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-4 flex flex-col justify-between shadow-lg text-white">
              <div className="flex flex-col sm:flex-row items-start justify-between">
                <div className="mb-2 sm:mb-0">
                  <div className="text-lg font-semibold text-white">{latest.kpi_name}</div>
                  <div className="text-sm text-white/80">KRA: {latest.kra_name}</div>
                  <div className="text-sm text-white/80">Dept: {latest.dept || '-'}</div>
                  <div className="text-sm text-white/80">Due: {latest.due_date ? new Date(latest.due_date).toLocaleDateString() : '-'}</div>
                </div>
                <div className="text-sm text-white/80 text-left sm:text-right flex-shrink-0">
                  <div>Last Update By: <span className="font-medium text-white">{latest.updated_by}</span></div>
                  <div>At: {new Date(latest.updated_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  className="px-3 py-1 rounded border border-white/50 text-white text-sm hover:bg-white/20 transition-colors"
                  onClick={()=>{ setModalKpiId(kpi_id); setModalOpen(true); }}
                >
                  See changes
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal with glassmorphism */}
        {modalOpen && modalKpiId !== null && (
          // Modal overlay with padding for responsiveness
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            {/* Modal panel */}
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-2xl rounded-lg shadow-xl p-6 max-h-[80vh] text-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">KPI Change History</h3>
                <button className="text-white/80 hover:text-white text-2xl font-bold" onClick={()=>{ setModalOpen(false); setModalKpiId(null); }}>✕</button>
              </div>
              {/* Scrollable content area */}
              <div className="space-y-3 overflow-y-auto max-h-[calc(80vh-80px)] pr-2">
                {(grouped.find(g=> g.kpi_id===modalKpiId)?.entries || []).map((log) => (
                  // Log item card
                  <div key={`log-${log.kpi_id}-${log.version}-${log.updated_at}`} className="border border-white/30 bg-black/10 rounded-lg p-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                      <div className="text-sm text-white/90">Version v{log.version}</div>
                      <div className="text-sm text-white/80">By {log.updated_by} • {new Date(log.updated_at).toLocaleString()}</div>
                    </div>
                    <div className="mt-2">{renderChanges(log.changes)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}