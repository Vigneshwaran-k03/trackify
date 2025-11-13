import { useEffect, useState } from 'react';
import { Bell, Pin, PinOff, Trash2, CheckCheck, X } from 'lucide-react';
import axios from 'axios';
import { getRole, getToken, getUserName, clearAuth } from '../utils/authStorage';

export default function Notification() {
  const [open, setOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadLiveCount, setUnreadLiveCount] = useState(0);
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notif_read_ids') || '[]'); } catch { return []; }
  });
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notif_pinned_ids') || '[]'); } catch { return []; }
  });
  const [deletedIds, setDeletedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notif_deleted_ids') || '[]'); } catch { return []; }
  });
  const [clearedToday, setClearedToday] = useState(false);

  const role = (getRole() || '').toLowerCase();

  const saveMeta = (r, p, d = deletedIds) => {
    localStorage.setItem('notif_read_ids', JSON.stringify(r));
    localStorage.setItem('notif_pinned_ids', JSON.stringify(p));
    localStorage.setItem('notif_deleted_ids', JSON.stringify(d));
  };

  const markAsRead = (id) => {
    if (readIds.includes(id)) return;
    const r = [...readIds, id];
    setReadIds(r); saveMeta(r, pinnedIds);
  };

  const togglePin = (id) => {
    const p = pinnedIds.includes(id) ? pinnedIds.filter(x=>x!==id) : [...pinnedIds, id];
    setPinnedIds(p); saveMeta(readIds, p);
  };

  const deleteItem = async (it) => {
    try {
      const idStr = String(it.id || '');
      // If it's a persisted feed item, also delete on server
      if (it?.type === 'feed') {
        const nid = Number(idStr.startsWith('feed-') ? idStr.slice(5) : idStr);
        if (nid && !Number.isNaN(nid)) {
          const token = getToken();
          const rawRole = getRole() || '';
          const roleTitle = rawRole ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase() : '';
          const name = getUserName() || '';
          try {
            await axios.delete(`http://localhost:3000/notification/${nid}`, {
              headers: { Authorization: `Bearer ${token}` },
              params: { role: roleTitle, name },
            });
          } catch (_) {
            // ignore backend delete failure; still hide locally
          }
        }
      }
      // Always hide locally and remember deletion
      const d = Array.from(new Set([...deletedIds, idStr]));
      setDeletedIds(d); saveMeta(readIds, pinnedIds, d);
      setItems(prev => prev.filter(x => String(x.id) !== idStr));
    } catch (_) {}
  };

  const getTodaySixAM = () => {
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);
    return t.getTime();
  };

  // Daily clear at 6am: hide read & unpinned after the first check past 6am
  useEffect(() => {
    try {
      const lastClear = Number(localStorage.getItem('notif_last_clear_ts') || '0');
      const six = getTodaySixAM();
      const now = Date.now();
      if (now >= six && lastClear < six) {
        // Perform clear once: keep state, only mark the day
        localStorage.setItem('notif_last_clear_ts', String(now));
        setClearedToday(true);
      }
    } catch {}
  }, []);

  const fetchFeed = async () => {
    try {
      const token = getToken();
      const rawRole = getRole() || '';
      const roleTitle = rawRole ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase() : '';
      const name = getUserName() || '';
      const res = await axios.get('http://localhost:3000/notification/feed', {
        headers: { Authorization: `Bearer ${token}` },
        params: { role: roleTitle, name },
      });
      const list = res.data?.data || [];
      return list.map(n => ({
        id: `feed-${n.id}`,
        type: 'feed',
        name: n.title || 'Notification',
        message: n.message || '',
        kra_name: n?.meta?.kra || '',
        created_at: n.created_at,
      }));
    } catch (e) {
      if (e?.response?.status === 401) {
        try { clearAuth(); } catch {}
        try { window.location.href = '/login'; } catch {}
      }
      return [];
    }
  };

  // Lightweight polling: update unread count from feed periodically so badge updates without clicking
  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      try {
        const feed = await fetchFeed();
        if (cancelled) return;
        const unread = feed.filter(it => !readIds.includes(it.id) && !pinnedIds.includes(it.id) && !deletedIds.includes(String(it.id))).length;
        setUnreadLiveCount(unread);
      } catch { /* ignore */ }
    };
    // initial
    compute();
    const t = setInterval(compute, 10000);
    return () => { cancelled = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, JSON.stringify(readIds), JSON.stringify(pinnedIds), JSON.stringify(deletedIds)]);

  const fetchPendingKPIs = async () => {
    setLoading(true);
    try {
      const token = getToken();
      let kras = [];
      if (role !== 'admin') {
        try {
          const res = await axios.get('http://localhost:3000/kpi/available', {
            headers: { Authorization: `Bearer ${token}` },
          });
          kras = res.data?.data || [];
        } catch (e) {
          // If forbidden or any error, fallback to feed-only; do not throw
          kras = [];
        }
      }
      // For each KRA fetch its KPIs with score to determine pending
      const all = (
        await Promise.all(
          kras.map(async (k) => {
            try {
              const r = await axios.get(`http://localhost:3000/scoring/kra/${k.kra_id}` , {
                headers: { Authorization: `Bearer ${token}` },
              });
              const list = r.data?.data || [];
              return list.map(i => ({
                id: i.id,
                name: i.name,
                kra_id: i.kra_id,
                kra_name: i.kra_name || k.name,
                percentage: typeof i.percentage === 'number' ? i.percentage : 0,
                due_date: i.due_date,
              }));
            } catch { return []; }
          })
        )
      ).flat();
      const today = new Date(); today.setHours(0,0,0,0);
      // only include KPIs due today, in 1 day, or in 2 days
      const daysUntil = (d) => {
        const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const ms = due.getTime() - today.getTime();
        return Math.round(ms / (1000*60*60*24));
      };
      const pending = all.filter(i => {
        if ((i.percentage ?? 0) >= 100) return false;
        if (!i.due_date) return false;
        const d = new Date(i.due_date);
        if (isNaN(d)) return false;
        const diff = daysUntil(d);
        return diff === 0 || diff === 1 || diff === 2;
      });
      // Fetch submit notifications feed and merge
      const feed = await fetchFeed();
      const merged = [...pending, ...feed].filter(i => !deletedIds.includes(String(i.id)));
      // If cleared today, hide read and not pinned (for both lists)
      const filtered = clearedToday
        ? merged.filter(i => !(readIds.includes(i.id) && !pinnedIds.includes(i.id)))
        : merged;
      // Sort: feed by created_at desc first, then KPIs by due date asc
      const sorted = filtered.sort((a, b) => {
        const aFeed = a.type === 'feed';
        const bFeed = b.type === 'feed';
        if (aFeed && bFeed) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (aFeed && !bFeed) return -1;
        if (!aFeed && bFeed) return 1;
        // both KPI: earlier due date first
        const ad = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
      setItems(sorted.slice(0, 10));
    } catch (_) {
      // On any unexpected error, at least show feed
      try {
        const feed = await fetchFeed();
        setItems(feed.slice(0, 10));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Open medium popup once per login (not on refresh) for non-admin roles
    const onceKey = 'notif_popup_shown';
    const shown = localStorage.getItem(onceKey);
    if ((role === 'employee' || role === 'manager') && !shown) {
      fetchPendingKPIs().then(() => {
        setPopupOpen(true);
        localStorage.setItem(onceKey, '1');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count excludes pinned, read, and deleted. When panel is closed, use live unread feed count to keep badge fresh.
  const count = items.filter(it => !readIds.includes(it.id) && !pinnedIds.includes(it.id) && !deletedIds.includes(String(it.id))).length;
  const badgeCount = open ? count : unreadLiveCount;

  return (
    <div className="relative">
      <button
        onClick={() => { if (!open) fetchPendingKPIs(); setOpen(v => !v); }}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-md border hover:bg-gray-100"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5">{badgeCount}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow z-20">
          <div className="p-3 border-b font-medium flex items-center justify-between">
            <span>Notifications</span>
            <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setOpen(false)} aria-label="Close panel"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-80 overflow-auto">
            {loading && <div className="p-3 text-sm text-gray-600">Loading...</div>}
            {!loading && items.length === 0 && <div className="p-3 text-sm text-gray-600">📭 No notifications yet</div>}
            {!loading && items.map(it => (
              <div key={it.id} className="p-3 border-b last:border-b-0 flex gap-2 items-start">
                <div className="flex-1">
                  <div className="text-sm font-medium">{it.name}</div>
                  {it.type === 'feed' ? (
                    <div className="text-xs text-gray-500">{it.message}</div>
                  ) : (
                    <>
                      <div className="text-xs text-gray-500">KRA: {it.kra_name || it.kra_id}</div>
                      {it.due_date && <div className="text-xs text-gray-500">Due: {new Date(it.due_date).toLocaleDateString()}</div>}
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  <button className={`inline-flex items-center justify-center w-8 h-8 rounded-md border ${pinnedIds.includes(it.id)?'bg-yellow-100 border-yellow-300':'bg-white'}`} title="Pin" onClick={() => togglePin(it.id)}>
                    {pinnedIds.includes(it.id) ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button className={`inline-flex items-center justify-center w-8 h-8 rounded-md border ${readIds.includes(it.id)?'bg-gray-100':'bg-white'}`} title="Mark as read" onClick={() => markAsRead(it.id)}>
                    <CheckCheck className="w-4 h-4" />
                  </button>
                  <button className="inline-flex items-center justify-center w-8 h-8 rounded-md border" title="Delete" onClick={() => deleteItem(it)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 text-right">
            <button className="inline-flex items-center gap-1 px-3 py-1 text-sm border rounded" onClick={() => setOpen(false)}><X className="w-4 h-4" /> Close</button>
          </div>
        </div>
      )}

      {popupOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white text-black w-full max-w-xl rounded shadow p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Pending KPIs</h3>
              <button onClick={() => setPopupOpen(false)} className="p-1 hover:bg-gray-100 rounded" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {loading && <div className="p-3 text-sm text-gray-600">Loading...</div>}
              {!loading && items.length === 0 && <div className="p-3 text-sm text-gray-600">📭 No notifications yet</div>}
              {!loading && items.map(it => (
                <div key={it.id} className="p-3 border rounded mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{it.name}</div>
                      {it.type === 'feed' ? (
                        <div className="text-xs text-gray-500">{it.message}</div>
                      ) : (
                        <>
                          <div className="text-xs text-gray-500">KRA: {it.kra_name || it.kra_id}</div>
                          {it.due_date && <div className="text-xs text-gray-500">Due: {new Date(it.due_date).toLocaleDateString()}</div>}
                        </>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button className={`text-xs px-2 py-1 rounded border ${pinnedIds.includes(it.id)?'bg-yellow-100 border-yellow-300':'bg-white'}`} title="Pin" onClick={() => togglePin(it.id)}>📌</button>
                      <button className={`text-xs px-2 py-1 rounded border ${readIds.includes(it.id)?'bg-gray-100':'bg-white'}`} title="Mark as read" onClick={() => markAsRead(it.id)}>✓</button>
                      <button className="text-xs px-2 py-1 rounded border" title="Delete" onClick={() => deleteItem(it)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right mt-3">
              <button className="px-4 py-2 rounded border" onClick={() => setPopupOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
