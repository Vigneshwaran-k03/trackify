import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken, getRole } from '../../utils/authStorage';

export default function KraDetail() {
  const { kraId } = useParams();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState([]);
  const [kraName, setKraName] = useState('');
  const [aggregate, setAggregate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kraTarget, setKraTarget] = useState(null);
  const role = (getRole() || '').toLowerCase();
  const [viewFilter, setViewFilter] = useState('active'); // 'active' | 'all'

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [kraId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const [listRes, aggRes] = await Promise.all([
        axios.get(`http://localhost:3000/scoring/kra/${kraId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:3000/scoring/kra/${kraId}/aggregate`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const items = listRes.data?.data || [];
      setKpis(items.map(i => ({
        ...i,
        _score: typeof i.score === 'number' ? i.score : '',
        _comments: i.comments || '',
      })));
      if (items.length > 0) {
        setKraName(items[0]?.kra_name || '');
      } else {
        // Try to infer KRA name from available KRAs for this user
        try {
          const avail = await axios.get('http://localhost:3000/kpi/available', { headers: { Authorization: `Bearer ${getToken()}` } });
          const match = (avail.data?.data || []).find((k) => String(k.kra_id) === String(kraId));
          if (match) setKraName(match.name);
        } catch (_) {
          // ignore
        }
      }
      setAggregate(aggRes.data?.data?.percentage ?? null);

      if (role === 'admin' || role === 'manager') {
        try {
          const kraRes = await axios.get(`http://localhost:3000/kra/${kraId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
          const kraData = kraRes.data?.data || null;
          setKraTarget(typeof kraData?.target === 'number' ? kraData.target : null);
        } catch (_) {
          setKraTarget(null);
        }
      } else {
        // Employee: get KRA target from available list
        try {
          const avail = await axios.get('http://localhost:3000/kpi/available', { headers: { Authorization: `Bearer ${getToken()}` } });
          const match = (avail.data?.data || []).find((k) => String(k.kra_id) === String(kraId));
          setKraTarget(typeof match?.target === 'number' ? match.target : null);
          if (match && !kraName) setKraName(match.name || kraName);
        } catch (_) {
          setKraTarget(null);
        }
      }
    } catch (e) {
      console.error('Error loading KRA detail', e);
    }
    finally {
      setLoading(false);
    }
  };

  const saveKpi = async (kpi) => {
    try {
      setSaving(true);
      await axios.post('http://localhost:3000/scoring/add', {
        kpi_id: kpi.id,
        score: Number(kpi._score),
        comments: kpi._comments || undefined,
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      await fetchData();
    } catch (e) {
      console.error('Error saving score', e);
      setSaving(false);
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (kpi) => {
    const method = kpi.scoring_method;
    if (method === 'Percentage') {
      return (
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={kpi._score === '' ? 0 : kpi._score} onChange={(e) => updateLocal(kpi.id, { _score: Number(e.target.value) })} />
          <span className="w-12 text-right">{kpi._score || 0}%</span>
        </div>
      );
    }
    if (method === 'Scale (1-5)' || method === 'Rating') {
      const max = 5;
      return (
        <div className="flex items-center gap-3">
          <div className="flex">
            {Array.from({ length: max }).map((_, idx) => {
              const val = idx + 1;
              const active = Number(kpi._score) >= val;
              return (
                <button key={val} type="button" onClick={() => updateLocal(kpi.id, { _score: val })} className={active ? 'text-yellow-500' : 'text-gray-400'} title={`${val}`}>
                  ★
                </button>
              );
            })}
          </div>
          <span className="text-sm">{kpi._score || 0} / {max}</span>
        </div>
      );
    }
    if (method === 'Scale (1-10)') {
      return (
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={10} value={kpi._score === '' ? 0 : kpi._score} onChange={(e) => updateLocal(kpi.id, { _score: Number(e.target.value) })} />
          <span className="w-10 text-right">{kpi._score || 0}</span>
        </div>
      );
    }
    return <span>-</span>;
  };

  const updateLocal = (id, patch) => {
    setKpis(prev => prev.map(k => (k.id === id ? { ...k, ...patch } : k)));
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const visibleKpis = viewFilter === 'active' ? kpis.filter(k=> !k.due_date || new Date(k.due_date) >= today) : kpis;

  return (
    <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow text-black">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">KRA: {kraName}</h2>
          <div className="text-sm text-gray-600">Target: {kraTarget}</div>
        </div>
        <div className="text-right">
          <div className="text-lg">Overall: <span className="font-semibold text-indigo-600">{aggregate ?? 0}%</span></div>
          <StatusBadge aggregate={aggregate} target={kraTarget} />
        </div>
      </div>
      <div className="flex justify-end mb-3">
        <select className="p-2 border rounded text-sm" value={viewFilter} onChange={(e)=>setViewFilter(e.target.value)}>
          <option value="active">Active</option>
          <option value="all">All</option>
        </select>
      </div>
      {loading && <div>Loading...</div>}
      {!loading && visibleKpis.length === 0 && (
        <div className="p-4 border rounded text-gray-600">No KPIs created for this KRA yet.</div>
      )}
      <div className="space-y-4">
        {visibleKpis.map(kpi => (
          <div key={kpi.id} className="border rounded p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{kpi.name}</h3>
                <p className="text-sm text-gray-600">Due: {new Date(kpi.due_date).toLocaleDateString()} • Method: {kpi.scoring_method} • {typeof kpi.percentage === 'number' ? `Current: ${kpi.percentage}%` : 'No score yet'}</p>
              </div>
              <button disabled={saving || kpi._score === ''} onClick={() => saveKpi(kpi)} className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Score</label>
                {renderInput(kpi)}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Comments</label>
                <textarea value={kpi._comments} onChange={(e) => updateLocal(kpi.id, { _comments: e.target.value })} className="w-full p-2 border rounded" rows={2} placeholder="Add comments (optional)" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ aggregate, target }) {
  let label = 'Pending';
  let color = 'bg-gray-100 text-gray-800';

  const hasTarget = typeof target === 'number';
  const hasAgg = typeof aggregate === 'number';
  if (hasTarget && hasAgg) {
    const completed = aggregate >= target;
    const achieved = !completed && aggregate >= (0.7 * target);
    if (completed) {
      label = 'Completed';
      color = 'bg-green-100 text-green-800';
    } else if (achieved) {
      label = 'Achieved';
      color = 'bg-emerald-100 text-emerald-800';
    } else {
      label = 'Pending';
      color = 'bg-yellow-100 text-yellow-800';
    }
  }

  return (
    <div className={`inline-block mt-1 px-2 py-1 text-xs rounded ${color}`}>{label}</div>
  );
}
