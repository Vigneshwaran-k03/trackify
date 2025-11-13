import { useEffect, useMemo, useState } from 'react';
import { getToken, getUserName } from '../../utils/authStorage';

// [CHANGE] Import your background image
// !! You may need to change this path depending on your file structure !!
import backgroundImage from '../../assets/background.png';

export default function ManagerKraLog() {
  // [LOGIC UNCHANGED]
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('mine'); // 'mine' | 'admin'
  const [showModal, setShowModal] = useState(false);
  const [modalLog, setModalLog] = useState(null);
  const managerName = getUserName() || '';

  // [LOGIC UNCHANGED]
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

  // [LOGIC UNCHANGED]
  const grouped = useMemo(() => {
    const byKra = new Map();
    for (const l of logs) {
      if (!byKra.has(l.kra_id)) byKra.set(l.kra_id, []);
      byKra.get(l.kra_id).push(l);
    }
    for (const arr of byKra.values()) arr.sort((a,b)=> (b.version||0) - (a.version||0));
    return Array.from(byKra.entries()).map(([kra_id, arr]) => ({ kra_id, entries: arr, latest: arr[0] }));
  }, [logs]);

  // [LOGIC UNCHANGED]
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
    return grouped.map(g => ({
      ...g,
      entries: g.entries.filter(l => String(l.manager_name || '').toLowerCase() === String(managerName).toLowerCase() && String(l.updated_by || '').toLowerCase() !== String(managerName).toLowerCase()),
      latest: g.entries.find(l => String(l.manager_name || '').toLowerCase() === String(managerName).toLowerCase() && String(l.updated_by || '').toLowerCase() !== String(managerName).toLowerCase()) || g.latest,
    })).filter(g => g.entries.length);
  }, [grouped, tab, managerName]);

  // [LOGIC UNCHANGED]
  const renderChanges = (json) => {
    if (!json) return <span>No details</span>;
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = Object.keys(obj);
      if (!keys.length) return <span>No details</span>;
      return (
        // [STYLE CHANGE] Text color inherits from parent (white)
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
          <h1 className="text-2xl font-semibold">KRA Log</h1>
          <div className="flex gap-2">
            {/* [STYLE CHANGE] Styled tabs */}
            <button 
              className={`px-3 py-1 rounded ${tab==='mine' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`} 
              onClick={()=> setTab('mine')}
            >
              My Changes
            </button>
            <button 
              className={`px-3 py-1 rounded ${tab==='admin' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`} 
              onClick={()=> setTab('admin')}
            >
              Admin Changes
            </button>
          </div>
        </div>
        
        {/* [STYLE CHANGE] Light text for loading/empty states */}
        {loading && <div className="text-white text-center p-4">Loading...</div>}
        {/* [STYLE CHANGE] High-contrast error message */}
        {error && <div className="bg-red-600 text-white p-3 rounded-md mb-3">{error}</div>}
        {!loading && !groupedFiltered.length && <div className="text-gray-300 text-center p-4">No logs found.</div>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groupedFiltered.map(({ kra_id, latest }) => (
            // [STYLE CHANGE] Frosted glass log item card
            <div key={`card-${kra_id}`} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold text-white">{latest.kra_name}</div>
                  {/* [STYLE CHANGE] Light text */}
                  <div className="text-sm text-gray-300">Dept: {latest.dept || '-'} • Version: v{latest.version}</div>
                  <div className="text-sm text-gray-300">Manager: {latest.manager_name || '-'}</div>
                  <div className="text-sm text-gray-300">Employee: {latest.employee_name || '-'}</div>
                </div>
                {/* [STYLE CHANGE] Light text */}
                <div className="text-sm text-gray-300 text-left sm:text-right mt-2 sm:mt-0">
                  <div>Updated By: {latest.updated_by}</div>
                  <div>At: {new Date(latest.updated_at).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-3">
                {/* [STYLE CHANGE] Styled button */}
                <button 
                  className="px-3 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700" 
                  onClick={()=> { setModalLog(latest); setShowModal(true); }}
                >
                  See Changes
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* [MODAL] */}
      {showModal && (
        // [STYLE CHANGE] Frosted glass backdrop
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {/* [STYLE CHANGE] Frosted glass modal card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 w-full max-w-md rounded-lg shadow-xl p-6 text-white">
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Changes: {modalLog?.kra_name}</h3>
              {/* [STYLE CHANGE] Light text */}
              <button className="text-gray-200 text-2xl" onClick={()=> setShowModal(false)}>✕</button>
            </div>
            
            {/* [STYLE CHANGE] Light text */}
            <div className="text-sm text-gray-200 space-y-2">
              <div>Dept: {modalLog?.dept || '-'}</div>
              <div>Manager: {modalLog?.manager_name || '-'}</div>
              <div>Employee: {modalLog?.employee_name || '-'}</div>
            </div>
            
            <div className="mt-3">{renderChanges(modalLog?.changes)}</div>
            
            <div className="mt-4 flex justify-end">
              {/* [STYLE CHANGE] Styled button */}
              <button 
                className="px-4 py-2 rounded border border-white/50 text-gray-200 hover:bg-white/10" 
                onClick={()=> setShowModal(false)}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}