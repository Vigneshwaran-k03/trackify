import { useState, useEffect, useRef } from 'react';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { exportChartFromRef, exportSectionById, exportTableToCSV, exportTableToExcel } from '../../utils/exportUtils';
import axios from 'axios';
import { getToken, getRole, getUserName } from '../../utils/authStorage';
// Import the background image
import backgroundImage from '../../assets/background.png';

export default function ManagerDashboard() {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);
  const [userName, setUserName] = useState('');
  const [userDept, setUserDept] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [departmentKRAs, setDepartmentKRAs] = useState([]);
  const [myKras, setMyKras] = useState([]);
  const [myKPIs, setMyKPIs] = useState([]);
  const [userId, setUserId] = useState(0);
  const [activeSection, setActiveSection] = useState('overview');
  const [deptKraAggregates, setDeptKraAggregates] = useState({});
  // Modal state for KRA details (list KPIs)
  const [kraModalOpen, setKraModalOpen] = useState(false);
  const [kraModalLoading, setKraModalLoading] = useState(false);
  const [kraModalKpis, setKraModalKpis] = useState([]);
  const [kraModalAgg, setKraModalAgg] = useState(0);
  const [kraModalShowSubmit, setKraModalShowSubmit] = useState(false);
  // Score modal (view/edit score)
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [scoreModalKpi, setScoreModalKpi] = useState(null);
  const [scoreModalValue, setScoreModalValue] = useState('');
  const [scoreModalComments, setScoreModalComments] = useState('');
  // Edit KPI details modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: 0, name: '', def: '', due_date: '', target: '', scoring_method: '' });
  const [tasksFilter, setTasksFilter] = useState('active'); // 'active' | 'all'
  const [tasksKraFilter, setTasksKraFilter] = useState(''); // '' or kra_id
  const [teamEmployeeFilter, setTeamEmployeeFilter] = useState('all'); // 'all' or employee name
  // Review tab state
  const [revKraId, setRevKraId] = useState('');
  const [revEmployeeId, setRevEmployeeId] = useState('');
  const [revScore, setRevScore] = useState('');
  const [revComment, setRevComment] = useState('');
  const [revKpis, setRevKpis] = useState([]);
  const [revLoading, setRevLoading] = useState(false);
  const navigate = useNavigate();
  // Reviews: list created by me
  const [myReviews, setMyReviews] = useState([]);
  const [revEditOpen, setRevEditOpen] = useState(false);
  const [revEditForm, setRevEditForm] = useState({ id: 0, score: '', comment: '', review_at: '' });
  // Reviews received (manager performance)
  const [perfFilter, setPerfFilter] = useState({ year: new Date().getFullYear(), month: new Date().getMonth()+1 });
  const [perfReviews, setPerfReviews] = useState([]);
  const [perfKraSeries, setPerfKraSeries] = useState({ labels: [], values: [] });
  // Manager trend (monthly over selected year)
  const [trendYear, setTrendYear] = useState(new Date().getFullYear());
  const [mgrTrend, setMgrTrend] = useState({ labels: [], values: [] });
  const [mgrTrendDelta, setMgrTrendDelta] = useState(0);
  // Profile gauges
  const [gauge1Filter, setGauge1Filter] = useState(()=>{ const d = new Date(); return { year: d.getFullYear(), month: d.getMonth()+1 }; });
  const [gauge2Filter, setGauge2Filter] = useState(()=>{ const d = new Date(); const prev = new Date(d.getFullYear(), d.getMonth()-1, 1); return { year: prev.getFullYear(), month: prev.getMonth()+1 }; });
  const [gauge1Avg, setGauge1Avg] = useState(0);
  const [gauge2Avg, setGauge2Avg] = useState(0);
  const [gauge1Target, setGauge1Target] = useState(0);
  const [gauge2Target, setGauge2Target] = useState(0);
  // Overview charts state
  const [ovB1Type, setOvB1Type] = useState('bar');
  const [ovB2Type, setOvB2Type] = useState('pie');
  const [ovB3Type, setOvB3Type] = useState('bar');
  const [ovB4Type, setOvB4Type] = useState('bar');
  const [ovB5TypeKra, setOvB5TypeKra] = useState('bar');
  const [ovB5TypeKpi, setOvB5TypeKpi] = useState('bar');
  const [ovB2KraId, setOvB2KraId] = useState('');
  const [ovB3Filter, setOvB3Filter] = useState({ kind: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth()+1, week: 1, quarter: 1, date: format(new Date(), 'yyyy-MM-dd') });
  const [ovB3Basis, setOvB3Basis] = useState('created'); // created|due|both
  const [ovB4Filter, setOvB4Filter] = useState({ kind: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth()+1, week: 1, quarter: 1, date: format(new Date(), 'yyyy-MM-dd') });
  const [ovB4Basis, setOvB4Basis] = useState('created');
  const [ovB5Filter, setOvB5Filter] = useState({ kind: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth()+1, week: 1, quarter: 1, date: format(new Date(), 'yyyy-MM-dd') });
  const [ovB5Basis, setOvB5Basis] = useState('created');
  const [ovB3FilterOpen, setOvB3FilterOpen] = useState(false);
  const [ovB4FilterOpen, setOvB4FilterOpen] = useState(false);
  const [ovB5FilterOpen, setOvB5FilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportAllFormat, setExportAllFormat] = useState('pdf'); // pdf|png|jpg
  const [expAllOpen, setExpAllOpen] = useState(false);
  const [exp1Open, setExp1Open] = useState(false);
  const [exp2Open, setExp2Open] = useState(false);
  const [exp3Open, setExp3Open] = useState(false);
  const [exp4Open, setExp4Open] = useState(false);
  const [exp5Open, setExp5Open] = useState(false);
  const [expTasksOpen, setExpTasksOpen] = useState(false);
  const [expKrasOpen, setExpKrasOpen] = useState(false);
  const [expTeamOpen, setExpTeamOpen] = useState(false);
  const [expKrasListOpen, setExpKrasListOpen] = useState(false);
  const [submitToast, setSubmitToast] = useState(false);
  // Chart Refs for export
  const ovB1Ref = useRef(null);
  const ovB2Ref = useRef(null);
  const ovB3Ref = useRef(null);
  const ovB4Ref = useRef(null);
  const ovB5KraRef = useRef(null);
  const ovB5KpiRef = useRef(null);

  // Using shared export utils from utils/exportUtils

  // Helpers: resolve KRA name from available lists
  const resolveKraName = (kraId) => {
    const id = String(kraId);
    const fromDept = (departmentKRAs||[]).find(k=> String(k.kra_id)===id);
    if (fromDept && (fromDept.name || fromDept.kra_name)) return fromDept.name || fromDept.kra_name;
    const fromMine = (myKras||[]).find(k=> String(k.kra_id)===id);
    if (fromMine && (fromMine.name || fromMine.kra_name)) return fromMine.name || fromMine.kra_name;
    return `KRA ${id}`;
  };


  const submitKraModalNotify = async () => {
    try {
      const token = getToken();
      const first = (kraModalKpis && kraModalKpis[0]) || null;
      const kraId = first?.kra_id || '';
      let kraName = (first?.kra_name) || '';
      let adminName = '';
      if (kraId) {
        try {
          const r = await axios.get(`http://localhost:3000/kra/${kraId}`, { headers: { Authorization: `Bearer ${token}` } });
          const k = r.data?.data || {};
          adminName = k.created_by || '';
          if (!kraName) kraName = k.name || '';
        } catch (_) {}
      }
      await axios.post('http://localhost:3000/notification/submit', {
        actorRole: 'Manager',
        actorName: userName,
        targetRole: 'Admin',
        targetName: adminName,
        context: { kra: kraName, dept: userDept || '' },
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSubmitToast(true);
      setTimeout(()=> setSubmitToast(false), 2000);
    } catch (_) {}
  };

  // Reviews: monthly average (for gauges)
  const fetchMonthlyAverage = async (mgrId, y, m) => {
    if (!mgrId) return { avg: 0, targetAvg: 100 };
    try {
      const token = getToken();
      const res = await axios.get(`http://localhost:3000/review/employee/${mgrId}/month`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year: y, month: m }
      });
      const list = res.data?.data || [];
      const scores = list.map(r => (typeof r.score === 'number' ? r.score : Number(r.score || 0))).filter(v=>!Number.isNaN(v));
      const avg = scores.length ? (scores.reduce((a,b)=>a+b,0) / scores.length) : 0;
      const kraIds = Array.from(new Set(list.map(r=> r.kra_id))).filter(Boolean);
      const targets = kraIds.map(id => {
        const match = (departmentKRAs||myKras||[]).find?.(k=> String(k.kra_id)===String(id));
        const tgt = typeof match?.target === 'number' ? match.target : 100;
        return tgt;
      });
      const targetAvg = targets.length ? (targets.reduce((a,b)=>a+b,0) / targets.length) : 100;
      return { avg: Math.round(avg * 100) / 100, targetAvg: Math.round(targetAvg * 100) / 100 };
    } catch (_) { return { avg: 0, targetAvg: 100 }; }
  };

  // Reviews: monthly list and per-KRA average series
  const fetchMonthlyReviews = async (mgrId, y, m) => {
    if (!mgrId) return;
    try {
      const token = getToken();
      const res = await axios.get(`http://localhost:3000/review/employee/${mgrId}/month`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year: y, month: m }
      });
      const list = res.data?.data || [];
      setPerfReviews(list);
      const byKra = new Map();
      list.forEach(r => {
        const key = r.kra_name || String(r.kra_id);
        if (!byKra.has(key)) byKra.set(key, []);
        byKra.get(key).push(typeof r.score === 'number' ? r.score : Number(r.score || 0));
      });
      const labels = Array.from(byKra.keys());
      const values = labels.map(k => {
        const arr = byKra.get(k) || []; if (!arr.length) return 0; return Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*100)/100;
      });
      setPerfKraSeries({ labels, values });
    } catch (_) {
      setPerfReviews([]);
      setPerfKraSeries({ labels: [], values: [] });
    }
  };

  // Load gauges when filters or user change
  useEffect(()=>{
    let mounted = true;
    const run = async () => {
      if (!userId) return;
      const [r1, r2] = await Promise.all([
        fetchMonthlyAverage(userId, gauge1Filter.year, gauge1Filter.month),
        fetchMonthlyAverage(userId, gauge2Filter.year, gauge2Filter.month),
      ]);
      if (!mounted) return;
      setGauge1Avg(r1.avg); setGauge1Target(r1.targetAvg);
      setGauge2Avg(r2.avg); setGauge2Target(r2.targetAvg);
    };
    run();
    return ()=>{ mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, gauge1Filter.year, gauge1Filter.month, gauge2Filter.year, gauge2Filter.month]);

  // Load review series when filter changes
  useEffect(() => {
    if (userId && perfFilter?.year && perfFilter?.month) {
      fetchMonthlyReviews(userId, perfFilter.year, perfFilter.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, perfFilter.year, perfFilter.month]);

  // Build manager monthly trend across the selected year (decoupled from perfFilter)
  useEffect(() => {
    const run = async () => {
      try {
        if (!userId) { setMgrTrend({ labels: [], values: [] }); setMgrTrendDelta(0); return; }
        const year = trendYear || new Date().getFullYear();
        const now = new Date();
        const maxMonth = (year === now.getFullYear()) ? (now.getMonth() + 1) : 12;
        const months = Array.from({ length: maxMonth }, (_, i) => i + 1);
        const labels = months.map(m => new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'short' }));
        const lists = await Promise.all(months.map(mm => fetchMonthlyAverage(userId, year, mm)));
        const values = lists.map(r => Math.max(0, Math.min(100, r?.avg || 0)));
        setMgrTrend({ labels, values });
        // Delta logic: now month - last month (use last two numeric values)
        const nums = values.filter(v => typeof v === 'number');
        const cur = nums.length ? nums[nums.length - 1] : undefined;
        const prev = nums.length > 1 ? nums[nums.length - 2] : undefined;
        const delta = (typeof cur === 'number' && typeof prev === 'number') ? Math.round((cur - prev) * 100) / 100 : 0;
        setMgrTrendDelta(delta);
      } catch (_) {
        setMgrTrend({ labels: [], values: [] }); setMgrTrendDelta(0);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, trendYear]);

  // Normalize various date field shapes to a Date at 00:00 local or null
  const normalizeDate = (val) => {
    try {
      if (!val) return null;
      if (val instanceof Date) return new Date(val.getFullYear(), val.getMonth(), val.getDate());
      if (typeof val === 'number') {
        const d = new Date(val); if (isNaN(d)) return null; return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      const d = new Date(val);
      if (isNaN(d)) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } catch { return null; }
  };

  const exportAllCharts = async (fmt) => {
    try {
      setExporting(true);
      const refs = [
        { r: ovB1Ref, name: 'kra_assigned' },
        { r: ovB2Ref, name: 'kpi_selected_kra' },
        { r: ovB3Ref, name: 'kra_frequency' },
        { r: ovB4Ref, name: 'kpi_frequency' },
        { r: ovB5KraRef, name: 'kra_by_frequency' },
        { r: ovB5KpiRef, name: 'kpi_by_frequency' },
      ];
      const format = fmt || exportAllFormat;
      if (format === 'pdf') {
        const pdf = new jsPDF('p', 'mm', 'a4');
        let first = true;
        let anyAdded = false;
        for (const { r, name } of refs) {
          const inst = r?.current || r; if (!inst) continue;
          const img = inst.toBase64Image('image/png', 1); if (!img) continue;
          const w = pdf.internal.pageSize.getWidth();
          const h = w * 0.6;
          if (!first) pdf.addPage();
          pdf.text(name, 10, 10);
          pdf.addImage(img, 'PNG', 10, 20, w - 20, h);
          first = false;
          anyAdded = true;
        }
        if (!anyAdded) { pdf.text('Manager Overview Charts', 10, 10); }
        pdf.save('manager-overview-charts.pdf');
      } else {
        // trigger individual downloads
        for (const { r, name } of refs) {
          exportChartFromRef(r, `${name}.${format==='jpg'?'jpg':'png'}`, format);
        }
      }
    } catch (_) {
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    const name = getUserName() || 'Manager';

    if (!token || (role || '').toLowerCase() !== 'manager') {
      window.location.href = '/login';
      return;
    }

    setUserName(name);

    // Fetch manager-specific data
    fetchUserProfile();
    fetchTeamMembers();
    fetchDepartmentKRAs();
  }, []);

  const logoutAndRedirect = () => {
    try {
      // best-effort local clear if present
      localStorage.removeItem('token');
    } finally {
      window.location.href = '/login';
    }
  };

  // Re-fetch team and department KRAs once department is known
  useEffect(() => {
    if (!userDept) return;
    fetchTeamMembers();
    fetchDepartmentKRAs();
  }, [userDept]);

  // Ensure My Reviews list loads when navigating to the Review section
  useEffect(() => {
    if (activeSection === 'review') {
      fetchMyReviews();
    }
  }, [activeSection]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('http://localhost:3000/auth/profile', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const profile = response.data?.user || response.data || {};
      const dept = profile.dept || profile.department || profile.dept_name || '';
      setUserDept(dept);
      if (profile?.user_id) setUserId(profile.user_id); else if (profile?.id) setUserId(profile.id);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      if (error?.response?.status === 401) logoutAndRedirect();
    }
  };

  // Helpers: frequency range
  const makeRange = (f) => {
    const kind = f.kind;
    if (kind === 'date') {
      const d = parseISO(f.date);
      return { start: d, end: d };
    }
    if (kind === 'weekly') {
      const firstOfMonth = new Date(f.year, f.month - 1, 1);
      let start = startOfWeek(firstOfMonth, { weekStartsOn: 1 });
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (f.week - 1) * 7);
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const monthStart = startOfMonth(new Date(f.year, f.month - 1, 1));
      const monthEnd = endOfMonth(monthStart);
      const rangeStart = monthStart > start ? monthStart : start;
      const rangeEnd = monthEnd < end ? monthEnd : end;
      return { start: rangeStart, end: rangeEnd };
    }
    if (kind === 'monthly') {
      const s = startOfMonth(new Date(f.year, f.month - 1, 1));
      return { start: s, end: endOfMonth(s) };
    }
    if (kind === 'quarterly') {
      const q = Math.min(Math.max(f.quarter, 1), 4);
      const startMonth = (q - 1) * 3;
      const s = startOfQuarter(new Date(f.year, startMonth, 1));
      return { start: s, end: endOfQuarter(s) };
    }
    const s = startOfYear(new Date(f.year, 0, 1));
    return { start: s, end: endOfYear(s) };
  };

  const isInRange = (dateStr, range) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= range.start && d <= range.end;
  };

  const fetchMyReviews = async () => {
    try {
      const res = await axios.get('http://localhost:3000/review/my', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setMyReviews(res.data?.data || []);
    } catch (_) {
      setMyReviews([]);
    }
  };

  // Updated status colors for better readability on blurred bg
  const getKpiStatus = (progress, target) => {
    const tgt = typeof target === 'number' && target > 0 ? target : 100;
    const pctOfTarget = (Number(progress || 0) / tgt) * 100;
    if (pctOfTarget >= 100) return { label: 'Completed', color: 'bg-green-500/30 text-green-200' };
    if (pctOfTarget < 70) return { label: 'Pending', color: 'bg-yellow-500/30 text-yellow-200' };
    return { label: 'Achieved', color: 'bg-emerald-500/30 text-emerald-200' };
  };

  const fetchTeamMembers = async () => {
    try {
      if (userDept) {
        const response = await axios.get(`http://localhost:3000/users/department/${userDept}/employees`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        setTeamMembers(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchDepartmentKRAs = async () => {
    try {
      if (userDept) {
        const response = await axios.get(`http://localhost:3000/kra/department/${userDept}`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        let list = response.data.data || [];
        const me = (getUserName() || '').toLowerCase();
        const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim().replace(/\s*department\s*$/,'');
        const deptNorm = norm(userDept);
        // If API returned nothing or mismatched depts, fallback to all and filter client-side
        if (!list.length) {
          try {
            const all = await axios.get('http://localhost:3000/kra', { headers: { Authorization: `Bearer ${getToken()}` } });
            const payload = Array.isArray(all.data) ? all.data : (all.data?.data || []);
            list = payload.filter(k => norm(k.dept) === deptNorm);
          } catch (_) { /* ignore */ }
        }
        // Compute both views per requirements
        const managerOwned = list.filter(k => String(k.created_by || '').toLowerCase() === me);
        const assignedToManager = list.filter(k => String(k.manager_name || '').toLowerCase() === me);
        // Team: manager-created and employee assigned
        const teamAssigned = managerOwned.filter(k => !!k.employee_name);
        setDepartmentKRAs(teamAssigned);
        // KRAs tab (My KRAs): assigned to this manager (manager_name == me)
        setMyKras(assignedToManager);
        // Populate Tasks KPIs from KRAs assigned to this manager
        fetchMyKPIsFromKras(assignedToManager.map(k => k.kra_id), assignedToManager);
        const ids = teamAssigned.map(k => k.kra_id);
        if (ids.length) fetchDeptKraAggregates(ids);
      }
    } catch (error) {
      console.error('Error fetching department KRAs:', error);
    }
  };

  const fetchDeptKraAggregates = async (kraIds) => {
    try {
      const token = getToken();
      const results = await Promise.all(
        kraIds.map(async (id) => {
          try {
            const res = await axios.get(`http://localhost:3000/scoring/kra/${id}/aggregate`, { headers: { Authorization: `Bearer ${token}` } });
            return { id, pct: res.data?.data?.percentage ?? 0 };
          } catch (_) {
            return { id, pct: 0 };
          }
        })
      );
      const map = {};
      results.forEach(r => { map[r.id] = r.pct; });
      setDeptKraAggregates(map);
    } catch (_) {}
  };

  // When My KRAs (assigned to this manager) change, refresh KPIs for those KRAs for the Tasks tab
  useEffect(() => {
    if (!myKras || !myKras.length) return;
    fetchMyKPIsFromKras(myKras.map(k => k.kra_id), myKras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myKras]);

  const fetchMyKPIs = async () => {
    try {
      const token = getToken();
      // Default initial (may be overridden by departmentKRAs effect)
      const res = await axios.get('http://localhost:3000/kpi/available', { headers: { Authorization: `Bearer ${token}` } });
      const kras = res.data?.data || [];
      await fetchMyKPIsFromKras(kras.map(k=>k.kra_id), kras);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    }
  };

  const fetchMyKPIsFromKras = async (kraIds, kraObjectsOptional) => {
    try {
      const token = getToken();
      const allKpis = (
        await Promise.all(
          kraIds.map(async (kraId) => {
            try {
              const res = await axios.get(`http://localhost:3000/scoring/kra/${kraId}`, { headers: { Authorization: `Bearer ${token}` } });
              const list = res.data?.data || [];
              // Find kra name if provided
              const kobj = (kraObjectsOptional||[]).find?.(x=>String(x.kra_id)===String(kraId)) || departmentKRAs.find(x=>String(x.kra_id)===String(kraId)) || {};
              return list.map((i) => ({
                id: i.id,
                name: i.name,
                progress: typeof i.percentage === 'number' ? i.percentage : 0,
                kra_id: kraId,
                kra_name: i.kra_name || kobj.name,
                due_date: i.due_date,
                created_at: i.created_at || i.createdAt || i.createdDate || i.date_created,
                target: i.target,
                scoring_method: i.scoring_method,
                created_by: i.created_by,
              }));
            } catch (_) {
              return [];
            }
          })
        )
      ).flat();
      setMyKPIs(allKpis);
    } catch (_) { /* ignore */ }
  };

  const handleCreateKRA = () => {
    window.location.href = '/kracreation';
  };

  const handleAssignKPI = (employeeId) => {
    console.log(`Assign KPI to employee ${employeeId}`);
  };

  const handleViewKRA = (kraId) => {
    openKraModal(kraId);
  };

  const loadReviewKra = async (kraId) => {
    if (!kraId) { setRevKpis([]); return; }
    try {
      setRevLoading(true);
      const res = await axios.get(`http://localhost:3000/scoring/kra/${kraId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const list = res.data?.data || [];
      // Keep raw for filtering per employee later (by created_by if available)
      setRevKpis(list);
    } catch (_) {
      setRevKpis([]);
    } finally {
      setRevLoading(false);
    }
  };

  const submitReview = async () => {
    try {
      if (!revKraId || !revEmployeeId || revScore === '') return;
      const kra = departmentKRAs.find(k => String(k.kra_id) === String(revKraId)) || myKras.find(k => String(k.kra_id) === String(revKraId)) || {};
      const emp = teamMembers.find(e => String(e.user_id) === String(revEmployeeId));
      if (!emp) return;
      await axios.post('http://localhost:3000/review', {
        employee_id: Number(emp.user_id),
        employee_name: emp.name,
        dept: userDept || null,
        role: 'Employee',
        kra_name: kra.name || '',
        kra_id: Number(revKraId),
        score: Number(revScore),
        comment: revComment || null,
        review_at: new Date().toISOString(),
      }, { headers: { Authorization: `Bearer ${getToken()}` } });
      // reset inputs after success
      setRevScore('');
      setRevComment('');
      // refresh my reviews list below
      fetchMyReviews();
    } catch (e) {
      // ignore for now
    }
  };

  // Open edit modal for a review row
  const openEditReview = (r) => {
    setRevEditForm({ id: r.id, score: String(r.score ?? ''), comment: r.comment || '', review_at: r.review_at ? String(r.review_at).substring(0,10) : '' });
    setRevEditOpen(true);
  };

  // Submit edited review
  const submitEditReview = async () => {
    try {
      await axios.post(`http://localhost:3000/review/${revEditForm.id}`, {
        score: revEditForm.score === '' ? undefined : Number(revEditForm.score),
        comment: revEditForm.comment || undefined,
        review_at: revEditForm.review_at || undefined,
      }, { headers: { Authorization: `Bearer ${getToken()}` } });
      setRevEditOpen(false);
      fetchMyReviews();
    } catch (_) {
      setRevEditOpen(false);
    }
  };

  const openKraModal = async (kraId, showSubmit = false) => {
    try {
      setKraModalLoading(true);
      setKraModalOpen(true);
      setKraModalShowSubmit(!!showSubmit);
      const token = getToken();
      const [listRes, aggRes] = await Promise.all([
        axios.get(`http://localhost:3000/scoring/kra/${kraId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:3000/scoring/kra/${kraId}/aggregate`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const itemsRaw = listRes.data?.data || [];
      // Show only Active KPIs in the modal
      const today = new Date(); today.setHours(0,0,0,0);
      const items = itemsRaw.filter(i => {
        if (i.kpi_status) return String(i.kpi_status).toLowerCase() === 'active';
        return !i.due_date || new Date(i.due_date) >= today;
      });
      setKraModalKpis(items.map(i => ({
        ...i,
        _score: typeof i.score === 'number' ? i.score : '',
        _comments: i.comments || '',
      })));
      setKraModalAgg(aggRes.data?.data?.percentage ?? 0);
    } catch (e) {
      // ignore
    } finally {
      setKraModalLoading(false);
    }
  };

  const openScoreModal = async (kpi) => {
    try {
      setScoreModalKpi(kpi);
      setScoreModalValue('0');
      setScoreModalComments('');
      const token = getToken();
      const res = await axios.get(`http://localhost:3000/scoring/kpi/${kpi.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data?.data;
      if (data) {
        setScoreModalValue(typeof data.score === 'number' ? String(data.score) : '0');
        setScoreModalComments(data.comments || '');
      }
      setScoreModalOpen(true);
    } catch (_) {
      setScoreModalOpen(true);
    }
  };

  const submitScoreModal = async () => {
    if (!scoreModalKpi) return;
    try {
      const token = getToken();
      await axios.post('http://localhost:3000/scoring/add', {
        kpi_id: scoreModalKpi.id,
        score: Number(scoreModalValue),
        comments: scoreModalComments || undefined,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setScoreModalOpen(false);
      fetchMyKPIs();
    } catch (e) {
      if (e?.response?.status === 401) {
        logoutAndRedirect();
        return;
      }
      setScoreModalOpen(false);
    }
  };

  const renderScoreInput = () => {
    const method = (scoreModalKpi?.scoring_method || 'Percentage');
    if (method === 'Percentage') {
      return (
        <div className="flex items-center gap-3">
          <input className="flex-1" type="range" min="0" max="100" value={Number(scoreModalValue) || 0} onChange={(e) => setScoreModalValue(String(e.target.value))} />
          <span className="w-12 text-right text-sm text-white/90">{`${Number(scoreModalValue) || 0}%`}</span>
        </div>
      );
    }
    if (method === 'Scale (1-5)') {
      const max = 5;
      const valNum = Number(scoreModalValue) || 0;
      return (
        <div className="flex items-center gap-2">
          {Array.from({ length: max }).map((_, idx) => {
            const v = idx + 1;
            const active = v <= valNum;
            return (
              <button key={v} type="button" onClick={() => setScoreModalValue(String(v))} className={`px-2 py-1 rounded border transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/20 text-white/90 border-white/50 hover:bg-white/30'}`}>{v}</button>
            );
          })}
          <span className="ml-2 text-sm text-white/90">{valNum} / {max}</span>
        </div>
      );
    }
    if (method === 'Scale (1-10)') {
      const max = 10;
      const valNum = Number(scoreModalValue) || 0;
      return (
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: max }).map((_, idx) => {
            const v = idx + 1;
            const active = v <= valNum;
            return (
              <button key={v} type="button" onClick={() => setScoreModalValue(String(v))} className={`px-2 py-1 rounded border transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/20 text-white/90 border-white/50 hover:bg-white/30'}`}>{v}</button>
            );
          })}
          <span className="ml-2 text-sm text-white/90">{valNum} / {max}</span>
        </div>
      );
    }
    if (method === 'Rating') {
      const max = 5;
      const valNum = Number(scoreModalValue) || 0;
      return (
        <div className="flex items-center gap-2">
          {Array.from({ length: max }).map((_, idx) => {
            const v = idx + 1;
            const active = v <= valNum;
            return (
              <button key={v} type="button" onClick={() => setScoreModalValue(String(v))} className={`text-4xl transition-colors ${active ? 'text-yellow-400' : 'text-gray-500 hover:text-gray-400'} `} title={`${v}`}>
                ★
              </button>
            );
          })}
          <span className="ml-1 text-sm text-white/90">{valNum} / {max}</span>
        </div>
      );
    }
    // Default fallback
    return (
      <div className="flex items-center gap-3">
        <input className="flex-1" type="range" min="0" max="100" value={Number(scoreModalValue) || 0} onChange={(e) => setScoreModalValue(String(e.target.value))} />
        <span className="w-12 text-right text-sm text-white/90">{`${Number(scoreModalValue) || 0}%`}</span>
      </div>
    );
  };

  const openEditModal = (kpi) => {
    setEditForm({
      id: kpi.id,
      name: kpi.name || '',
      def: kpi.def || '',
      due_date: kpi.due_date ? String(kpi.due_date).substring(0, 10) : '',
      target: typeof kpi.target === 'number' ? String(kpi.target) : '',
      scoring_method: kpi.scoring_method || '',
    });
    setEditModalOpen(true);
  };

  const submitEditModal = async () => {
    try {
      const token = getToken();
      await axios.put(`http://localhost:3000/kpi/${editForm.id}`, {
        name: editForm.name,
        def: editForm.def,
        due_date: editForm.due_date,
        target: editForm.target === '' ? null : Number(editForm.target),
        scoring_method: editForm.scoring_method,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEditModalOpen(false);
      fetchMyKPIs();
    } catch (_) {
      setEditModalOpen(false);
    }
  };

  const removeKpi = async (kpiId) => {
    try {
      if (!window.confirm('Send a deletion request for this KPI to the Admin?')) return;
      const token = getToken();
      await axios.post('http://localhost:3000/requests/kpi-change', {
        kpi_id: Number(kpiId),
        action: 'delete',
        requested_changes: {},
        request_comment: 'Manager requested KPI deletion'
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Deletion request sent to Admin.');
      fetchMyKPIs();
    } catch (_) {}
  };

  // Updated link color for readability
  const renderCommentHtml = (text) => {
    if (!text) return '';
    const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const esc = escapeHtml(String(text));
    const withMd = esc.replace(/\[(.+?)\]\s*\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
      const safeLabel = label;
      const safeUrl = url;
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 underline">${safeLabel}</a>`;
    });
    return withMd.replace(/(?<![\w"'=])(https?:\/\/[^\s)]+)(?![^<]*>)/g, (m, url) => {
      const safeUrl = url;
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 underline">${safeUrl}</a>`;
    });
  };

  // Link modal state (manager)
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTarget, setLinkTarget] = useState(null); // 'review' | 'score'

  const openLinkModal = (target) => {
    setLinkTarget(target);
    setLinkName('');
    setLinkUrl('');
    setLinkModalOpen(true);
  };
  const closeLinkModal = () => setLinkModalOpen(false);
  const confirmLinkModal = () => {
    if (!/^https?:\/\//i.test(linkUrl)) return;
    const snippet = linkName ? ` [${linkName}](${linkUrl})` : ` ${linkUrl}`;
    if (linkTarget === 'review') setRevComment((prev)=> (prev ?? '') + snippet);
    if (linkTarget === 'score') setScoreModalComments((prev)=> (prev ?? '') + snippet);
    setLinkModalOpen(false);
  };

  if (!userName) {
    // Loading state with background
    return (
      <div
        className="min-h-screen w-full bg-cover bg-center bg-fixed text-white"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-2xl font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  // Chart options templates for light-on-dark
  const lightOnDarkOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false, labels: { color: '#e5e7eb' } },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#e5e7eb',
        bodyColor: '#d1d5db',
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#e5e7eb' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#e5e7eb' },
        suggestedMin: 0,
      },
    },
    animation: { duration: 0 }
  };
  
  const lightOnDarkPieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: '#e5e7eb' } },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#e5e7eb',
        bodyColor: '#d1d5db',
      }
    },
    animation: { duration: 0 }
  };


  const sections = {
    overview: (
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-white mb-2 sm:mb-0">Overview</h3>
          <div className="relative">
            <button className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500 disabled:opacity-50" disabled={exporting} onClick={()=>setExpAllOpen(v=>!v)}>{exporting? 'Exporting...' : 'Export'}</button>
            {expAllOpen && (
              <div className="absolute right-0 mt-1 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                <button className="block w-full text-left px-3 py-2 text-white hover:bg-gray-700" onClick={()=>{ setExpAllOpen(false); exportAllCharts('pdf'); }}>PDF</button>
                <button className="block w-full text-left px-3 py-2 text-white hover:bg-gray-700" onClick={()=>{ setExpAllOpen(false); exportAllCharts('png'); }}>PNG</button>
                <button className="block w-full text-left px-3 py-2 text-white hover:bg-gray-700" onClick={()=>{ setExpAllOpen(false); exportAllCharts('jpg'); }}>JPG</button>
              </div>
            )}
          </div>
        </div>
        {/* Manager Trend Analysis (first in overview) */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 md:p-5 shadow-lg border border-white/20 relative overflow-hidden mb-6">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(1000px 400px at 20% -10%, rgba(0,255,255,0.10), transparent), radial-gradient(800px 300px at 120% 20%, rgba(0,128,255,0.12), transparent), radial-gradient(1000px 500px at 50% 120%, rgba(0,255,128,0.08), transparent)' }} />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
            <div>
              <div className="text-sm text-cyan-200">Trend Analysis</div>
              <div className="text-white text-lg font-semibold">My Performance — {trendYear}</div>
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <input type="number" className="p-1.5 rounded bg-white/10 text-white w-24 border border-white/30 focus:ring-2 focus:ring-cyan-400 focus:outline-none" value={trendYear} onChange={(e)=>setTrendYear(Number(e.target.value)||new Date().getFullYear())} />
              <div className={`text-sm font-semibold ${mgrTrendDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{mgrTrendDelta >= 0 ? '▲' : '▼'} {Math.abs(mgrTrendDelta)}</div>
            </div>
          </div>
          <div className="relative h-56 md:h-64">
            {(() => {
              const fallbackLabels = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'short' }));
              const labels = (mgrTrend.labels && mgrTrend.labels.length) ? mgrTrend.labels : fallbackLabels;
              const values = (mgrTrend.values && mgrTrend.values.length) ? mgrTrend.values : Array.from({ length: 12 }, () => 0);
              return (
                <Line
                  data={{
                    labels,
                    datasets: [{
                      label: 'Avg %',
                      data: values,
                      fill: true,
                      borderWidth: 2,
                      pointRadius: 3,
                      pointHoverRadius: 5,
                      tension: 0.35,
                      segment: {
                        borderColor: ctx => {
                          const a = ctx?.p0?.parsed?.y; const b = ctx?.p1?.parsed?.y; if (typeof a !== 'number' || typeof b !== 'number') return '#60a5fa';
                          return b >= a ? '#22c55e' : '#ef4444';
                        },
                        backgroundColor: ctx => {
                          const a = ctx?.p0?.parsed?.y; const b = ctx?.p1?.parsed?.y; const base = b >= a ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.14)';
                          return base;
                        }
                      },
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index', backgroundColor: '#1f2937' } },
                    scales: {
                      x: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#cbd5e1' } },
                      y: { suggestedMin: 0, suggestedMax: 100, grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#cbd5e1' } }
                    },
                    animation: { duration: 0 }
                  }}
                />
              );
            })()}
          </div>
        </div>

        {/* Manager KRA Performance (Reviews) */}
        <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 rounded-lg shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
            <h4 className="font-medium text-white mb-2 sm:mb-0">Manager KRA Performance (Reviews)</h4>
            <div className="flex items-center gap-2">
              <input type="number" className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 w-24" value={perfFilter.year} onChange={(e)=>setPerfFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
              <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={perfFilter.month} onChange={(e)=>setPerfFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {perfKraSeries.labels.length ? (
            <div className="h-56">
              <Bar
                data={{
                  labels: perfKraSeries.labels,
                  datasets:[{ label: 'Avg Score', data: perfKraSeries.values, backgroundColor:'rgba(165, 180, 252, 0.3)', borderColor:'#a5b4fc', borderWidth: 1 }]
                }}
                options={lightOnDarkOptions}
              />
            </div>
          ) : (
            <div className="text-white/70">No reviews for the selected month.</div>
          )}
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: KRA score (assigned to manager) overall from active KPIs created by manager; default Bar */}
          <div id="mgr-kras-wrap" className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 rounded-lg shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
              <h4 className="font-medium text-white mb-2 sm:mb-0">KRA Scores (Assigned to Me)</h4>
              <div className="flex items-center gap-2 relative">
                <button className="px-3 py-2 rounded bg-gray-800/70 text-white text-sm" onClick={()=>setExp1Open((v)=>!v)}>Export</button>
                {exp1Open && (
                  <div className="absolute right-0 top-10 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp1Open(false); exportChartFromRef(ovB1Ref,'kra_assigned','png'); }}>PNG</button>
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp1Open(false); exportChartFromRef(ovB1Ref,'kra_assigned','jpg'); }}>JPG</button>
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp1Open(false); exportChartFromRef(ovB1Ref,'kra_assigned','pdf'); }}>PDF</button>
                  </div>
                )}
                <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={ovB1Type} onChange={(e)=>setOvB1Type(e.target.value)}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
              </div>
            </div>
            {(()=>{
              const me = String(userName||'').toLowerCase();
              const today = new Date(); today.setHours(0,0,0,0);
              let assignedKras = (departmentKRAs||[]).filter(k => String(k.manager_name||'').toLowerCase() === me);
              if (!assignedKras.length) {
                // Fallback: derive KRA set from manager-created KPIs
                const mine = (myKPIs||[]).filter(i=> String(i.created_by||'').toLowerCase()===me);
                const kraIds = Array.from(new Set(mine.map(i=> String(i.kra_id))));
                assignedKras = kraIds.map(id=> (departmentKRAs||[]).find(k=> String(k.kra_id)===id) || { kra_id:id, name:`KRA ${id}` });
              }
              const labels = assignedKras.map(k=> resolveKraName(k.kra_id));
              const values = assignedKras.map(k=>{
                const kpis = (myKPIs||[]).filter(i=> String(i.kra_id)===String(k.kra_id));
                const mine = kpis.filter(i=> String(i.created_by||'').toLowerCase()===me);
                const base = mine.length? mine: kpis;
                const active = base.filter(i=> !i.due_date || new Date(i.due_date) >= today || String(i.kpi_status||'').toLowerCase()==='active');
                const arr = active.map(i=> typeof i.percentage==='number'? i.percentage : (typeof i.progress==='number'? i.progress:0));
                if (!arr.length) return 0; return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
              });
              if (!labels.length) return (<div className="text-white/70 h-56 flex items-center justify-center">No KRAs available from your KPIs.</div>);
              if (ovB1Type==='line') return (<div className="h-56"><Line ref={ovB1Ref} data={{ labels, datasets:[{ label:'Overall %', data: values, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.3)', fill: true }] }} options={lightOnDarkOptions} /></div>);
              if (ovB1Type==='bar') return (<div className="h-56"><Bar ref={ovB1Ref} data={{ labels, datasets:[{ label:'Overall %', data: values, backgroundColor:'rgba(59,130,246,0.5)', borderColor:'#3b82f6', borderWidth: 1 }] }} options={lightOnDarkOptions} /></div>);
              return (<div className="h-56"><Pie ref={ovB1Ref} data={{ labels, datasets:[{ label:'Overall %', data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*57)%360} 70% 65%)`) }] }} options={lightOnDarkPieOptions} /></div>);
            })()}
          </div>

          {/* Chart 2: KPI scores for selected KRA (active only); default Pie */}
          <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 rounded-lg shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
              <h4 className="font-medium text-white mb-2 sm:mb-0">KPI Scores (Selected KRA)</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={ovB2KraId} onChange={(e)=>setOvB2KraId(e.target.value)}>
                  <option value="">All (Assigned KRAs)</option>
                  {(() => {
                    const byManager = (departmentKRAs||[]).filter(k=> String(k.manager_name||'').toLowerCase()===String(userName||'').toLowerCase());
                    const source = byManager.length ? byManager : (myKras?.length ? myKras : departmentKRAs);
                    return (source||[]).map(k=> (
                    <option key={k.kra_id} value={k.kra_id}>{k.name}</option>
                    ));
                  })()}
                </select>
                <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={ovB2Type} onChange={(e)=>setOvB2Type(e.target.value)}>
                  <option value="pie">Pie</option>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                </select>
                <div className="relative">
                  <button className="px-3 py-2 rounded bg-gray-800/70 text-white text-sm" onClick={()=>setExp2Open(v=>!v)}>Export</button>
                  {exp2Open && (
                    <div className="absolute right-0 top-10 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                      <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp2Open(false); exportChartFromRef(ovB2Ref,'kpi_selected_kra','png'); }}>PNG</button>
                      <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp2Open(false); exportChartFromRef(ovB2Ref,'kpi_selected_kra','jpg'); }}>JPG</button>
                      <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp2Open(false); exportChartFromRef(ovB2Ref,'kpi_selected_kra','pdf'); }}>PDF</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(()=>{
              const today = new Date(); today.setHours(0,0,0,0);
              const me = String(userName||'').toLowerCase();
              let list = [];
              if (!ovB2KraId) {
                // default to all: all manager-created KPIs (assigned KRAs implicitly)
                list = (myKPIs||[]).filter(i=> String(i.created_by||'').toLowerCase()===me);
              } else {
                list = (myKPIs||[]).filter(i=> String(i.kra_id)===String(ovB2KraId));
              }
              const active = list.filter(i=> !i.due_date || new Date(i.due_date) >= today || String(i.kpi_status||'').toLowerCase()==='active');
              const labels = active.map(i=> i.name);
              const values = active.map(i=> (typeof i.percentage==='number'? i.percentage : (typeof i.progress==='number'? i.progress:0)));
              if (!labels.length) return (<div className="text-white/70 h-56 flex items-center justify-center">No active KPIs to show.</div>);
              if (ovB2Type==='line') return (<div className="h-56"><Line ref={ovB2Ref} data={{ labels, datasets:[{ label:'Score', data: values, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.3)', fill: true }] }} options={lightOnDarkOptions} /></div>);
              if (ovB2Type==='bar') return (<div className="h-56"><Bar ref={ovB2Ref} data={{ labels, datasets:[{ label:'Score', data: values, backgroundColor:'rgba(16,185,129,0.5)', borderColor:'#10b981', borderWidth: 1 }] }} options={lightOnDarkOptions} /></div>);
              return (<div className="h-56"><Pie ref={ovB2Ref} data={{ labels, datasets:[{ label:'Score', data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*71)%360} 70% 65%)`) }] }} options={lightOnDarkPieOptions} /></div>);
            })()}
          </div>

          {/* Chart 3: KRA with frequency filter (manager's KRAs), default Bar */}
          <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 rounded-lg shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
              <h4 className="font-medium text-white mb-2 sm:mb-0">KRA Scores (by Frequency)</h4>
              <div className="flex items-center gap-2 relative">
                <button className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={()=>setOvB3FilterOpen(true)}>Filter</button>
                <button className="px-3 py-2 rounded bg-gray-800/70 text-white text-sm" onClick={()=>setExp3Open(v=>!v)}>Export</button>
                {exp3Open && (
                  <div className="absolute right-0 top-10 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp3Open(false); exportChartFromRef(ovB3Ref,'kra_frequency','png'); }}>PNG</button>
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp3Open(false); exportChartFromRef(ovB3Ref,'kra_frequency','jpg'); }}>JPG</button>
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp3Open(false); exportChartFromRef(ovB3Ref,'kra_frequency','pdf'); }}>PDF</button>
                  </div>
                )}
                <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={ovB3Type} onChange={(e)=>setOvB3Type(e.target.value)}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
              </div>
            </div>
            {(()=>{
              const me = String(userName||'').toLowerCase();
              const range = makeRange(ovB3Filter);
              // Build from all KPIs that belong to KRAs assigned to me (not just created_by me)
              const myKraIds = new Set((departmentKRAs||[])
                .filter(k=> String(k.manager_name||'').toLowerCase()===me)
                .map(k=> String(k.kra_id)));
              let pool = (myKPIs||[]).filter(i=> myKraIds.size? myKraIds.has(String(i.kra_id)) : true);
              const inRangeKpis = pool.filter(i=>{
                const createdAt = normalizeDate(i.created_at || i.createdAt || i.createdDate || i.date_created);
                const due = normalizeDate(i.due_date || i.dueDate || i.deadline || i.due);
                if (ovB3Basis === 'created') return isInRange(createdAt, range);
                if (ovB3Basis === 'due') return isInRange(due, range);
                return isInRange(createdAt, range) && isInRange(due, range);
              });
              const byKra = new Map();
              for (const kpi of inRangeKpis) {
                const key = String(kpi.kra_id);
                const val = typeof kpi.percentage==='number'? kpi.percentage : (typeof kpi.progress==='number'? kpi.progress:0);
                const arr = byKra.get(key) || [];
                arr.push(val); byKra.set(key, arr);
              }
              let labels = Array.from(byKra.keys()).map(id=> resolveKraName(id));
              let values = Array.from(byKra.values()).map(arr=> arr.length? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0);
              if (!labels.length) { labels = ['No Data']; values = [0]; }
              if (ovB3Type==='line') return (<div className="h-56"><Line ref={ovB3Ref} data={{ labels, datasets:[{ label:'Overall %', data: values, borderColor:'#6366f1', backgroundColor:'rgba(99,102,241,0.3)', fill: true }] }} options={lightOnDarkOptions} /></div>);
              if (ovB3Type==='bar') return (<div className="h-56"><Bar ref={ovB3Ref} data={{ labels, datasets:[{ label:'Overall %', data: values, backgroundColor:'rgba(99,102,241,0.5)', borderColor:'#6366f1', borderWidth: 1 }] }} options={lightOnDarkOptions} /></div>);
              return (<div className="h-56"><Pie ref={ovB3Ref} data={{ labels, datasets:[{ label:'Overall %', data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*83)%360} 70% 65%)`) }] }} options={lightOnDarkPieOptions} /></div>);
            })()}
          </div>

          {/* Chart 4: KPI with frequency filter + basis (created/due/both), default Bar */}
          <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 rounded-lg shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
              <h4 className="font-medium text-white mb-2 sm:mb-0">KPI Scores (by Frequency)</h4>
              <div className="flex items-center gap-2 relative">
                <button className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={()=>setOvB4FilterOpen(true)}>Filter</button>
                <button className="px-3 py-2 rounded bg-gray-800/70 text-white text-sm" onClick={()=>setExp4Open(v=>!v)}>Export</button>
                {exp4Open && (
                  <div className="absolute right-0 top-10 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp4Open(false); exportChartFromRef(ovB4Ref,'kpi_frequency','png'); }}>PNG</button>
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp4Open(false); exportChartFromRef(ovB4Ref,'kpi_frequency','jpg'); }}>JPG</button>
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp4Open(false); exportChartFromRef(ovB4Ref,'kpi_frequency','pdf'); }}>PDF</button>
                  </div>
                )}
                <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={ovB4Type} onChange={(e)=>setOvB4Type(e.target.value)}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
              </div>
            </div>
            {(()=>{
              const range = makeRange(ovB4Filter);
              const me = String(userName||'').toLowerCase();
              const myKraIds = new Set((departmentKRAs||[])
                .filter(k=> String(k.manager_name||'').toLowerCase()===me)
                .map(k=> String(k.kra_id)));
              const list = (myKPIs||[]).filter(i=> myKraIds.size? myKraIds.has(String(i.kra_id)) : true);
              const filtered = list.filter(i=>{
                const createdAt = normalizeDate(i.created_at || i.createdAt || i.createdDate || i.date_created);
                const due = normalizeDate(i.due_date || i.dueDate || i.deadline || i.due);
                if (ovB4Basis==='created') return isInRange(createdAt, range);
                if (ovB4Basis==='due') return isInRange(due, range);
                return isInRange(createdAt, range) && isInRange(due, range);
              });
              let labels = filtered.map(i=> i.name);
              let values = filtered.map(i=> (typeof i.percentage==='number'? i.percentage : (typeof i.progress==='number'? i.progress:0)));
              if (!labels.length) { labels = ['No Data']; values = [0]; }
              if (ovB4Type==='line') return (<div className="h-56"><Line ref={ovB4Ref} data={{ labels, datasets:[{ label:'Score', data: values, borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.3)', fill: true }] }} options={lightOnDarkOptions} /></div>);
              if (ovB4Type==='bar') return (<div className="h-56"><Bar ref={ovB4Ref} data={{ labels, datasets:[{ label:'Score', data: values, backgroundColor:'rgba(245,158,11,0.5)', borderColor:'#f59e0b', borderWidth: 1 }] }} options={lightOnDarkOptions} /></div>);
              return (<div className="h-56"><Pie ref={ovB4Ref} data={{ labels, datasets:[{ label:'Score', data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*103)%360} 70% 65%)`) }] }} options={lightOnDarkPieOptions} /></div>);
            })()}
          </div>

          {/* Chart 5: Two charts side-by-side with frequency + basis */}
          <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 rounded-lg shadow-lg lg:col-span-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
              <h4 className="font-medium text-white mb-2 sm:mb-0">KRA and KPI by Frequency</h4>
              <div className="flex items-center gap-2 relative">
                <button className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={()=>setOvB5FilterOpen(true)}>Filter</button>
                <button className="px-3 py-2 rounded bg-gray-800/70 text-white text-sm" onClick={()=>setExp5Open(v=>!v)}>Export</button>
                {exp5Open && (
                  <div className="absolute right-0 top-10 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp5Open(false); exportChartFromRef(ovB5KraRef,'kra_by_frequency','png'); exportChartFromRef(ovB5KpiRef,'kpi_by_frequency','png'); }}>PNG</button>
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp5Open(false); exportChartFromRef(ovB5KraRef,'kra_by_frequency','jpg'); exportChartFromRef(ovB5KpiRef,'kpi_by_frequency','jpg'); }}>JPG</button>
                    <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExp5Open(false); const pdf = new jsPDF('p','mm','a4'); const w = pdf.internal.pageSize.getWidth(); const h = w*0.6; const img1 = (ovB5KraRef.current && ovB5KraRef.current.toBase64Image('image/png',1)); if(img1){ pdf.text('kra_by_frequency',10,10); pdf.addImage(img1,'PNG',10,20,w-20,h);} const img2 = (ovB5KpiRef.current && ovB5KpiRef.current.toBase64Image('image/png',1)); if(img2){ pdf.addPage(); pdf.text('kpi_by_frequency',10,10); pdf.addImage(img2,'PNG',10,20,w-20,h);} pdf.save('kra_kpi_by_frequency.pdf'); }}>PDF</button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* KRA chart */}
              <div>
                <div className="flex items-center justify-end mb-2">
                  <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={ovB5TypeKra} onChange={(e)=>setOvB5TypeKra(e.target.value)}>
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="pie">Pie</option>
                  </select>
                </div>
                {(()=>{
                  const me = String(userName||'').toLowerCase();
                  const range = makeRange(ovB5Filter);
                  const myKraIds = new Set((departmentKRAs||[])
                    .filter(k=> String(k.manager_name||'').toLowerCase()===me)
                    .map(k=> String(k.kra_id)));
                  const pool = (myKPIs||[]).filter(i=> myKraIds.size? myKraIds.has(String(i.kra_id)) : true);
                  const filtered = pool.filter(i=>{
                    const createdAt = normalizeDate(i.created_at || i.createdAt || i.createdDate || i.date_created);
                    const due = normalizeDate(i.due_date || i.dueDate || i.deadline || i.due);
                    if (ovB5Basis==='created') return isInRange(createdAt, range);
                    if (ovB5Basis==='due') return isInRange(due, range);
                    return isInRange(createdAt, range) && isInRange(due, range);
                  });
                  const byKra = new Map();
                  for (const kpi of filtered) {
                    const key = String(kpi.kra_id);
                    const val = typeof kpi.percentage==='number'? kpi.percentage : (typeof kpi.progress==='number'? kpi.progress:0);
                    const arr = byKra.get(key) || [];
                    arr.push(val); byKra.set(key, arr);
                  }
                  let labels = Array.from(byKra.keys()).map(id=> resolveKraName(id));
                  let values = Array.from(byKra.values()).map(arr=> arr.length? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0);
                  if (!labels.length) { labels = ['No Data']; values = [0]; }
                  if (ovB5TypeKra==='line') return (<div className="h-56"><Line ref={ovB5KraRef} data={{ labels, datasets:[{ label:'KRA %', data: values, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.3)', fill: true }] }} options={lightOnDarkOptions} /></div>);
                  if (ovB5TypeKra==='bar') return (<div className="h-56"><Bar ref={ovB5KraRef} data={{ labels, datasets:[{ label:'KRA %', data: values, backgroundColor:'rgba(59,130,246,0.5)', borderColor:'#3b82f6', borderWidth: 1 }] }} options={lightOnDarkOptions} /></div>);
                  return (<div className="h-56"><Pie ref={ovB5KraRef} data={{ labels, datasets:[{ label:'KRA %', data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*41)%360} 70% 65%)`) }] }} options={lightOnDarkPieOptions} /></div>);
                })()}
              </div>
              {/* KPI chart */}
              <div>
                <div className="flex items-center justify-end mb-2">
                  <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={ovB5TypeKpi} onChange={(e)=>setOvB5TypeKpi(e.target.value)}>
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="pie">Pie</option>
                  </select>
                </div>
                {(()=>{
                  const me = String(userName||'').toLowerCase();
                  const range = makeRange(ovB5Filter);
                  const myKraIds2 = new Set((departmentKRAs||[])
                    .filter(k=> String(k.manager_name||'').toLowerCase()===me)
                    .map(k=> String(k.kra_id)));
                  const list = (myKPIs||[]).filter(i=> myKraIds2.size? myKraIds2.has(String(i.kra_id)) : true);
                  const filtered = list.filter(i=>{
                    const createdAt = normalizeDate(i.created_at || i.createdAt || i.createdDate || i.date_created);
                    const due = normalizeDate(i.due_date || i.dueDate || i.deadline || i.due);
                    if (ovB5Basis==='created') return isInRange(createdAt, range);
                    if (ovB5Basis==='due') return isInRange(due, range);
                    return isInRange(createdAt, range) && isInRange(due, range);
                  });
                  let labels = filtered.map(i=> i.name);
                  let values = filtered.map(i=> (typeof i.percentage==='number'? i.percentage : (typeof i.progress==='number'? i.progress:0)));
                  if (!labels.length) { labels = ['No Data']; values = [0]; }
                  if (ovB5TypeKpi==='line') return (<div className="h-56"><Line ref={ovB5KpiRef} data={{ labels, datasets:[{ label:'KPI %', data: values, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.3)', fill: true }] }} options={lightOnDarkOptions} /></div>);
                  if (ovB5TypeKpi==='bar') return (<div className="h-56"><Bar ref={ovB5KpiRef} data={{ labels, datasets:[{ label:'KPI %', data: values, backgroundColor:'rgba(16,185,129,0.5)', borderColor:'#10b981', borderWidth: 1 }] }} options={lightOnDarkOptions} /></div>);
                  return (<div className="h-56"><Pie ref={ovB5KpiRef} data={{ labels, datasets:[{ label:'KPI %', data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*127)%360} 70% 65%)`) }] }} options={lightOnDarkPieOptions} /></div>);
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    comments: (
      <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 md:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
          <h4 className="font-medium text-white text-xl mb-2 sm:mb-0">My Comments</h4>
          <div className="flex items-center gap-2">
            <input type="number" className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 w-24" value={perfFilter.year} onChange={(e)=>setPerfFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
            <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={perfFilter.month} onChange={(e)=>setPerfFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
              {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-3">
          {perfReviews.map((r, idx)=> (
            <div key={idx} className="border border-white/30 bg-black/10 rounded p-3">
              <div className="flex items-center justify-between text-sm text-white/80"><span><span className="font-medium text-white">KRA:</span> {r.kra_name}</span><span>{r.review_at ? new Date(r.review_at).toLocaleDateString() : ''}</span></div>
              <div className="text-sm mt-1 text-white/80"><span className="font-medium text-white">Score:</span> {r.score}</div>
              <div className="text-sm mt-1 text-white/80"><span className="font-medium text-white">Comment:</span> <span dangerouslySetInnerHTML={{ __html: r.comment ? renderCommentHtml(r.comment) : '-' }} /></div>
            </div>
          ))}
          {perfReviews.length===0 && <div className="text-white/70">No comments for this month.</div>}
        </div>
      </div>
    ),
    tasks: (
      <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 md:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white mb-3 md:mb-0">Tasks</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={tasksFilter} onChange={(e)=>setTasksFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="all">All</option>
              <option value="end">End</option>
            </select>
            {(() => {
              const sourceKras = (myKras && myKras.length) ? myKras : departmentKRAs;
              return (
                <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={tasksKraFilter} onChange={(e)=>setTasksKraFilter(e.target.value)}>
                  <option value="">All KRAs</option>
                  {sourceKras.map(k=> (
                    <option key={k.kra_id} value={k.kra_id}>{k.name}</option>
                  ))}
                </select>
              );
            })()}
            <div className="relative">
              <button className="px-3 py-2 rounded bg-gray-800/70 text-white text-sm" onClick={()=>setExpTasksOpen(v=>!v)}>Export</button>
              {expTasksOpen && (
                <div className="absolute right-0 top-10 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                  <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExpTasksOpen(false); exportTableToExcel('#mgr-tasks-table','manager-tasks.xls'); }}>Excel</button>
                  <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExpTasksOpen(false); exportTableToCSV('#mgr-tasks-table','manager-tasks.csv'); }}>CSV</button>
                </div>
              )}
            </div>
            <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={() => navigate('/create_kpi')}>Create KPI</button>
          </div>
        </div>
        <div id="mgr-tasks-wrap" className="overflow-x-auto">
          <table id="mgr-tasks-table" className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-white/30 bg-black/20">
                <th className="text-left p-3 text-white font-semibold">KPI</th>
                <th className="text-left p-3 text-white font-semibold">KRA</th>
                <th className="text-left p-3 text-white font-semibold">Due Date</th>
                <th className="text-left p-3 text-white font-semibold">Score</th>
                <th className="text-left p-3 text-white font-semibold">Target</th>
                <th className="text-left p-3 text-white font-semibold">Status</th>
                <th className="text-left p-3 text-white font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(function(){
                const today = new Date(); today.setHours(0,0,0,0);
                const sourceKras = (myKras && myKras.length) ? myKras : departmentKRAs;
                let allowed = new Set(sourceKras.map(k=>k.kra_id));
                if (tasksKraFilter) {
                  allowed = new Set([Number(tasksKraFilter)]);
                }
                const me = (getUserName() || '').toLowerCase();
                const underAssigned = myKPIs.filter(k => allowed.has(k.kra_id));
                const mine = underAssigned.filter(k => String(k.created_by || '').toLowerCase() === me);
                const base = mine.length ? mine : underAssigned; 
                let list = base;
                if (tasksFilter === 'active') {
                  list = base.filter(k=> !k.due_date || new Date(k.due_date) >= today);
                } else if (tasksFilter === 'end') {
                  list = base.filter(k=> k.due_date && new Date(k.due_date) < today);
                }
                return list;
              })().map((kpi) => (
                <tr key={kpi.id} className="border-b border-white/20">
                  <td className="p-3 font-medium text-white">{kpi.name}</td>
                  <td className="p-3 text-white/90">{kpi.kra_name}</td>
                  <td className="p-3 text-white/90">{kpi.due_date ? new Date(kpi.due_date).toLocaleDateString() : '-'}</td>
                  <td className="p-3 text-white/90">{typeof kpi.progress === 'number' ? `${kpi.progress}%` : '-'}</td>
                  <td className="p-3 text-white/90">{typeof kpi.target === 'number' ? `${kpi.target}%` : '-'}</td>
                  <td className="p-3">
                    {(() => { const s = getKpiStatus(kpi.progress, kpi.target); return <span className={`px-2 py-1 rounded text-xs ${s.color}`}>{s.label}</span>; })()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-3">
                      {(() => { const today = new Date(); today.setHours(0,0,0,0); const overdue = kpi.due_date && new Date(kpi.due_date) < today; return (
                        overdue ? (
                          <button className="text-red-400 hover:text-red-300 text-sm" onClick={() => removeKpi(kpi.id)}>Remove</button>
                        ) : (
                          <>
                            <button className="text-blue-400 hover:text-blue-300 text-sm" onClick={() => openScoreModal(kpi)}>View</button>
                            <button className="text-green-400 hover:text-green-300 text-sm" onClick={() => openEditModal(kpi)}>Edit</button>
                            <button className="text-red-400 hover:text-red-300 text-sm" onClick={() => removeKpi(kpi.id)}>Remove</button>
                          </>
                        )
                      ); })()}
                    </div>
                  </td>
                </tr>
              ))}
              {myKPIs.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-4 text-white/70">No tasks available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    ),
    team: (
      <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 md:p-6 rounded-lg shadow-lg mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white mb-2 sm:mb-0">Team KRAs</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/80">Employee</label>
            <select className="p-2 border border-white/50 rounded bg-white/30 text-gray-900 text-sm" value={teamEmployeeFilter} onChange={(e)=>setTeamEmployeeFilter(e.target.value)}>
              <option value="all">All</option>
              {Array.from(new Set(departmentKRAs.map(k=>k.employee_name).filter(Boolean))).map(name=> (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div className="relative">
              <button className="px-3 py-2 rounded bg-gray-800/70 text-white text-sm" onClick={()=>setExpTeamOpen(v=>!v)}>Export</button>
              {expTeamOpen && (
                <div className="absolute right-0 top-10 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                  <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExpTeamOpen(false); exportTableToExcel('#mgr-team-table','manager-team.xls'); }}>Excel</button>
                  <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{ setExpTeamOpen(false); exportTableToCSV('#mgr-team-table','manager-team.csv'); }}>CSV</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div id="mgr-team-wrap" className="overflow-x-auto">
          <table id="mgr-team-table" className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-white/30 bg-black/20">
                <th className="text-left p-3 text-white font-semibold">Employee</th>
                <th className="text-left p-3 text-white font-semibold">KRA</th>
                <th className="text-left p-3 text-white font-semibold">Score</th>
                <th className="text-left p-3 text-white font-semibold">Status</th>
                <th className="text-left p-3 text-white font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(function(){
                const list = teamEmployeeFilter==='all' ? departmentKRAs : departmentKRAs.filter(k=> String(k.employee_name||'')===String(teamEmployeeFilter));
                return list;
              })().map((kra) => {
                const pct = typeof kra.overall_score === 'number' ? kra.overall_score : (deptKraAggregates[kra.kra_id] ?? 0);
                const target = typeof kra.target === 'number' && kra.target !== null ? kra.target : 100;
                const completed = pct >= target;
                const achieved = !completed && pct >= (0.7 * target);
                const status = completed ? 'Completed' : achieved ? 'Achieved' : 'Pending';
                const colorClass = completed ? 'bg-green-500/30 text-green-200' : achieved ? 'bg-emerald-500/30 text-emerald-200' : 'bg-yellow-500/30 text-yellow-200';
                return (
                  <tr key={kra.kra_id} className="border-b border-white/20">
                    <td className="p-3 font-medium text-white">{kra.employee_name || 'Not Assigned'}</td>
                    <td className="p-3 text-white/90">{kra.name}</td>
                    <td className="p-3 text-white/90">{pct}%</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${colorClass}`}>{status}</span></td>
                    <td className="p-3">
                      <button onClick={() => openKraModal(kra.kra_id)} className="text-blue-400 hover:text-blue-300 text-sm">View</button>
                    </td>
                  </tr>
                );
              })}
              {departmentKRAs.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-4 text-white/70">No KRAs in your department.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    ),
    kras: (
      <div id="mgr-kras-section" className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 md:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white mb-2 sm:mb-0">My KRAs</h3>
          <div className="relative">
            <button className="px-3 py-2 rounded bg-gray-800/70 text-white text-sm" onClick={()=>setExpKrasListOpen(v=>!v)}>Export</button>
            {expKrasListOpen && (
              <div className="absolute right-0 top-10 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow text-sm z-20">
                <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{
                  setExpKrasListOpen(false);
                  const rows = [['KRA','Definition','Due Date','Overall %'], ...myKras.map(k=>[
                    String(k.name||'').replaceAll(',',' '),
                    String(k.definition||k.def||'').replaceAll(',',' '),
                    k.due_date? new Date(k.due_date).toLocaleDateString():'-',
                    typeof k.percentage==='number'? k.percentage : (typeof k.overall==='number'? k.overall: '')
                  ])];
                  const csv = rows.map(r=>r.join(',')).join('\n');
                  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='my-kras.csv'; a.click(); URL.revokeObjectURL(a.href);
                }}>CSV</button>
                <button className="block px-3 py-2 text-white hover:bg-gray-700 w-full text-left" onClick={()=>{
                  setExpKrasListOpen(false);
                  const header = '<thead><tr><th>KRA</th><th>Definition</th><th>Due Date</th><th>Overall %</th></tr></thead>';
                  const body = '<tbody>' + myKras.map(k=>`<tr><td>${k.name||''}</td><td>${k.definition||k.def||''}</td><td>${k.due_date? new Date(k.due_date).toLocaleDateString():'-'}</td><td>${typeof k.percentage==='number'? k.percentage : (typeof k.overall==='number'? k.overall: '')}</td></tr>`).join('') + '</tbody>';
                  const html = `\uFEFF<html><head><meta charset="UTF-8"></head><body><table>${header}${body}</table></body></html>`;
                  const blob = new Blob([html],{type:'application/vnd.ms-excel'});
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='my-kras.xls'; a.click(); URL.revokeObjectURL(a.href);
                }}>Excel</button>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {myKras.map((k) => (
            <div key={k.kra_id} className="border border-white/30 bg-black/10 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold text-lg text-white">{k.name}</h4>
                <span className="bg-blue-500/30 text-blue-200 px-2 py-1 rounded text-xs">Active</span>
              </div>
              <p className="text-sm text-white/80 mt-1">{k.definition || k.def || ''}</p>
              <p className="text-sm text-white/80 mt-1">Overall: {(()=>{
                const today = new Date(); today.setHours(0,0,0,0);
                const arr = (myKPIs||[])
                  .filter(x=> String(x.kra_id)===String(k.kra_id))
                  .filter(x=> !x.due_date || new Date(x.due_date) >= today || String(x.kpi_status||'').toLowerCase()==='active')
                  .map(x=> typeof x.progress==='number'? x.progress : (typeof x.percentage==='number'? x.percentage : 0));
                const overall = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
                return `${overall}%`;
              })()}</p>
              <div className="mt-3 text-right">
                <button onClick={() => openKraModal(k.kra_id, true)} className="text-blue-400 hover:text-blue-300">View Details</button>
              </div>
            </div>
          ))}
          {myKras.length === 0 && (<div className="text-white/70">No KRAs available.</div>)}
        </div>
      </div>
    ),
    
    review: (
      <div className="bg-white/20 backdrop-blur-sm border border-white/30 p-4 md:p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold mb-4 text-white">Add Review</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-white/90">Select Employee</label>
            <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={revEmployeeId} onChange={(e)=>{ setRevEmployeeId(e.target.value); setRevKraId(''); setRevKpis([]); }}>
              <option value="">-- Select --</option>
              {teamMembers.map(m=> <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white/90">Select KRA (Created by me)</label>
            <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={revKraId} onChange={(e)=>{ setRevKraId(e.target.value); loadReviewKra(e.target.value); }}>
              <option value="">-- Select --</option>
              {(function(){
                const me = (getUserName() || '').toLowerCase();
                const emp = teamMembers.find(e=> String(e.user_id)===String(revEmployeeId));
                const empName = emp?.name || '';
                return departmentKRAs
                  .filter(k => String(k.created_by || '').toLowerCase() === me)
                  .filter(k => !empName || String(k.employee_name || '') === empName)
                  .map(k => (
                    <option key={k.kra_id} value={k.kra_id}>{k.name}</option>
                  ));
              })()}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white/90">Score (Percentage)</label>
            <div className="flex items-center gap-2">
              <input type="range" className="flex-1" min="0" max="100" value={revScore===''?0:Number(revScore)} onChange={(e)=>setRevScore(e.target.value)} />
              <span className="w-12 text-right text-sm text-white/90">{revScore||0}%</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium mb-1 text-white/90">Comments</label>
              <button type="button" onClick={() => openLinkModal('review')} className="text-xs text-cyan-400 underline">Insert Link</button>
            </div>
            <textarea
              className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white"
              rows={2}
              value={revComment}
              onChange={(e)=>setRevComment(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end mb-6">
          <button onClick={submitReview} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50" disabled={!revKraId || !revEmployeeId || revScore===''}>Add Review</button>
        </div>
        <div>
          <h4 className="font-semibold mb-2 text-white">KPIs for selected KRA {revEmployeeId? '(Filtered by employee)': ''}</h4>
          {revLoading ? <div className="text-white/80">Loading...</div> : (
            <div className="space-y-3">
              {(function(){
                const emp = teamMembers.find(e=> String(e.user_id)===String(revEmployeeId));
                const list = (!revKraId ? [] : (revKpis||[])).filter(k=>{
                  if (!emp) return true;
                  if (k.created_by) return String(k.created_by).toLowerCase() === String(emp.name||'').toLowerCase();
                  return true;
                });
                return list.map(kpi => (
                  <div key={kpi.id} className="border border-white/30 bg-black/10 rounded p-3">
                    <div className="font-medium text-white">{kpi.name}</div>
                    <div className="text-sm text-white/80">Target: {typeof kpi.target==='number'? `${kpi.target}%` : '-'}</div>
                    <div className="text-sm text-white/80">Achieved: {typeof kpi.percentage==='number'? `${kpi.percentage}%` : '-'}</div>
                    <div className="text-sm text-white/80">Comments: <span dangerouslySetInnerHTML={{ __html: kpi.comments ? renderCommentHtml(kpi.comments) : '-' }} /></div>
                  </div>
                ));
              })()}
              {(!revKpis || !revKpis.length) && !!revKraId && <div className="text-white/70">No KPIs found for this KRA.</div>}
            </div>
          )}
        </div>
        {/* My Reviews (Update) */}
        <div id="manager-myreviews-section" className="mt-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
            <h3 className="text-xl font-semibold text-white mb-2 sm:mb-0">My Reviews</h3>
            <div className="relative">
              <button className="px-3 py-2 border border-white/50 text-white rounded text-sm" onClick={(e)=>{ const m=e.currentTarget.nextSibling; if (m) m.classList.toggle('hidden'); }}>Export</button>
              <div className="absolute right-0 mt-1 bg-gray-800/90 backdrop-blur-md border border-white/30 rounded shadow hidden z-20">
                <button className="block w-full text-left px-3 py-2 text-white hover:bg-gray-700" onClick={()=>exportTableToCSV('#manager-myreviews-table','my-reviews.csv')}>CSV</button>
                <button className="block w-full text-left px-3 py-2 text-white hover:bg-gray-700" onClick={()=>exportTableToExcel('#manager-myreviews-table','my-reviews.xls')}>Excel</button>
                <button className="block w-full text-left px-3 py-2 text-white hover:bg-gray-700" onClick={()=>exportSectionById('manager-myreviews-section','my-reviews','pdf')}>PDF</button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table id="manager-myreviews-table" className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/30 bg-black/20">
                  <th className="text-left p-3 text-white font-semibold">KRA</th>
                  <th className="text-left p-3 text-white font-semibold">Employee</th>
                  <th className="text-left p-3 text-white font-semibold">Score</th>
                  <th className="text-left p-3 text-white font-semibold">Comment</th>
                  <th className="text-left p-3 text-white font-semibold">Reviewed At</th>
                  <th className="text-left p-3 text-white font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {myReviews.map(r => (
                  <tr key={r.id} className="border-b border-white/20">
                    <td className="p-3 text-white/90">{r.kra_name}</td>
                    <td className="p-3 text-white/90">{r.employee_name}</td>
                    <td className="p-3 text-white/90">{r.score}</td>
                    <td className="p-3 text-white/90"><span dangerouslySetInnerHTML={{ __html: r.comment ? renderCommentHtml(r.comment) : '-' }} /></td>
                    <td className="p-3 text-white/90">{r.review_at ? new Date(r.review_at).toLocaleDateString() : '-'}</td>
                    <td className="p-3"><button className="text-blue-400 hover:text-blue-300 text-sm" onClick={()=>openEditReview(r)}>Update</button></td>
                  </tr>
                ))}
                {myReviews.length===0 && (
                  <tr><td className="p-4 text-white/70" colSpan="6">No reviews yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="max-w-7xl mx-auto py-8 px-4">

        {/* Navigation Tabs */}
        <div className="flex gap-1 sm:gap-2 mb-8 flex-wrap border-b border-white/30">
          {Object.keys(sections).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-3 sm:px-4 py-2 rounded-t-lg font-medium text-sm sm:text-base transition-colors ${
                activeSection === section
                  ? 'bg-white text-indigo-700'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        {/* Active Section Content */}
        {sections[activeSection]}
    
        {/* KRA Details Modal */}
        {kraModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-3xl rounded-lg shadow-xl p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">KRA Details</h3>
                <button onClick={() => setKraModalOpen(false)} className="text-white/80 hover:text-white text-2xl font-bold">✕</button>
              </div>
              {kraModalLoading ? (
                <div className="text-white/80">Loading...</div>
              ) : (
                <>
                  <div className="max-h-[70vh] overflow-y-auto pr-2">
                    <div className="text-right mb-2 text-sm text-white/90">Overall: <span className="font-semibold text-cyan-300">{(()=>{
                      const today = new Date(); today.setHours(0,0,0,0);
                      const arr = (kraModalKpis||[])
                        .filter(x=> !x.due_date || new Date(x.due_date) >= today || String(x.kpi_status||'').toLowerCase()==='active')
                        .map(x=> typeof x.percentage==='number'? x.percentage : (typeof x.progress==='number'? x.progress : 0));
                      const overall = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
                      return `${overall}%`;
                    })()}</span></div>
                    
                    <div className="space-y-3">
                      {kraModalKpis.length === 0 && <div className="text-white/70">No KPIs yet.</div>}
                      {kraModalKpis.map(kpi => (
                        <div key={kpi.id} className="border border-white/30 bg-black/10 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium text-white">{kpi.name}</div>
                              <div className="text-sm text-white/80">Due: {kpi.due_date ? new Date(kpi.due_date).toLocaleDateString() : '-'}</div>
                              <div className="text-sm text-white/80">Current: {typeof kpi.percentage === 'number' ? `${kpi.percentage}%` : '-'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button className="px-4 py-2 bg-white/20 border border-white/50 text-white rounded hover:bg-white/30 transition-colors" onClick={() => setKraModalOpen(false)}>Close</button>
                    {kraModalShowSubmit && (
                      <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors" onClick={submitKraModalNotify}>Submit</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {submitToast && (
          <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded shadow z-50">Submitted. Admin notified.</div>
        )}
        
        {/* Score Modal */}
        {scoreModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-lg rounded-lg shadow-xl p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{`Score KPI: ${scoreModalKpi?.name || ''}`}</h3>
                <button onClick={() => setScoreModalOpen(false)} className="text-white/80 hover:text-white text-2xl font-bold">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1 text-white/90">Score</label>
                  {renderScoreInput()}
                </div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm mb-1 text-white/90">Comments</label>
                  <button type="button" onClick={() => openLinkModal('score')} className="text-xs text-cyan-400 underline">Insert Link</button>
                </div>
                <textarea
                  className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white"
                  rows="3"
                  value={scoreModalComments}
                  onChange={(e) => setScoreModalComments(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 bg-white/20 border border-white/50 text-white rounded hover:bg-white/30 transition-colors" onClick={() => setScoreModalOpen(false)}>Cancel</button>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors" onClick={submitScoreModal}>Update</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Insert Link Modal */}
        {linkModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-md rounded-lg shadow-xl p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Insert Link</h3>
                <button onClick={closeLinkModal} className="text-white/80 hover:text-white text-2xl font-bold">✕</button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm mb-1 text-white/90">Link Name</label>
                  <input className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" value={linkName} onChange={(e)=>setLinkName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-white/90">Link URL (https://...)</label>
                  <input className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" value={linkUrl} onChange={(e)=>setLinkUrl(e.target.value)} placeholder="https://example.com" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button className="px-4 py-2 bg-white/20 border border-white/50 text-white rounded hover:bg-white/30 transition-colors" onClick={closeLinkModal}>Cancel</button>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors" onClick={confirmLinkModal} disabled={!linkName || !/^https?:\/\//i.test(linkUrl)}>Insert</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit KPI Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-lg rounded-lg shadow-xl p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Edit KPI</h3>
                <button onClick={() => setEditModalOpen(false)} className="text-white/80 hover:text-white text-2xl font-bold">✕</button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-white/90">Name</label>
                    <input className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" value={editForm.name} onChange={(e)=>setEditForm({...editForm, name:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-white/90">Due Date</label>
                    <input type="date" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" value={editForm.due_date} onChange={(e)=>setEditForm({...editForm, due_date:e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1 text-white/90">Definition</label>
                  <textarea className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" rows="3" value={editForm.def} onChange={(e)=>setEditForm({...editForm, def:e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-white/90">Target (0-100)</label>
                    <input type="number" min="0" max="100" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" value={editForm.target} onChange={(e)=>setEditForm({...editForm, target:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-white/90">Scoring Method</label>
                    <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={editForm.scoring_method} onChange={(e)=>setEditForm({...editForm, scoring_method:e.target.value})}>
                      <option value="Percentage">Percentage</option>
                      <option value="Scale (1-5)">Scale (1-5)</option>
                      <option value="Scale (1-10)">Scale (1-10)</option>
                      <option value="Rating">Rating</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 bg-white/20 border border-white/50 text-white rounded hover:bg-white/30 transition-colors" onClick={() => setEditModalOpen(false)}>Cancel</button>
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors" onClick={submitEditModal}>Update</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Review Modal */}
        {revEditOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 w-full max-w-md rounded-lg shadow-xl p-6 text-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Update Review</h3>
                <button onClick={()=>setRevEditOpen(false)} className="text-white/80 hover:text-white text-2xl font-bold">✕</button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/90">Score (0-100)</label>
                  <input type="number" min="0" max="100" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" value={revEditForm.score} onChange={(e)=>setRevEditForm(prev=>({ ...prev, score: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-white/90">Comment</label>
                  <textarea className="w-full p-2 border border-white/50 rounded bg-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white" rows={3} value={revEditForm.comment} onChange={(e)=>setRevEditForm(prev=>({ ...prev, comment: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={()=>setRevEditOpen(false)} className="px-4 py-2 rounded border border-white/50 text-white hover:bg-white/20 transition-colors">Cancel</button>
                <button onClick={submitEditReview} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Update</button>
              </div>
            </div>
          </div>
        )}

        {/* Chart 3 Filter Modal */}
        {ovB3FilterOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white w-full max-w-lg rounded-lg shadow-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">KRA Frequency Filter</h3>
                <button onClick={()=>setOvB3FilterOpen(false)} className="text-white/80 hover:text-white text-2xl font-bold">✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-white/90">Type</label>
                  <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB3Filter.kind} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, kind:e.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {ovB3Filter.kind==='weekly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Month</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB3Filter.month} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, month:Number(e.target.value) }))}>
                        {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB3Filter.year} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-white/90">Week (1-5)</label>
                      <input type="number" min="1" max="5" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB3Filter.week} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, week:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB3Filter.kind==='monthly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Month</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB3Filter.month} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, month:Number(e.target.value) }))}>
                        {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB3Filter.year} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB3Filter.kind==='quarterly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Quarter</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB3Filter.quarter} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, quarter:Number(e.target.value) }))}>
                        <option value={1}>Q1</option>
                        <option value={2}>Q2</option>
                        <option value={3}>Q3</option>
                        <option value={4}>Q4</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB3Filter.year} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB3Filter.kind==='yearly' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                    <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB3Filter.year} onChange={(e)=>setOvB3Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={()=>setOvB3FilterOpen(false)} className="px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Chart 4 Filter Modal */}
        {ovB4FilterOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white w-full max-w-lg rounded-lg shadow-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">KPI Frequency Filter</h3>
                <button onClick={()=>setOvB4FilterOpen(false)} className="text-white/80 hover:text-white text-2xl font-bold">✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-white/90">Type</label>
                  <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB4Filter.kind} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, kind:e.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {ovB4Filter.kind==='weekly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Month</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB4Filter.month} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, month:Number(e.target.value) }))}>
                        {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB4Filter.year} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-white/90">Week (1-5)</label>
                      <input type="number" min="1" max="5" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB4Filter.week} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, week:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB4Filter.kind==='monthly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Month</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB4Filter.month} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, month:Number(e.target.value) }))}>
                        {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB4Filter.year} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB4Filter.kind==='quarterly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Quarter</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB4Filter.quarter} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, quarter:Number(e.target.value) }))}>
                        <option value={1}>Q1</option>
                        <option value={2}>Q2</option>
                        <option value={3}>Q3</option>
                        <option value={4}>Q4</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB4Filter.year} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB4Filter.kind==='yearly' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                    <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB4Filter.year} onChange={(e)=>setOvB4Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-white/90">Basis</label>
                  <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB4Basis} onChange={(e)=>setOvB4Basis(e.target.value)}>
                    <option value="created">Created</option>
                    <option value="due">Due</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={()=>setOvB4FilterOpen(false)} className="px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Chart 5 Filter Modal */}
        {ovB5FilterOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white w-full max-w-lg rounded-lg shadow-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">KRA & KPI Frequency Filter</h3>
                <button onClick={()=>setOvB5FilterOpen(false)} className="text-white/80 hover:text-white text-2xl font-bold">✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-white/90">Type</label>
                  <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB5Filter.kind} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, kind:e.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {ovB5Filter.kind==='weekly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Month</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB5Filter.month} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, month:Number(e.target.value) }))}>
                        {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB5Filter.year} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-white/90">Week (1-5)</label>
                      <input type="number" min="1" max="5" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB5Filter.week} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, week:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB5Filter.kind==='monthly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Month</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB5Filter.month} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, month:Number(e.target.value) }))}>
                        {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB5Filter.year} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB5Filter.kind==='quarterly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Quarter</label>
                      <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB5Filter.quarter} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, quarter:Number(e.target.value) }))}>
                        <option value={1}>Q1</option>
                        <option value={2}>Q2</option>
                        <option value={3}>Q3</option>
                        <option value={4}>Q4</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                      <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB5Filter.year} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                    </div>
                  </>
                )}
                {ovB5Filter.kind==='yearly' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-white/90">Year</label>
                    <input type="number" className="w-full p-2 border border-white/50 rounded bg-white/20 text-white" value={ovB5Filter.year} onChange={(e)=>setOvB5Filter(prev=>({ ...prev, year:Number(e.target.value) }))} />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-white/90">Basis</label>
                  <select className="w-full p-2 border border-white/50 rounded bg-white/30 text-gray-900" value={ovB5Basis} onChange={(e)=>setOvB5Basis(e.target.value)}>
                    <option value="created">Created</option>
                    <option value="due">Due</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={()=>setOvB5FilterOpen(false)} className="px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}