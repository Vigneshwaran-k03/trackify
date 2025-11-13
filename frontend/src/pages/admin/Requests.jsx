import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken } from '../../utils/authStorage';

function RequestRow({ r, onOpen }) {
  return (
    <tr className="border-b">
      <td className="px-3 py-2 text-sm">#{r.id}</td>
      <td className="px-3 py-2 text-sm">{r.kra_name || '-'}</td>
      <td className="px-3 py-2 text-sm">{r.dept || '-'}</td>
      <td className="px-3 py-2 text-sm">{r.requester_role} / {r.requester_name}</td>
      <td className="px-3 py-2 text-sm">{r.status}</td>
      <td className="px-3 py-2 text-sm"><button className="px-2 py-1 border rounded" onClick={()=>onOpen(r)}>View</button></td>
    </tr>
  );
}

export default function AdminRequests() {
  const [reqType, setReqType] = useState('kpi'); // kpi | kra
  const [tab, setTab] = useState('requests'); // requests | approvals
  const [status, setStatus] = useState('Pending');
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const fetchList = async () => {
    try {
      const params = {};
      if (tab === 'requests') params.status = status;
      else params.status = status;
      const url = reqType === 'kra' ? 'http://localhost:3000/requests/kra' : 'http://localhost:3000/requests';
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${getToken()}` }, params });
      setList(res.data?.data || []);
    } catch (_) {
      setList([]);
    }
  };

  useEffect(() => { fetchList(); }, [reqType, tab, status]);

  const openDetail = async (r) => {
    try {
      const url = reqType === 'kra' ? `http://localhost:3000/requests/kra/${r.id}` : `http://localhost:3000/requests/${r.id}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      setDetail(res.data?.data || r);
    } catch (_) {
      setDetail(r);
    }
  };

  const act = async (id, decision, comment = '') => {
    const path = decision === 'approve' ? 'approve' : 'reject';
    const body = decision === 'reject' ? { comment } : {};
    const url = reqType === 'kra' ? `http://localhost:3000/requests/kra/${id}/${path}` : `http://localhost:3000/requests/${id}/${path}`;
    await axios.post(url, body, { headers: { Authorization: `Bearer ${getToken()}` } });
    setDetail(null);
    fetchList();
  };

  const parsedChanges = (detail && detail.requested_changes) ? (() => { try { return JSON.parse(detail.requested_changes); } catch { return {}; } })() : {};

  return (
    <div className="text-black">
      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm">Type:</label>
        <select className="border rounded px-2 py-1" value={reqType} onChange={(e)=>{ setReqType(e.target.value); setDetail(null); }}>
          <option value="kpi">KPI</option>
          <option value="kra">KRA</option>
        </select>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <button className={`px-3 py-2 rounded border ${tab==='requests'?'bg-indigo-600 text-white':''}`} onClick={()=>{setTab('requests'); setStatus('Pending')}}>Requests</button>
        <button className={`px-3 py-2 rounded border ${tab==='approvals'?'bg-indigo-600 text-white':''}`} onClick={()=>{setTab('approvals'); setStatus('Approved')}}>Approvals</button>
        <div className="ml-auto flex items-center gap-2">
          <select className="border rounded px-2 py-1" value={status} onChange={(e)=>setStatus(e.target.value)}>
            {tab==='requests' ? (
              <>
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
              </>
            ) : (
              <>
                <option>Approved</option>
                <option>Rejected</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100 text-left text-sm">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">KRA</th>
              <th className="px-3 py-2">Dept</th>
              <th className="px-3 py-2">Requester</th>
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
              {reqType === 'kpi' && (<div><b>KPI ID:</b> {detail.kpi_id}</div>)}
              <div><b>KRA:</b> {detail.kra_name} (#{detail.kra_id})</div>
              <div><b>Dept:</b> {detail.dept}</div>
              <div><b>Requester:</b> {detail.requester_role} / {detail.requester_name}</div>
              <div><b>Status:</b> {detail.status}</div>
              <div><b>Reason:</b> {detail.request_comment || '-'}</div>
              <div className="mt-2">
                <b>Requested Changes:</b>
                <pre className="bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(parsedChanges, null, 2)}</pre>
              </div>
            </div>
            {detail.status === 'Pending' && (
              <div className="flex items-center justify-end gap-2 mt-4">
                <button className="px-4 py-2 rounded border" onClick={()=>{ setRejectComment(''); setRejectOpen(true); }}>Reject</button>
                <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={()=>act(detail.id, 'approve')}>Approve</button>
              </div>
            )}
          </div>
        </div>
      )}

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Reject Request #{detail?.id}</h3>
              <button onClick={()=>setRejectOpen(false)}>✕</button>
            </div>
            <div className="mb-3 text-sm">Please provide a reason for rejection.</div>
            <textarea className="w-full border rounded p-2 text-black" rows={4} placeholder="Enter comment" value={rejectComment} onChange={(e)=>setRejectComment(e.target.value)} />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="px-4 py-2 rounded border" onClick={()=>setRejectOpen(false)}>Cancel</button>
              <button className="px-4 py-2 rounded bg-red-600 text-white" onClick={async ()=>{ await act(detail.id, 'reject', rejectComment); setRejectOpen(false); }}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
