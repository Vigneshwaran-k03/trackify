import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { getToken, getRole, getUserName, clearAuth } from '../../utils/authStorage';
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
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { exportChartFromRef, exportSectionById, exportTableToCSV, exportTableToExcel, downloadBlob } from '../../utils/exportUtils';

// --- IMPORTANT ---
// Import your background image like this
import backgroundImage from '../../assets/background.png';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default function EmployeeDashboard() {
  const [userName, setUserName] = useState('');
  const [userDept, setUserDept] = useState('');
  const [userId, setUserId] = useState(0);
  const [myKPIs, setMyKPIs] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [recentKRAs, setRecentKRAs] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');
  const [kraAggregates, setKraAggregates] = useState({});
  const navigate = useNavigate();
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [scoreModalKpi, setScoreModalKpi] = useState(null);
  const [scoreModalValue, setScoreModalValue] = useState('');
  const [scoreModalComments, setScoreModalComments] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, name: '', def: '', due_date: '', target: '', scoring_method: '' });
  const [kraModalOpen, setKraModalOpen] = useState(false);
  const [kraModalName, setKraModalName] = useState('');
  const [kraModalAgg, setKraModalAgg] = useState(0);
  const [kraModalKpis, setKraModalKpis] = useState([]);
  const [kraModalLoading, setKraModalLoading] = useState(false);
  // Chart block local states
  const [b1Type, setB1Type] = useState('bar');
  const [b1Color, setB1Color] = useState('#60a5fa');
  const [b2Type, setB2Type] = useState('pie');
  const [b2Color, setB2Color] = useState('#f97316');
  const [b2KraId, setB2KraId] = useState('');
  const [b3Type, setB3Type] = useState('line');
  const [b3Color, setB3Color] = useState('#10b981');
  const [b3FilterOpen, setB3FilterOpen] = useState(false);
  const [b3Filter, setB3Filter] = useState({ kind: 'weekly', year: new Date().getFullYear(), month: new Date().getMonth()+1, week: 1, date: format(new Date(), 'yyyy-MM-dd'), quarter: 1 });
  const [b3Basis, setB3Basis] = useState('created'); // 'created' | 'due' | 'both'
  const [b4Type, setB4Type] = useState('pie');
  const [b4Color, setB4Color] = useState('#ef4444');
  const [b4KraId, setB4KraId] = useState('');
  const [b4FilterOpen, setB4FilterOpen] = useState(false);
  const [b4Filter, setB4Filter] = useState({ kind: 'weekly', year: new Date().getFullYear(), month: new Date().getMonth()+1, week: 1, date: format(new Date(), 'yyyy-MM-dd'), quarter: 1 });
  const [b4Basis, setB4Basis] = useState('created');
  const [b5Type, setB5Type] = useState('bar');
  const [b5KraId, setB5KraId] = useState('');
  const [b5FilterOpen, setB5FilterOpen] = useState(false);
  const [b5Filter, setB5Filter] = useState({ kind: 'weekly', year: new Date().getFullYear(), month: new Date().getMonth()+1, week: 1, quarter: 1 });
  const [b5Basis, setB5Basis] = useState('created');
  const [exporting, setExporting] = useState(false);
  const [allKras, setAllKras] = useState([]);
  const [kraSeries, setKraSeries] = useState({ labels: [], values: [] });
  const [kpiDistribution, setKpiDistribution] = useState({ labels: [], values: [] });
  const [chartType, setChartType] = useState('line');
  const [frequency, setFrequency] = useState('weekly');
  const [selectedKraId, setSelectedKraId] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [submitToast, setSubmitToast] = useState(false);
  // Tasks filters
  const [empTasksFilter, setEmpTasksFilter] = useState('active'); // 'active' | 'end' | 'all'
  const [empTasksKraFilter, setEmpTasksKraFilter] = useState(''); // '' or kra_id
  // Export dropdowns and format
  const [exportAllFormat, setExportAllFormat] = useState('pdf'); // pdf|png|jpg
  const [expMyPerfOpen, setExpMyPerfOpen] = useState(false);
  const [expB1Open, setExpB1Open] = useState(false);
  const [expB2Open, setExpB2Open] = useState(false);
  const [expB3Open, setExpB3Open] = useState(false);
  const [expB4Open, setExpB4Open] = useState(false);
  const [expB5Open, setExpB5Open] = useState(false);
  const [expTasksOpen, setExpTasksOpen] = useState(false);
  const [expKrasOpen, setExpKrasOpen] = useState(false);
  const lastUpdatedRef = useRef(null);
  // Reviews performance states
  const [perfFilter, setPerfFilter] = useState({ year: new Date().getFullYear(), month: new Date().getMonth()+1 });
  const [perfReviews, setPerfReviews] = useState([]);
  const [perfKraSeries, setPerfKraSeries] = useState({ labels: [], values: [] });
  const [perfChartType, setPerfChartType] = useState('bar');
  // Employee trend (monthly over selected year)
  const [empTrend, setEmpTrend] = useState({ labels: [], values: [] });
  const [empTrendDelta, setEmpTrendDelta] = useState(0);
  const [empTrendYear, setEmpTrendYear] = useState(new Date().getFullYear());
  // Profile gauges: two month-selectable gauge charts (avg review score for month)
  const [gauge1Filter, setGauge1Filter] = useState(()=>{
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth()+1 };
  });
  const [gauge2Filter, setGauge2Filter] = useState(()=>{
    const d = new Date();
    const prev = new Date(d.getFullYear(), d.getMonth()-1, 1);
    return { year: prev.getFullYear(), month: prev.getMonth()+1 };
  });
  const [gauge1Avg, setGauge1Avg] = useState(0);
  const [gauge2Avg, setGauge2Avg] = useState(0);
  const [gauge1Target, setGauge1Target] = useState(0);
  const [gauge2Target, setGauge2Target] = useState(0);

  const logoutAndRedirect = () => {
    try {
      clearAuth();
    } finally {
      window.location.href = '/login';
    }
  };

  // Build employee monthly trend across the selected year (decoupled from My Performance filter)
  useEffect(() => {
    const run = async () => {
      try {
        if (!userId) { setEmpTrend({ labels: [], values: [] }); setEmpTrendDelta(0); return; }
        const year = empTrendYear || new Date().getFullYear();
        const now = new Date();
        const maxMonth = (year === now.getFullYear()) ? (now.getMonth() + 1) : 12;
        const months = Array.from({ length: maxMonth }, (_, i) => i + 1);
        const labels = months.map(m => new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'short' }));
        const lists = await Promise.all(months.map(mm => fetchMonthlyAverage(userId, year, mm)));
        const values = lists.map(r => Math.max(0, Math.min(100, r?.avg || 0)));
        setEmpTrend({ labels, values });
        // Delta: now month - last month using last two numeric values
        const nums = values.filter(v => typeof v === 'number');
        const cur = nums.length ? nums[nums.length - 1] : undefined;
        const prev = nums.length > 1 ? nums[nums.length - 2] : undefined;
        const delta = (typeof cur === 'number' && typeof prev === 'number') ? Math.round((cur - prev) * 100) / 100 : 0;
        setEmpTrendDelta(delta);
      } catch (_) {
        setEmpTrend({ labels: [], values: [] }); setEmpTrendDelta(0);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, empTrendYear]);

  const submitKraModalNotify = async () => {
    try {
      const token = getToken();
      const first = (kraModalKpis && kraModalKpis[0]) || null;
      const kraId = first?.kra_id || selectedKraId || '';
      let kraName = (first?.kra_name) || kraModalName || '';
      // Avoid calling /kra/:id (may be forbidden for employees). Try to derive managerName from modal context if available.
      let managerName = first?.manager_name || '';
      await axios.post('http://localhost:3000/notification/submit', {
        actorRole: 'Employee',
        actorName: userName,
        targetRole: 'Manager',
        targetName: managerName,
        context: { kra: kraName, dept: userDept || '' },
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSubmitToast(true);
      setTimeout(()=> setSubmitToast(false), 2000);
    } catch (_) {}
  };

  // Get average score for a month (helper for gauges)
  const fetchMonthlyAverage = async (empId, y, m) => {
    if (!empId) return { avg: 0, targetAvg: 0 };
    try {
      const token = getToken();
      const res = await axios.get(`http://localhost:3000/review/employee/${empId}/month`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year: y, month: m }
      });
      const list = res.data?.data || [];
      const scores = list.map(r => (typeof r.score === 'number' ? r.score : Number(r.score || 0))).filter(v=>!Number.isNaN(v));
      const avg = scores.length ? (scores.reduce((a,b)=>a+b,0) / scores.length) : 0;
      // Compute target average for reviewed KRAs in this month using allKras list (fallback 100 if missing)
      const kraIds = Array.from(new Set(list.map(r=> r.kra_id))).filter(Boolean);
      const targets = kraIds.map(id => {
        const match = (allKras||[]).find(k=> String(k.kra_id)===String(id));
        const tgt = typeof match?.target === 'number' ? match.target : 100;
        return tgt;
      });
      const targetAvg = targets.length ? (targets.reduce((a,b)=>a+b,0) / targets.length) : 100;
      return { avg: Math.round(avg * 100) / 100, targetAvg: Math.round(targetAvg * 100) / 100 };
    } catch (_) {
      return { avg: 0, targetAvg: 100 };
    }
  };

  // Load gauge values when filters or user change
  useEffect(()=>{
    let mounted = true;
    const run = async () => {
      if (!userId) return;
      const [r1, r2] = await Promise.all([
        fetchMonthlyAverage(userId, gauge1Filter.year, gauge1Filter.month),
        fetchMonthlyAverage(userId, gauge2Filter.year, gauge2Filter.month),
      ]);
      if (!mounted) return;
      setGauge1Avg(r1.avg);
      setGauge2Avg(r2.avg);
      setGauge1Target(r1.targetAvg);
      setGauge2Target(r2.targetAvg);
    };
    run();
    return ()=>{ mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, gauge1Filter.year, gauge1Filter.month, gauge2Filter.year, gauge2Filter.month]);

  // Fetch monthly reviews and compute per-KRA average
  const fetchMonthlyReviews = async (empId, y, m) => {
    if (!empId) return;
    try {
      const token = getToken();
      const res = await axios.get(`http://localhost:3000/review/employee/${empId}/month`, {
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
    } catch (e) {
      setPerfReviews([]);
      setPerfKraSeries({ labels: [], values: [] });
      if (e?.response?.status === 401) logoutAndRedirect();
    }
  };

  useEffect(() => {
    if (userId && perfFilter?.year && perfFilter?.month) {
      fetchMonthlyReviews(userId, perfFilter.year, perfFilter.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, perfFilter.year, perfFilter.month]);

  // Ensure Block 5 has a selected KRA by default
  useEffect(()=>{
    if (!b5KraId && allKras && allKras.length) {
      setB5KraId(String(allKras[0].kra_id));
    }
  }, [allKras]);

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    const name = getUserName() || 'Employee';

    if (!token || (role || '').toLowerCase() !== 'employee') {
      window.location.href = '/login';
      return;
    }

    setUserName(name);

    // Fetch employee-specific data
    fetchUserProfile();
    fetchMyKPIs();
    fetchMyTasks();
    fetchMyKRAs();
  }, []);

  // When department becomes available (after profile), re-fetch KRAs
  useEffect(() => {
    if (userDept) {
      fetchMyKRAs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDept]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('http://localhost:3000/auth/profile', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setUserDept(response.data.dept);
      if (response.data?.user_id) setUserId(response.data.user_id);
      else if (response.data?.id) setUserId(response.data.id);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      if (error?.response?.status === 401) logoutAndRedirect();
    }
  };

  const computeCharts = (list) => {
    // Build KRA series: X-axis all KRA names, Y-axis overall % from kraAggregates
    const labels = allKras.map(k => k.name);
    const values = allKras.map(k => (kraAggregates[k.kra_id] ?? 0));
    setKraSeries({ labels, values });

    // Build KPI distribution for selected KRA
    const filtered = selectedKraId ? list.filter(k => String(k.kra_id) === String(selectedKraId)) : list;
    const distLabels = filtered.map((k) => k.name);
    const distValues = filtered.map((k) => (typeof k.progress === 'number' ? k.progress : 0));
    setKpiDistribution({ labels: distLabels, values: distValues });
  };

  useEffect(() => {
    computeCharts(myKPIs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myKPIs, kraAggregates, allKras, selectedKraId]);

  const exportPdf = async () => {
    try {
      setExporting(true);
      const ids = ['b1','b2','b3','b4','b5'];
      if (exportAllFormat === 'pdf') {
        const pdf = new jsPDF('p','mm','a4');
        let first = true;
        for (let idx=0; idx<ids.length; idx++) {
          const canvas = await getCanvasForElement(ids[idx]);
          if (!canvas) continue;
          const img = canvas.toDataURL('image/png');
          const w = pdf.internal.pageSize.getWidth();
          const h = (canvas.height * (w-20)) / canvas.width;
          if (!first) pdf.addPage();
          pdf.text(ids[idx].toUpperCase(), 10, 10);
          pdf.addImage(img,'PNG',10,20,w-20, Math.min(h, 277));
          first = false;
        }
        pdf.save('employee-overview-charts.pdf');
      } else {
        for (let idx=0; idx<ids.length; idx++) {
          const canvas = await getCanvasForElement(ids[idx]);
          if (!canvas) continue;
          const url = canvas.toDataURL(`image/${exportAllFormat==='jpg'?'jpeg':'png'}`, 0.92);
          const a = document.createElement('a');
          a.href = url; a.download = `${ids[idx]}.${exportAllFormat==='jpg'?'jpg':'png'}`; a.click();
        }
      }
    } finally {
      setExporting(false);
    }
  };

  const updateKraModalLocal = (kpiId, patch) => {
    setKraModalKpis(prev => prev.map(k => (k.id === kpiId ? { ...k, ...patch } : k)));
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
    } catch (e) {
      setEditModalOpen(false);
      if (e?.response?.status === 401) logoutAndRedirect();
    }
  };

  const removeKpi = async (kpiId) => {
    try {
      if (!window.confirm('Send a deletion request for this KPI to your manager?')) return;
      const token = getToken();
      await axios.post('http://localhost:3000/requests/kpi-change', {
        kpi_id: Number(kpiId),
        action: 'delete',
        requested_changes: {},
        request_comment: 'Employee requested KPI deletion'
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Deletion request sent to your manager.');
      fetchMyKPIs();
    } catch (e) {
      if (e?.response?.status === 401) logoutAndRedirect();
    }
  };

  const fetchMyKPIs = async () => {
    try {
      const token = getToken();
      // Get KRAs assigned to this employee
      const avail = await axios.get('http://localhost:3000/kpi/available', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const kras = avail.data?.data || [];
      setAllKras(kras);
      if (!selectedKraId && kras.length) setSelectedKraId(String(kras[0].kra_id));
      // For each KRA, fetch its KPIs with scores
      const allKpis = (
        await Promise.all(
          kras.map(async (k) => {
            try {
              const res = await axios.get(`http://localhost:3000/scoring/kra/${k.kra_id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const list = res.data?.data || [];
              return list.map((i) => ({
                id: i.id,
                name: i.name,
                progress: typeof i.percentage === 'number' ? i.percentage : 0,
                target: typeof i.target === 'number' ? i.target : null,
                due_date: i.due_date,
                scoring_method: i.scoring_method,
                kra_name: i.kra_name,
                kra_id: i.kra_id,
                created_at: i.created_at,
              }));
            } catch (_) {
              return [];
            }
          })
        )
      ).flat();
      setMyKPIs(allKpis);
      computeCharts(allKpis);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      if (error?.response?.status === 401) logoutAndRedirect();
    }
  };

  const fetchMyTasks = async () => {
    try {
      // Mock data for tasks
      setMyTasks([
        { id: 1, name: 'Complete Sales Report', status: 'In Progress', dueDate: '2025-01-15', priority: 'High' },
        { id: 2, name: 'Team Meeting Preparation', status: 'Pending', dueDate: '2025-01-20', priority: 'Medium' },
        { id: 3, name: 'Code Review', status: 'Completed', dueDate: '2025-01-10', priority: 'Low' },
      ]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchMyKRAs = async () => {
    try {
      const token = getToken();
      // Employees: use kpi/available to get KRAs assigned to them
      const avail = await axios.get('http://localhost:3000/kpi/available', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const kras = avail.data?.data || [];
      const list = kras.slice(0, 3);
      setRecentKRAs(list);
      setAllKras(kras);
      if (!selectedKraId && kras.length) setSelectedKraId(String(kras[0].kra_id));
      fetchKraAggregates(kras.map(k => k.kra_id));
    } catch (error) {
      console.error('Error fetching KRAs:', error);
      if (error?.response?.status === 401) logoutAndRedirect();
    }
  };

  const fetchKraAggregates = async (kraIds) => {
    try {
      const token = getToken();
      const results = await Promise.all(
        kraIds.map(async (id) => {
          try {
            const res = await axios.get(`http://localhost:3000/scoring/kra/${id}/aggregate`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            return { id, pct: res.data?.data?.percentage ?? 0 };
          } catch (_) {
            return { id, pct: 0 };
          }
        })
      );
      const map = {};
      results.forEach(r => { map[r.id] = r.pct; });
      setKraAggregates(map);
    } catch (e) {
      console.error('Error fetching aggregates', e);
      if (e?.response?.status === 401) logoutAndRedirect();
    }
  };

  const handleTaskClick = (taskId) => {
    console.log(`View task ${taskId}`);
  };

  const handleKpiClick = (kraId) => {
    openKraModal(kraId);
  };

  const openKraModal = async (kraId) => {
    try {
      setKraModalLoading(true);
      setKraModalOpen(true);
      const token = getToken();
      const [listRes, aggRes] = await Promise.all([
        axios.get(`http://localhost:3000/scoring/kra/${kraId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`http://localhost:3000/scoring/kra/${kraId}/aggregate`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const raw = listRes.data?.data || [];
      const today = new Date(); today.setHours(0,0,0,0);
      const items = raw.filter(i => {
        if (i.kpi_status) return String(i.kpi_status).toLowerCase() === 'active';
        return !i.due_date || new Date(i.due_date) >= today;
      });
      setKraModalKpis(items.map(i => ({
        ...i,
        _score: typeof i.score === 'number' ? i.score : '',
        _comments: i.comments || '',
      })));
      // Derive KRA name: prefer API item name, else from recentKRAs list, else from /kpi/available
      let name = items[0]?.kra_name;
      if (!name) {
        const recent = (recentKRAs || []).find(k => String(k.kra_id) === String(kraId));
        name = recent?.name;
      }
      if (!name) {
        try {
          const avail = await axios.get('http://localhost:3000/kpi/available', { headers: { Authorization: `Bearer ${token}` } });
          const match = (avail.data?.data || []).find(k => String(k.kra_id) === String(kraId));
          name = match?.name || name;
        } catch (_) {
          // ignore
        }
      }
      setKraModalName(name || '');
      // Compute overall from active items only
      const activePercents = items.map(i => (typeof i.percentage === 'number' ? i.percentage : null)).filter(v=> typeof v==='number');
      const avg = activePercents.length ? Math.round((activePercents.reduce((a,b)=>a+b,0)/activePercents.length)*100)/100 : 0;
      setKraModalAgg(avg);
    } catch (e) {
      // ignore
      if (e?.response?.status === 401) logoutAndRedirect();
    } finally {
      setKraModalLoading(false);
    }
  };

  const saveKraModalKpi = async (kpi) => {
    try {
      const token = getToken();
      await axios.post('http://localhost:3000/scoring/add', {
        kpi_id: kpi.id,
        score: Number(kpi._score),
        comments: kpi._comments || undefined,
      }, { headers: { Authorization: `Bearer ${token}` } });
      // refresh modal data
      openKraModal(kpi.kra_id || 0);
    } catch (_) {}
  };

  const getStatusInfo = (progress, target) => {
    const tgt = typeof target === 'number' && target > 0 ? target : 100;
    const pctOfTarget = (progress / tgt) * 100;
    if (pctOfTarget >= 100) return { label: 'Completed', color: 'bg-green-100 text-green-800' };
    if (pctOfTarget < 70) return { label: 'Pending', color: 'bg-red-100 text-red-800' };
    return { label: 'Achieved', color: 'bg-blue-100 text-blue-800' };
  };

  const openScoreModal = async (kpi) => {
    try {
      setScoreModalKpi(kpi);
      setScoreModalValue('');
      setScoreModalComments('');
      // fetch existing score
      const res = await axios.get(`http://localhost:3000/scoring/kpi/${kpi.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = res.data?.data;
      if (data) {
        setScoreModalValue(typeof data.score === 'number' ? String(data.score) : '');
        setScoreModalComments(data.comments || '');
      }
      setScoreModalOpen(true);
    } catch (e) {
      setScoreModalOpen(true); // still open to allow scoring
    }
  };

  const submitScoreModal = async () => {
    if (!scoreModalKpi) return;
    try {
      const prevStatus = getStatusInfo(scoreModalKpi.progress, scoreModalKpi.target).label;
      lastUpdatedRef.current = { id: scoreModalKpi.id, prev: prevStatus };
      await axios.post('http://localhost:3000/scoring/add', {
        kpi_id: scoreModalKpi.id,
        score: Number(scoreModalValue),
        comments: scoreModalComments || undefined,
      }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setScoreModalOpen(false);
      // refresh lists
      fetchMyKPIs();
      if (recentKRAs.length) fetchKraAggregates(recentKRAs.map(k => k.kra_id));
    } catch (e) {
      setScoreModalOpen(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    if (!lastUpdatedRef.current) return;
    const { id, prev } = lastUpdatedRef.current;
    const k = myKPIs.find(x => x.id === id);
    if (!k) return;
    const now = getStatusInfo(k.progress, k.target).label;
    if ((now === 'Completed' || now === 'Achieved <70%') && now !== prev) {
      setCelebrate(true);
      setCelebrateKey(v => v + 1);
      setTimeout(() => setCelebrate(false), 2500);
    }
    lastUpdatedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myKPIs]);

  const makeRange = (f) => {
    if (f.kind === 'date') {
      const d = parseISO(f.date);
      return { start: d, end: d };
    }
    if (f.kind === 'weekly') {
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
    if (f.kind === 'monthly') {
      const s = startOfMonth(new Date(f.year, f.month - 1, 1));
      return { start: s, end: endOfMonth(s) };
    }
    if (f.kind === 'quarterly') {
      const q = Math.min(Math.max(f.quarter, 1), 4);
      const startMonth = (q - 1) * 3;
      const s = startOfQuarter(new Date(f.year, startMonth, 1));
      return { start: s, end: endOfQuarter(s) };
    }
    const s = startOfYear(new Date(f.year, 0, 1));
    return { start: s, end: endOfYear(s) };
  };

  const makeRangeLimited = (f) => {
    const kind = ['weekly', 'monthly', 'quarterly', 'yearly'].includes(f.kind) ? f.kind : 'weekly';
    return makeRange({ ...f, kind });
  };

  const downloadBlob = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Render comments: convert [text](url) to safe anchors opening in new tab
  const renderCommentHtml = (text) => {
    if (!text) return '';
    const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const esc = escapeHtml(String(text));
    // Replace markdown links [name](url) with anchors; allow space and only http/https
    const withMd = esc.replace(/\[(.+?)\]\s*\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
      const safeLabel = label;
      const safeUrl = url;
      // Updated link color for dark background
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-300 underline">${safeLabel}</a>`;
    });
    // Auto-link bare URLs not already inside an anchor
    return withMd.replace(/(?<![\w"'=])(https?:\/\/[^\s)]+)(?![^<]*>)/g, (m, url) => {
      const safeUrl = url;
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-300 underline">${safeUrl}</a>`;
    });
  };

  // Link modal state
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTarget, setLinkTarget] = useState(null); // 'score'

  const openLinkModal = (target) => {
    setLinkTarget(target);
    setLinkName('');
    setLinkUrl('');
    setLinkModalOpen(true);
  };
  const closeLinkModal = () => { setLinkModalOpen(false); };
  const confirmLinkModal = () => {
    if (!/^https?:\/\//i.test(linkUrl)) return;
    const snippet = linkName ? ` [${linkName}](${linkUrl})` : ` ${linkUrl}`;
    if (linkTarget === 'score') {
      setScoreModalComments((prev) => (prev ?? '') + snippet);
    }
    setLinkModalOpen(false);
  };

  // Safe export helper: removes gradients to avoid html2canvas color parsing issues
  const getCanvasForElement = async (elId) => {
    const el = document.getElementById(elId);
    if (!el) return null;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff', // Use white for exports
      onclone: (doc) => {
        const target = doc.getElementById(elId);
        if (!target) return;
        
        // Remove gradients and replace with solid color for export
        target.querySelectorAll('.bg-gradient-to-r').forEach((node) => {
          node.classList.remove('bg-gradient-to-r');
          node.style.backgroundImage = 'none';
          node.style.backgroundColor = '#1e3a8a'; // Solid blue fallback
        });
        
        // --- NEW ---
        // Force text to be black for PDF/Image export readability
        target.querySelectorAll('*').forEach(node => {
          if (node.classList.contains('text-white')) {
            node.style.color = '#000000';
          }
          if (node.classList.contains('text-gray-100')) {
            node.style.color = '#333333';
          }
          if (node.classList.contains('text-gray-200')) {
            node.style.color = '#333333';
          }
          if (node.classList.contains('text-cyan-200')) {
            node.style.color = '#008B8B';
          }
        });
        
        // Set background to white for all frosted cards
        target.querySelectorAll('.backdrop-blur-md').forEach(node => {
           node.style.backgroundColor = '#ffffff';
        });
      },
    });
    return canvas;
  };

  const FilterModal = ({ title, filter, setFilter, onClose, allowAllKinds }) => (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white/20 backdrop-blur-md text-white w-full max-w-md rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-100">Type</label>
            <select
              className="w-full p-2 border border-white/30 rounded bg-white/80 text-black"
              value={filter.kind}
              onChange={(e)=>setFilter(prev=>({ ...prev, kind: e.target.value }))}
            >
              {allowAllKinds ? (
                <>
                  <option value="date">Date</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </>
              ) : (
                <>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </>
              )}
            </select>
          </div>
          {filter.kind === 'date' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-100">Select Date</label>
              <input type="date" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.date} onChange={(e)=>setFilter(prev=>({ ...prev, date: e.target.value }))} />
            </div>
          )}
          {filter.kind === 'weekly' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-100">Month</label>
                <select className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.month} onChange={(e)=>setFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                  {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-100">Year</label>
                <input type="number" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.year} onChange={(e)=>setFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-gray-100">Week (1-5)</label>
                <input type="number" min="1" max="5" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.week} onChange={(e)=>setFilter(prev=>({ ...prev, week: Number(e.target.value) }))} />
              </div>
            </>
          )}
          {filter.kind === 'monthly' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-100">Month</label>
                <select className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.month} onChange={(e)=>setFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                  {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-100">Year</label>
                <input type="number" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.year} onChange={(e)=>setFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
              </div>
            </>
          )}
          {filter.kind === 'quarterly' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-100">Quarter</label>
                <select className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.quarter} onChange={(e)=>setFilter(prev=>({ ...prev, quarter: Number(e.target.value) }))}>
                  <option value={1}>Q1</option>
                  <option value={2}>Q2</option>
                  <option value={3}>Q3</option>
                  <option value={4}>Q4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-100">Year</label>
                <input type="number" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.year} onChange={(e)=>setFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
              </div>
            </>
          )}
          {filter.kind === 'yearly' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-gray-100">Year</label>
              <input type="number" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={filter.year} onChange={(e)=>setFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Close</button>
        </div>
      </div>
    </div>
  );

  if (!userName) return (
    <div 
      className="min-h-screen text-white flex items-center justify-center"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      Loading...
    </div>
  );

  const sections = {
    overview: (
      <div id="employee-overview-section">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-white">Overview</h3>
          <div className="relative">
            <button className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500" onClick={(e)=>{ const m=e.currentTarget.nextSibling; if (m) m.classList.toggle('hidden'); }}>Export</button>
            <div className="absolute right-0 mt-1 bg-white border rounded shadow hidden z-10 text-black">
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=>exportSectionById('employee-overview-section','employee-overview','pdf')}>PDF</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=>exportSectionById('employee-overview-section','employee-overview','png')}>PNG</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=>exportSectionById('employee-overview-section','employee-overview','jpg')}>JPG</button>
            </div>
          </div>
        </div>
        {/* Employee Trend Analysis (first in overview) */}
        <div className="bg-black/20 backdrop-blur-md rounded-lg p-4 md:p-5 shadow relative overflow-hidden mb-6">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(1000px 400px at 20% -10%, rgba(0,255,255,0.10), transparent), radial-gradient(800px 300px at 120% 20%, rgba(0,128,255,0.12), transparent), radial-gradient(1000px 500px at 50% 120%, rgba(0,255,128,0.08), transparent)' }} />
          <div className="relative flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-cyan-200">Trend Analysis</div>
              <div className="text-white text-lg font-semibold">My Performance — {empTrendYear}</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className="p-1.5 rounded bg-white/10 text-white w-24 border border-white/30" value={empTrendYear} onChange={(e)=>setEmpTrendYear(Number(e.target.value)||new Date().getFullYear())} />
              <div className={`text-sm font-semibold ${empTrendDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{empTrendDelta >= 0 ? '▲' : '▼'} {Math.abs(empTrendDelta)}</div>
            </div>
          </div>
          <div className="relative h-56 md:h-64">
            {(() => {
              const fallbackLabels = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'short' }));
              const labels = (empTrend.labels && empTrend.labels.length) ? empTrend.labels : fallbackLabels;
              const values = (empTrend.values && empTrend.values.length) ? empTrend.values : Array.from({ length: 12 }, () => 0);
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
                    plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' } },
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

        {/* My Performance (Reviews) - Chart */}
        <div id="my-performance" className="bg-white/20 backdrop-blur-md p-4 rounded-lg shadow-xl mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="font-medium text-white">My Performance (Reviews)</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-gray-200">Month</label>
              <select className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black" value={perfFilter.month} onChange={(e)=>setPerfFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
              </select>
              <label className="text-sm text-gray-200">Year</label>
              <input type="number" className="p-2 border border-white/30 rounded text-sm w-24 bg-white/80 text-black" value={perfFilter.year} onChange={(e)=>setPerfFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
              <label className="text-sm text-gray-200">Chart</label>
              <select className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black" value={perfChartType} onChange={(e)=>setPerfChartType(e.target.value)}>
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="pie">Pie</option>
              </select>
              <div className="relative">
                  <button onClick={()=>setExpMyPerfOpen(v=>!v)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Export</button>
                  {expMyPerfOpen && (
                    <div className="absolute right-0 top-10 bg-white border rounded shadow text-sm z-10 text-black">
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpMyPerfOpen(false); exportSectionById('my-performance','my-performance','pdf'); }}>PDF</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpMyPerfOpen(false); exportSectionById('my-performance','my-performance','png'); }}>PNG</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpMyPerfOpen(false); exportSectionById('my-performance','my-performance','jpg'); }}>JPG</button>
                    </div>
                  )}
                </div>
            </div>
          </div>
          {(()=>{
            const labels = perfKraSeries.labels;
            const values = perfKraSeries.values;
            const options = { 
              responsive:true, 
              maintainAspectRatio:false, 
              plugins:{ legend:{ display:false } },
              scales: {
                x: { ticks: { color: '#FFF' } },
                y: { ticks: { color: '#FFF' } }
              }
            };
            const pieOptions = { 
              responsive:true, 
              maintainAspectRatio:false, 
              plugins: { legend: { labels: { color: '#FFF' } } } 
            };
            if (!labels.length) return <div className="text-gray-200">No reviews for the selected month.</div>;
            if (perfChartType==='line') return (
              <div className="h-48"><Line data={{ labels, datasets:[{ label:'Avg Score', data: values, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.3)' }] }} options={options} /></div>
            );
            if (perfChartType==='bar') return (
              <div className="h-48"><Bar data={{ labels, datasets:[{ label:'Avg Score', data: values, backgroundColor:'rgba(59,130,246,0.5)', borderColor:'#3b82f6' }] }} options={options} /></div>
            );
            return (
              <div className="h-48"><Pie data={{ labels, datasets:[{ label:'Avg Score', data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*57)%360} 70% 65%)`) }] }} options={pieOptions} /></div>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Block 1: KRA Scores All KRAs */}
          <div id="b1" className="bg-white/20 backdrop-blur-md p-4 rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h4 className="font-medium text-white">KRA Scores</h4>
              <div className="flex items-center gap-2">
                <select value={b1Type} onChange={(e)=>setB1Type(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
                <div className="relative">
                  <button onClick={()=>setExpB1Open(v=>!v)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Export</button>
                  {expB1Open && (
                    <div className="absolute right-0 top-10 bg-white border rounded shadow text-sm z-10 text-black">
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB1Open(false); exportSectionById('b1','kra-scores','pdf'); }}>PDF</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB1Open(false); exportSectionById('b1','kra-scores','png'); }}>PNG</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB1Open(false); exportSectionById('b1','kra-scores','jpg'); }}>JPG</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(()=>{
              const today = new Date(); today.setHours(0,0,0,0);
              const active = myKPIs.filter(k=> !k.due_date || new Date(k.due_date) >= today);
              const labels = allKras.map(k=>k.name);
              const values = allKras.map(k=>{
                const arr = active.filter(x=> String(x.kra_id)===String(k.kra_id)).map(x=> typeof x.progress==='number'? x.progress:0);
                if (!arr.length) return 0; return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
              });
              const options = { 
                responsive:true, 
                plugins:{ legend:{ display:false } },
                scales: {
                  x: { ticks: { color: '#FFF' } },
                  y: { ticks: { color: '#FFF' } }
                }
              };
              const pieOptions = { responsive:true, maintainAspectRatio:false, plugins: { legend: { labels: { color: '#FFF' } } } };

              if (b1Type === 'line') return (
                <Line data={{ labels, datasets: [{ label: 'Overall %', data: values, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.3)' }] }} options={options} />
              );
              if (b1Type === 'bar') return (
                <Bar data={{ labels, datasets: [{ label: 'Overall %', data: values, backgroundColor: 'rgba(59,130,246,0.5)', borderColor: '#3b82f6' }] }} options={options} />
              );
              return (
                <div className="h-56"><Pie data={{ labels, datasets: [{ label: 'Overall %', data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*57)%360} 70% 65%)`) }] }} options={pieOptions} /></div>
              );
            })()}
          </div>

          {/* Block 2: KPI Scores for selected KRA */}
          <div id="b2" className="bg-white/20 backdrop-blur-md p-4 rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h4 className="font-medium text-white">KPI Scores (Select KRA)</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={b2KraId} onChange={(e)=>setB2KraId(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="">All</option>
                  {allKras.map(k=> <option key={k.kra_id} value={k.kra_id}>{k.name}</option>)}
                </select>
                <select value={b2Type} onChange={(e)=>setB2Type(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="pie">Pie</option>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                </select>
                <div className="relative">
                  <button onClick={()=>setExpB2Open(v=>!v)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Export</button>
                  {expB2Open && (
                    <div className="absolute right-0 top-10 bg-white border rounded shadow text-sm z-10 text-black">
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB2Open(false); exportSectionById('b2','kpi-scores-selected-kra','pdf'); }}>PDF</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB2Open(false); exportSectionById('b2','kpi-scores-selected-kra','png'); }}>PNG</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB2Open(false); exportSectionById('b2','kpi-scores-selected-kra','jpg'); }}>JPG</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(()=>{
              // Show only Active KPIs; optionally filter by selected KRA
              const today = new Date(); today.setHours(0,0,0,0);
              const active = myKPIs.filter(k=> {
                if (k.kpi_status) return String(k.kpi_status).toLowerCase() === 'active';
                return !k.due_date || new Date(k.due_date) >= today;
              });
              const list = b2KraId ? active.filter(k=> String(k.kra_id)===String(b2KraId)) : active;
              const labels = list.map(k=>k.name);
              const values = list.map(k=> typeof k.progress==='number'? k.progress:0);
              const options = { responsive:true, plugins:{ legend:{ display:false } }, scales: { x: { ticks: { color: '#FFF' } }, y: { ticks: { color: '#FFF' } } } };
              const pieOptions = { responsive:true, maintainAspectRatio:false, plugins: { legend: { labels: { color: '#FFF' } } } };

              if (b2Type==='pie') return <div className="h-56"><Pie data={{ labels, datasets:[{ data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*83)%360} 70% 65%)`) }] }} options={pieOptions} /></div>
              if (b2Type==='bar') return <Bar data={{ labels, datasets:[{ label:'%', data: values, backgroundColor: 'rgba(234,88,12,0.4)', borderColor: 'rgb(234,88,12)' }] }} options={options} />
              return <Line data={{ labels, datasets:[{ label:'%', data: values, borderColor: 'rgb(59,130,246)', backgroundColor: 'rgba(59,130,246,0.3)' }] }} options={options} />
            })()}
          </div>

          {/* Block 3: KRA Score with Created-date filter */}
          <div id="b3" className="bg-white/20 backdrop-blur-md p-4 rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h4 className="font-medium text-white">KRA Scores</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={b3Basis} onChange={(e)=>setB3Basis(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="created">Created Date</option>
                  <option value="due">Due Date</option>
                  <option value="both">Both</option>
                </select>
                <select value={b3Type} onChange={(e)=>setB3Type(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="line">Line</option>
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                </select>
                <button onClick={()=>setB3FilterOpen(true)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Filter</button>
                <div className="relative">
                  <button onClick={()=>setExpB3Open(v=>!v)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Export</button>
                  {expB3Open && (
                    <div className="absolute right-0 top-10 bg-white border rounded shadow text-sm z-10 text-black">
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB3Open(false); exportSectionById('b3','kra-scores-created-filter','pdf'); }}>PDF</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB3Open(false); exportSectionById('b3','kra-scores-created-filter','png'); }}>PNG</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB3Open(false); exportSectionById('b3','kra-scores-created-filter','jpg'); }}>JPG</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(()=>{
              const range = makeRange(b3Filter);
              const inRange = (k) => {
                const cd = k.created_at ? new Date(k.created_at) : null;
                const dd = k.due_date ? new Date(k.due_date) : null;
                if (b3Basis === 'created') return cd && isWithinInterval(cd, range);
                if (b3Basis === 'due') return dd && isWithinInterval(dd, range);
                return (cd && isWithinInterval(cd, range)) || (dd && isWithinInterval(dd, range));
              };
              const byKra = new Map();
              myKPIs.forEach(k=>{
                if (!inRange(k)) return;
                if (!byKra.has(k.kra_id)) byKra.set(k.kra_id, []);
                byKra.get(k.kra_id).push(typeof k.progress==='number'? k.progress:0);
              });
              const labels = allKras.map(k=>k.name);
              const values = allKras.map(k=>{
                const arr = byKra.get(k.kra_id)||[]; if (!arr.length) return 0; return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
              });
              const options = { responsive:true, plugins:{ legend:{ display:false } }, scales: { x: { ticks: { color: '#FFF' } }, y: { ticks: { color: '#FFF' } } } };
              const pieOptions = { responsive:true, maintainAspectRatio:false, plugins: { legend: { labels: { color: '#FFF' } } } };

              if (b3Type==='pie') return <div className="h-56"><Pie data={{ labels, datasets:[{ data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*57)%360} 70% 65%)`) }] }} options={pieOptions} /></div>
              if (b3Type==='bar') return <Bar data={{ labels, datasets:[{ label:'Avg %', data: values, backgroundColor: 'rgba(16,185,129,0.4)', borderColor: 'rgb(16,185,129)' }] }} options={options} />
              return <Line data={{ labels, datasets:[{ label:'Avg %', data: values, borderColor: 'rgb(16,185,129)', backgroundColor: 'rgba(16,185,129,0.3)' }] }} options={options} />
            })()}
          </div>

          {/* Block 4: KPI Scores with Created-date filter per KRA */}
          <div id="b4" className="bg-white/20 backdrop-blur-md p-4 rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h4 className="font-medium text-white">KPI Scores (Created-date filter)</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={b4KraId} onChange={(e)=>setB4KraId(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="">All</option>
                  {allKras.map(k=> <option key={k.kra_id} value={k.kra_id}>{k.name}</option>)}
                </select>
                <select value={b4Type} onChange={(e)=>setB4Type(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="pie">Pie</option>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                </select>
                <button onClick={()=>setB4FilterOpen(true)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Filter</button>
                <div className="relative">
                  <button onClick={()=>setExpB4Open(v=>!v)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Export</button>
                  {expB4Open && (
                    <div className="absolute right-0 top-10 bg-white border rounded shadow text-sm z-10 text-black">
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB4Open(false); exportSectionById('b4','kpi-scores-created-filter','pdf'); }}>PDF</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB4Open(false); exportSectionById('b4','kpi-scores-created-filter','png'); }}>PNG</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB4Open(false); exportSectionById('b4','kpi-scores-created-filter','jpg'); }}>JPG</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(()=>{
              const range = makeRange(b4Filter);
              const list = myKPIs.filter(k=>{
                const d = k.created_at ? new Date(k.created_at) : null;
                if (!d || !isWithinInterval(d, range)) return false;
                if (b4KraId) return String(k.kra_id)===String(b4KraId);
                return true;
              });
              const labels = list.map(k=>k.name);
              const values = list.map(k=> typeof k.progress==='number'? k.progress:0);
              const options = { responsive:true, plugins:{ legend:{ display:false } }, scales: { x: { ticks: { color: '#FFF' } }, y: { ticks: { color: '#FFF' } } } };
              const pieOptions = { responsive:true, maintainAspectRatio:false, plugins: { legend: { labels: { color: '#FFF' } } } };
              
              if (b4Type==='pie') return <div className="h-56"><Pie data={{ labels, datasets:[{ data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*83)%360} 70% 65%)`) }] }} options={pieOptions} /></div>
              if (b4Type==='bar') return <Bar data={{ labels, datasets:[{ label:'%', data: values, backgroundColor: 'rgba(234,88,12,0.4)', borderColor: 'rgb(234,88,12)' }] }} options={options} />
              return <Line data={{ labels, datasets:[{ label:'%', data: values, borderColor: 'rgb(59,130,246)', backgroundColor: 'rgba(59,130,246,0.3)' }] }} options={options} />
            })()}
          </div>

          {/* Block 5: Combined frequency charts (limited kinds) */}
          <div id="b5" className="bg-white/20 backdrop-blur-md p-4 rounded-lg shadow-xl lg:col-span-2">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h4 className="font-medium text-white">Frequency Charts</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={b5KraId} onChange={(e)=>setB5KraId(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="">All KRAs</option>
                  {allKras.map(k=> <option key={k.kra_id} value={k.kra_id}>{k.name}</option>)}
                </select>
                <select value={b5Basis} onChange={(e)=>setB5Basis(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="created">Created Date</option>
                  <option value="due">Due Date</option>
                  <option value="both">Both</option>
                </select>
                <select value={b5Type} onChange={(e)=>setB5Type(e.target.value)} className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black">
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
                <button onClick={()=>setB5FilterOpen(true)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Filter</button>
                <div className="relative">
                  <button onClick={()=>setExpB5Open(v=>!v)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Export</button>
                  {expB5Open && (
                    <div className="absolute right-0 top-10 bg-white border rounded shadow text-sm z-10 text-black">
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB5Open(false); exportSectionById('b5','frequency-combined','pdf'); }}>PDF</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB5Open(false); exportSectionById('b5','frequency-combined','png'); }}>PNG</button>
                      <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpB5Open(false); exportSectionById('b5','frequency-combined','jpg'); }}>JPG</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(()=>{
              const range = makeRangeLimited(b5Filter); // limited kinds
              // Shared controls: build both datasets using same range, basis and kra selection
              const sameMonth = (d1, d2) => d1 && d2 && d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth();
              const matchBasis = (k) => {
                const cd = k.created_at ? new Date(k.created_at) : null;
                const dd = k.due_date ? new Date(k.due_date) : null;
                if (b5Basis === 'created') return cd && isWithinInterval(cd, range);
                if (b5Basis === 'due') return dd && isWithinInterval(dd, range);
                if (!cd || !dd) return false;
                if (!sameMonth(cd, dd)) return false;
                return isWithinInterval(cd, range) && isWithinInterval(dd, range);
              };
              const byKra = new Map();
              myKPIs.forEach(k=>{
                if (!matchBasis(k)) return;
                if (!byKra.has(k.kra_id)) byKra.set(k.kra_id, []);
                byKra.get(k.kra_id).push(typeof k.progress==='number'? k.progress:0);
              });
              let kraLabels = allKras.map(k=>k.name);
              let kraValues = allKras.map(k=>{
                const arr = byKra.get(k.kra_id)||[]; if (!arr.length) return 0; return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
              });
              if (b5KraId) {
                const idx = allKras.findIndex(k=> String(k.kra_id)===String(b5KraId));
                if (idx >= 0) {
                  kraLabels = [kraLabels[idx]];
                  kraValues = [kraValues[idx]];
                } else {
                  kraLabels = [];
                  kraValues = [];
                }
              }

              const list = myKPIs.filter(k=>{
                if (!matchBasis(k)) return false;
                if (b5KraId) return String(k.kra_id)===String(b5KraId);
                return true;
              });
              const kpiLabels = list.map(k=>k.name);
              const kpiValues = list.map(k=> typeof k.progress==='number'? k.progress:0);
              
              const options = { responsive:true, plugins:{ legend:{ display:false } }, scales: { x: { ticks: { color: '#FFF' } }, y: { ticks: { color: '#FFF' } } } };
              const pieOptions = { responsive:true, maintainAspectRatio:false, plugins: { legend: { labels: { color: '#FFF' } } } };

              const render = (labels, values) => {
                if (b5Type==='pie') return <div className="h-56"><Pie data={{ labels, datasets:[{ data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*67)%360} 70% 65%)`) }] }} options={pieOptions} /></div>;
                if (b5Type==='bar') return <Bar data={{ labels, datasets:[{ label:'%', data: values, backgroundColor: 'rgba(99,102,241,0.4)', borderColor: 'rgb(99,102,241)' }] }} options={options} />;
                return <Line data={{ labels, datasets:[{ label:'%', data: values, borderColor: 'rgb(99,102,241)', backgroundColor: 'rgba(99,102,241,0.3)' }] }} options={options} />;
              };

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium mb-2 text-white">KRA Scores</h5>
                    {render(kraLabels, kraValues)}
                  </div>
                  <div>
                    <h5 className="font-medium mb-2 text-white">KPI Scores {b5KraId?`(KRA)`:''}</h5>
                    {render(kpiLabels, kpiValues)}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Block Filter Modals */}
        {b3FilterOpen && (
          <FilterModal title="KRA Scores Filter" filter={b3Filter} setFilter={setB3Filter} onClose={()=>setB3FilterOpen(false)} allowAllKinds={true} />
        )}
        {b4FilterOpen && (
          <FilterModal title="KPI Scores Filter" filter={b4Filter} setFilter={setB4Filter} onClose={()=>setB4FilterOpen(false)} allowAllKinds={true} />
        )}
        {b5FilterOpen && (
          <FilterModal title="Frequency Filter" filter={b5Filter} setFilter={setB5Filter} onClose={()=>setB5FilterOpen(false)} allowAllKinds={false} />
        )}
      </div>
    ),
    tasks: (
      <div className="bg-white/20 backdrop-blur-md p-6 rounded-lg shadow-xl mb-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-xl font-semibold text-white">My KPIs</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <select className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black" value={empTasksFilter} onChange={(e)=>setEmpTasksFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="end">End</option>
              <option value="all">All</option>
            </select>
            <select className="p-2 border border-white/30 rounded text-sm bg-white/80 text-black" value={empTasksKraFilter} onChange={(e)=>setEmpTasksKraFilter(e.target.value)}>
              <option value="">All KRAs</option>
              {allKras.map(k=> (<option key={k.kra_id} value={k.kra_id}>{k.name}</option>))}
            </select>
            <div className="relative">
              <button onClick={()=>setExpTasksOpen(v=>!v)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Export</button>
              {expTasksOpen && (
                <div className="absolute right-0 top-10 bg-white border rounded shadow text-sm z-10 text-black">
                  <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpTasksOpen(false); exportSectionById('emp-tasks-wrap','my-kpis','pdf'); }}>PDF</button>
                  <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpTasksOpen(false); exportTableToCSV('#emp-tasks-table','my-kpis.csv'); }}>CSV</button>
                  <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{ setExpTasksOpen(false); exportTableToExcel('#emp-tasks-table','my-kpis.xls'); }}>Excel</button>
                </div>
              )}
            </div>
            <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={() => navigate('/create_kpi')}>Create KPI</button>
          </div>
        </div>
        <div id="emp-tasks-wrap" className="overflow-x-auto bg-black/20 rounded-lg shadow-inner">
          <table id="emp-tasks-table" className="w-full">
            <thead>
              <tr className="border-b border-white/20 bg-white/20">
                <th className="text-left p-3 text-white">KRA</th>
                <th className="text-left p-3 text-white">KPI Name</th>
                <th className="text-left p-3 text-white">Progress</th>
                <th className="text-left p-3 text-white">Target</th>
                <th className="text-left p-3 text-white">Due Date</th>
                <th className="text-left p-3 text-white">Status</th>
                <th className="text-left p-3 text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(function(){
                const today = new Date(); today.setHours(0,0,0,0);
                let list = myKPIs;
                if (empTasksKraFilter) list = list.filter(k=> String(k.kra_id)===String(empTasksKraFilter));
                list = list.filter(k=>{
                  const due = k.due_date ? new Date(k.due_date) : null;
                  if (empTasksFilter==='all') return true;
                  if (empTasksFilter==='active') return !due || due >= today;
                  return !!due && due < today;
                });
                return list;
              })().map((kpi) => {
                const st = getStatusInfo(kpi.progress, kpi.target);
                return (
                  <tr key={kpi.id} className="border-b border-white/20 hover:bg-white/5">
                    <td className="p-3 text-white">{kpi.kra_name || '-'}</td>
                    <td className="p-3 font-medium text-white">{kpi.name}</td>
                    <td className="p-3 text-white">{kpi.progress}%</td>
                    <td className="p-3 text-white">{kpi.target ?? 100}%</td>
                    <td className="p-3 text-white">{kpi.due_date ? new Date(kpi.due_date).toLocaleDateString() : '-'}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${st.color}`}>{st.label}</span></td>
                    <td className="p-3 flex gap-3">
                      {(() => {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const isOverdue = kpi.due_date ? new Date(kpi.due_date) < today : false;
                        if (isOverdue) {
                          return (
                            <button onClick={() => removeKpi(kpi.id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                          );
                        }
                        return (
                          <>
                            <button onClick={() => openScoreModal(kpi)} className="text-blue-300 hover:text-blue-100 text-sm">View</button>
                            <button onClick={() => openEditModal(kpi)} className="text-indigo-300 hover:text-indigo-100 text-sm">Edit</button>
                            <button onClick={() => removeKpi(kpi.id)} className="text-red-400 hover:text-red-300 text-sm">Remove</button>
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    ),
    kras: (
      <div id="kras-section" className="bg-white/20 backdrop-blur-md p-6 rounded-lg shadow-xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">My KRAs</h3>
          <div className="relative">
            <button onClick={()=>setExpKrasOpen(v=>!v)} className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500">Export</button>
            {expKrasOpen && (
              <div className="absolute right-0 top-10 bg-white border rounded shadow text-sm z-10 text-black">
                <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{
                  setExpKrasOpen(false);
                  const today = new Date(); today.setHours(0,0,0,0);
                  const rows = recentKRAs.map(k=>{
                    const arr = myKPIs.filter(x=> String(x.kra_id)===String(k.kra_id) && (
                      x.kpi_status ? String(x.kpi_status).toLowerCase()==='active' : (!x.due_date || new Date(x.due_date) >= today)
                    )).map(x=> typeof x.progress==='number'? x.progress:0);
                    const overall = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
                    return [
                      (k.name||'').replaceAll(',',' '),
                      (k.definition||'').replaceAll(',',' '),
                      k.due_date ? new Date(k.due_date).toLocaleDateString() : '-',
                      overall
                    ];
                  });
                  const header = ['KRA','Definition','Due Date','Overall %'];
                  const csv = [header, ...rows].map(r=>r.join(',')).join('\n');
                  downloadBlob('kras.csv', csv, 'text/csv;charset=utf-8;');
                }}>CSV</button>
                <button className="block px-3 py-2 hover:bg-gray-100 w-full text-left" onClick={()=>{
                  setExpKrasOpen(false);
                  const table = document.createElement('table');
                  const today = new Date(); today.setHours(0,0,0,0);
                  const rowsHtml = recentKRAs.map(k=>{
                    const arr = myKPIs.filter(x=> String(x.kra_id)===String(k.kra_id) && (
                      x.kpi_status ? String(x.kpi_status).toLowerCase()==='active' : (!x.due_date || new Date(x.due_date) >= today)
                    )).map(x=> typeof x.progress==='number'? x.progress:0);
                    const overall = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
                    return `<tr><td>${k.name||''}</td><td>${k.definition||''}</td><td>${k.due_date? new Date(k.due_date).toLocaleDateString():'-'}</td><td>${overall}</td></tr>`;
                  }).join('');
                  table.innerHTML = `
                    <thead><tr><th>KRA</th><th>Definition</th><th>Due Date</th><th>Overall %</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>`;
                  const html = `\uFEFF<html><head><meta charset=\"UTF-8\"></head><body>${table.outerHTML}</body></html>`;
                  downloadBlob('kras.xls', html, 'application/vnd.ms-excel');
                }}>Excel</button>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentKRAs.map((kra) => (
            <div key={kra.kra_id} className="border border-white/30 bg-white/10 rounded p-4">
              <h4 className="font-medium mb-2 text-white">{kra.name}</h4>
              <p className="text-sm text-gray-200 mb-3">{kra.definition}</p>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-gray-300">Due: {new Date(kra.due_date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-100">Overall: {(() => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const arr = myKPIs.filter(x=> String(x.kra_id)===String(kra.kra_id) && (
                    x.kpi_status ? String(x.kpi_status).toLowerCase()==='active' : (!x.due_date || new Date(x.due_date) >= today)
                  )).map(x=> typeof x.progress==='number'? x.progress:0);
                  const overall = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
                  return overall;
                })()}%</span>
                <button
                  onClick={() => handleKpiClick(kra.kra_id)}
                  className="text-blue-300 hover:text-blue-100 text-sm font-medium"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    comments: (
      <div className="bg-white/20 backdrop-blur-md p-6 rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-xl font-semibold text-white">Comments</h3>
          <div className="flex items-center gap-2">
            <input type="number" className="p-2 border border-white/30 rounded w-24 bg-white/80 text-black" value={perfFilter.year} onChange={(e)=>setPerfFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
            <select className="p-2 border border-white/30 rounded bg-white/80 text-black" value={perfFilter.month} onChange={(e)=>setPerfFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
              {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          {perfReviews.map((r, idx)=> (
            <div key={idx} className="border border-white/30 bg-white/10 rounded p-3">
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span><span className="font-medium text-gray-100">KRA:</span> {r.kra_name}</span>
                <span>{r.review_at ? new Date(r.review_at).toLocaleDateString() : ''}</span>
              </div>
              <div className="text-sm mt-1 text-white"><span className="font-medium text-gray-100">Score:</span> {r.score}</div>
              <div className="text-sm mt-1 text-white"><span className="font-medium text-gray-100">Comment:</span> <span dangerouslySetInnerHTML={{ __html: r.comment ? renderCommentHtml(r.comment) : '-' }} /></div>
            </div>
          ))}
          {perfReviews.length===0 && (
            <div className="text-gray-200">No comments for this month.</div>
          )}
        </div>
      </div>
    ),
  };

  return (
    <div 
      className="min-h-screen text-white p-4 md:p-8"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Navigation Tabs */}
        <div className="flex gap-1 sm:gap-2 mb-8 flex-wrap border-b border-white/30">
          {Object.keys(sections).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-3 sm:px-4 py-2 rounded font-medium text-sm sm:text-base transition-colors ${
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
        {celebrate && (
          <div key={celebrateKey} className="fixed inset-0 z-[60] pointer-events-none">
            <style>{`
              @keyframes fw-pop { 0%{transform:scale(0);opacity:1} 80%{transform:scale(1);opacity:1} 100%{transform:scale(1.1);opacity:0} }
              @keyframes fw-move { 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(var(--dx),var(--dy));opacity:0} }
            `}</style>
            <div className="absolute inset-0">
              {Array.from({length:24}).map((_,i)=>{
                const angle = (i*15)%360;
                const dist = 120 + (i%6)*15;
                const dx = Math.cos(angle*Math.PI/180)*dist;
                const dy = Math.sin(angle*Math.PI/180)*dist;
                const left = 50 + Math.cos((i*23)%360*Math.PI/180)*20;
                const top = 40 + Math.sin((i*37)%360*Math.PI/180)*20;
                const color = `hsl(${(i*37)%360} 90% 55%)`;
                return (
                  <span
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: 8,
                      height: 8,
                      background: color,
                      animation: `fw-move 900ms ease-out forwards`,
                      ['--dx']: `${dx}px`,
                      ['--dy']: `${dy}px`,
                    }}
                  />
                );
              })}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-white/40" style={{animation:'fw-pop 800ms ease-out forwards'}} />
              </div>
            </div>
          </div>
        )}
        {/* KRA Details Modal */}
        {kraModalOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md text-white w-full max-w-3xl rounded-lg shadow-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">KRA: {kraModalName}</h3>
                  <p className="text-sm text-gray-200">Overall: <span className="font-semibold text-indigo-300">{kraModalAgg}%</span></p>
                </div>
                <button onClick={() => setKraModalOpen(false)} className="text-gray-100 hover:text-white text-2xl">✕</button>
              </div>
              {kraModalLoading ? (
                <div className="text-white">Loading...</div>
              ) : (
                <div className="space-y-4 max-h-[75vh] overflow-auto">
                  {kraModalKpis.map(kpi => (
                    <div key={kpi.id} className="border border-white/30 bg-white/10 rounded p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold text-white">{kpi.name}</h4>
                          <p className="text-sm text-gray-200">Due: {new Date(kpi.due_date).toLocaleDateString()} • Method: {kpi.scoring_method} • {typeof kpi.percentage === 'number' ? `Current: ${kpi.percentage}%` : 'No score yet'}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-100">Score</label>
                          <div className="text-base font-medium text-gray-100">
                            {kpi.scoring_method === 'Percentage' && `${kpi.score ?? 0}%`}
                            {(kpi.scoring_method === 'Scale (1-5)' || kpi.scoring_method === 'Rating') && `${kpi.score ?? 0} / 5`}
                            {kpi.scoring_method === 'Scale (1-10)' && `${kpi.score ?? 0} / 10`}
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1 text-gray-100">Comments</label>
                          <div className="p-2 border border-white/30 rounded bg-black/20 min-h-[48px]">
                            <span dangerouslySetInnerHTML={{ __html: kpi.comments ? renderCommentHtml(kpi.comments) : '-' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {kraModalKpis.length === 0 && (
                    <div className="p-4 border border-white/30 rounded text-gray-200">No KPIs created for this KRA yet.</div>
                  )}
                  <div className="flex justify-end pt-2 gap-2">
                    <button onClick={submitKraModalNotify} className="px-4 py-2 rounded bg-indigo-600 text-white">Submit</button>
                    <button onClick={() => setKraModalOpen(false)} className="px-4 py-2 rounded bg-white/20 border border-white/30 hover:bg-white/10 text-white">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Edit KPI Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md text-white w-full max-w-lg rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Edit KPI</h3>
                <button onClick={() => setEditModalOpen(false)} className="text-gray-100 hover:text-white text-2xl">✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Name</label>
                  <input className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={editForm.name} onChange={(e)=>setEditForm({...editForm,name:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Due Date</label>
                  <input type="date" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={editForm.due_date} onChange={(e)=>setEditForm({...editForm,due_date:e.target.value})} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1 text-gray-100">Definition</label>
                  <textarea className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" rows={2} value={editForm.def} onChange={(e)=>setEditForm({...editForm,def:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Target (0-100)</label>
                  <input type="number" min="0" max="100" className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={editForm.target} onChange={(e)=>setEditForm({...editForm,target:e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-100">Scoring Method</label>
                  <select className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={editForm.scoring_method} onChange={(e)=>setEditForm({...editForm,scoring_method:e.target.value})}>
                    <option value="Percentage">Percentage</option>
                    <option value="Scale (1-5)">Scale (1-5)</option>
                    <option value="Scale (1-10)">Scale (1-10)</option>
                    <option value="Rating">Rating</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={()=>setEditModalOpen(false)} className="px-4 py-2 rounded border border-white/30 text-white hover:bg-white/10">Cancel</button>
                <button onClick={submitEditModal} className="px-4 py-2 rounded bg-indigo-600 text-white">Update</button>
              </div>
            </div>
          </div>
        )}
        {/* Score KPI Modal */}
        {scoreModalOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md text-white w-full max-w-md rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Score KPI{scoreModalKpi ? `: ${scoreModalKpi.name}` : ''}</h3>
                <button onClick={() => setScoreModalOpen(false)} className="text-gray-100 hover:text-white text-2xl">✕</button>
              </div>
              {scoreModalKpi && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-100">Score</label>
                    {/* Render appropriate input by method */}
                    {scoreModalKpi.scoring_method === 'Percentage' && (
                      <div className="flex items-center gap-2">
                        <input type="range" min={0} max={100} value={scoreModalValue === '' ? 0 : Number(scoreModalValue)} onChange={(e) => setScoreModalValue(e.target.value)} />
                        <span className="w-12 text-right">{scoreModalValue || 0}%</span>
                      </div>
                    )}
                    {scoreModalKpi.scoring_method === 'Scale (1-5)' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const val = idx + 1;
                          const active = Number(scoreModalValue) >= val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setScoreModalValue(String(val))}
                              className={`px-3 py-1 rounded border ${active ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white border-white/30'}`}
                            >
                              {val}
                            </button>
                          );
                        })}
                        <span className="text-sm">{scoreModalValue || 0} / 5</span>
                      </div>
                    )}
                    {scoreModalKpi.scoring_method === 'Scale (1-10)' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const val = idx + 1;
                          const active = Number(scoreModalValue) >= val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setScoreModalValue(String(val))}
                              className={`px-2 py-1 rounded border ${active ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white border-white/30'}`}
                            >
                              {val}
                            </button>
                          );
                        })}
                        <span className="text-sm">{scoreModalValue || 0} / 10</span>
                      </div>
                    )}
                    {scoreModalKpi.scoring_method === 'Rating' && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, idx) => {
                            const val = idx + 1;
                            const active = Number(scoreModalValue) >= val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setScoreModalValue(String(val))}
                                className={`text-4xl ${active ? 'text-yellow-400' : 'text-white/30'}`}
                                title={`${val}`}
                              >
                                ★
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-sm whitespace-nowrap">{scoreModalValue || 0} / 5</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium mb-1 text-gray-100">Comments</label>
                      <button type="button" onClick={() => openLinkModal('score')} className="text-xs text-indigo-300 underline">Insert Link</button>
                    </div>
                    <textarea className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" rows={3} value={scoreModalComments} onChange={(e) => setScoreModalComments(e.target.value)} placeholder="Add comments (optional)" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setScoreModalOpen(false)} className="px-4 py-2 rounded border border-white/30 text-white hover:bg-white/10">Cancel</button>
                    <button onClick={submitScoreModal} className="px-4 py-2 rounded bg-indigo-600 text-white">Update</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Submit Toast */}
        {submitToast && (
          <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded shadow z-50">Submitted. Manager notified.</div>
        )}
        {/* Insert Link Modal */}
        {linkModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
            <div className="bg-white/20 backdrop-blur-md text-white w-full max-w-sm rounded-lg shadow-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-white">Insert Link</h4>
                <button onClick={closeLinkModal} className="text-gray-100 hover:text-white text-2xl">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1 text-gray-100">Link Text (Name)</label>
                  <input className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" value={linkName} onChange={(e)=>setLinkName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-100">URL (http or https)</label>
                  <input className="w-full p-2 border border-white/30 rounded bg-white/80 text-black" placeholder="https://..." value={linkUrl} onChange={(e)=>setLinkUrl(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={closeLinkModal} className="px-4 py-2 rounded border border-white/30 text-white hover:bg-white/10">Cancel</button>
                <button onClick={confirmLinkModal} className="px-4 py-2 rounded bg-indigo-600 text-white" disabled={!linkName || !/^https?:\/\//i.test(linkUrl)}>Insert</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}