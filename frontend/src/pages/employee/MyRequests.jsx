import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken } from '../../utils/authStorage';

function RequestRow({ r, onOpen }) {
  return (
    <tr className="border-b">
      <td className="px-3 py-2 text-sm">#{r.id}</td>
      <td className="px-3 py-2 text-sm">{r.kra_name || '-'}</td>
      <td className="px-3 py-2 text-sm">{r.dept || '-'}</td>
      <td className="px-3 py-2 text-sm">{r.status}</td>
      <td className="px-3 py-2 text-sm"><button className="px-2 py-1 border rounded" onClick={()=>onOpen(r)}>View</button></td>
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
    <div className="text-black">
      <div className="flex items-center gap-2 mb-4">
        <label>Status:</label>
        <select className="border rounded px-2 py-1" value={status} onChange={(e)=>setStatus(e.target.value)}>
          <option value="">All</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
        </select>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100 text-left text-sm">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">KRA</th>
              <th className="px-3 py-2">Dept</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => <RequestRow key={r.id} r={r} onOpen={openDetail} />)}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Request #{detail.id}</h3>
              <button onClick={()=>setDetail(null)}>✕</button>
            </div>
            <div className="text-sm space-y-1">
              <div><b>KPI ID:</b> {detail.kpi_id}</div>
              <div><b>KRA:</b> {detail.kra_name} (#{detail.kra_id})</div>
              <div><b>Dept:</b> {detail.dept}</div>
              <div><b>Status:</b> {detail.status}</div>
              <div><b>Your Reason:</b> {detail.request_comment || '-'}</div>
              <div className="mt-2">
                <b>Requested Changes:</b>
                <pre className="bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(parsedChanges, null, 2)}</pre>
              </div>
              {detail.status !== 'Pending' && detail.decision_comment && (
                <div className="mt-2"><b>Decision Comment:</b> {detail.decision_comment}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
