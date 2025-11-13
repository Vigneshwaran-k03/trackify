import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken } from '../../utils/authStorage';
// Import the background image
import backgroundImage from '../../assets/background.png';

// Styled RequestRow
function RequestRow({ r, onOpen }) {
  return (
    <tr className="border-b border-white/20">
      <td className="px-3 py-2 text-sm text-white/90">#{r.id}</td>
      <td className="px-3 py-2 text-sm text-white/90">{r.kra_name || '-'}</td>
      <td className="px-3 py-2 text-sm text-white/90">{r.dept || '-'}</td>
      <td className="px-3 py-2 text-sm text-white/90">{r.status}</td>
      <td className="px-3 py-2 text-sm">
        <button 
          className="px-2 py-1 border border-white/50 rounded text-white hover:bg-white/20 transition-colors" 
          onClick={()=>onOpen(r)}
        >
          View
        </button>
      </td>
    </tr>
  );
}

export default function EmployeeMyRequests() {
  const [status, setStatus] = useState(''); // All default
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);

  const fetchList = async () => {
    const params = { scope: 'mine' };
    if (status) params.status = status;
    try {
      const res = await axios.get('http://localhost:3000/requests', { headers: { Authorization: `Bearer ${getToken()}` }, params });
      setList(res.data?.data || []);
    } catch (_) {
      setList([]);
    }
  };

  useEffect(() => { fetchList(); }, [status]);

  const openDetail = async (r) => {
    try {
      const res = await axios.get(`http://localhost:3000/requests/${r.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      setDetail(res.data?.data || r);
    } catch (_) {
      setDetail(r);
    }
  };

  const parsedChanges = (detail && detail.requested_changes) ? (() => { try { return JSON.parse(detail.requested_changes); } catch { return {}; } })() : {};

  return (
    // Wrapper div for background image
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Content container with padding */}
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Main card with glassmorphism */}
        <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 md:p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center gap-2 mb-4">
            <label className="text-white/90">Status:</label>
            <select 
              className="border border-white/50 rounded px-2 py-1 bg-white/30 text-gray-900 focus:outline-none focus:ring-2 focus:ring-white" 
              value={status} 
              onChange={(e)=>setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>

          {/* Table container with glassmorphism */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg shadow-lg overflow-auto border border-white/30">
            <table className="min-w-full">
              <thead>
                <tr className="bg-black/30 text-left text-sm border-b border-white/30">
                  <th className="px-3 py-2 font-semibold text-white">ID</th>
                  <th className="px-3 py-2 font-semibold text-white">KRA</th>
                  <th className="px-3 py-2 font-semibold text-white">Dept</th>
                  <th className="px-3 py-2 font-semibold text-white">Status</th>
                  <th className="px-3 py-2 font-semibold text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.length > 0 ? (
                  list.map(r => <RequestRow key={r.id} r={r} onOpen={openDetail} />)
                ) : (
                  <tr>
                    <td colSpan="5" className="p-4 text-center text-white/70">
                      No requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {detail && (
          // Modal overlay with padding for responsiveness
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            {/* Modal card with glassmorphism */}
            <div className="w-full max-w-2xl bg-white/20 backdrop-blur-md border border-white/30 rounded-lg shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Request #{detail.id}</h3>
                <button 
                  onClick={()=>setDetail(null)} 
                  className="text-white/80 hover:text-white text-2xl font-bold"
                >
                  ✕
                </button>
              </div>
              {/* Scrollable content area for modal */}
              <div className="text-sm space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                <div className="text-white/90"><b className="text-white">KPI ID:</b> {detail.kpi_id}</div>
                <div className="text-white/90"><b className="text-white">KRA:</b> {detail.kra_name} (#{detail.kra_id})</div>
                <div className="text-white/90"><b className="text-white">Dept:</b> {detail.dept}</div>
                <div className="text-white/90"><b className="text-white">Status:</b> {detail.status}</div>
                <div className="text-white/90"><b className="text-white">Your Reason:</b> {detail.request_comment || '-'}</div>
                <div className="mt-2">
                  <b className="text-white">Requested Changes:</b>
                  <pre className="bg-black/30 p-2 rounded overflow-auto text-white/90 text-xs mt-1">
                    {JSON.stringify(parsedChanges, null, 2)}
                  </pre>
                </div>
                {detail.status !== 'Pending' && detail.decision_comment && (
                  <div className="mt-2 text-white/90"><b className="text-white">Decision Comment:</b> {detail.decision_comment}</div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button 
                  className="px-4 py-2 rounded border border-white/50 text-white hover:bg-white/20 transition-colors" 
                  onClick={()=>setDetail(null)}
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