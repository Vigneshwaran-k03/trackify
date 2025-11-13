import { useState, useEffect } from 'react';
import { Doughnut, PolarArea, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, RadialLinearScale, Filler, Title, Tooltip, Legend);
import axios from 'axios';
import { getToken, getRole, getUserName } from '../../utils/authStorage';
import { exportSectionById, exportTableToCSV, exportTableToExcel } from '../../utils/exportUtils';

// --- IMPORTANT ---
// Import your background image.
// You may need to change this path depending on your folder structure.
import bgImage from '../../assets/background.png';

export default function AdminDashboard() {
  const [userName, setUserName] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [depts, setDepts] = useState([]);
  const [companyStats, setCompanyStats] = useState({});
  const [managerPerformance, setManagerPerformance] = useState([]);
  const [kras, setKras] = useState([]);
  // Review state (Admin reviewing Managers)
  const [managers, setManagers] = useState([]);
  const [revDept, setRevDept] = useState('');
  const [revDeptManagers, setRevDeptManagers] = useState([]);
  const [revManagerId, setRevManagerId] = useState('');
  const [revKraId, setRevKraId] = useState('');
  const [revScore, setRevScore] = useState('');
  const [revComment, setRevComment] = useState('');
  const [myReviews, setMyReviews] = useState([]);
  const [revEditOpen, setRevEditOpen] = useState(false);
  const [revEditForm, setRevEditForm] = useState({ id: 0, score: '', comment: '', review_at: '' });
  const [revActiveKpis, setRevActiveKpis] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');
  // Overview section filter and aggregates
  const [ovFilter, setOvFilter] = useState({ mode: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth()+1 });
  const [ovDeptAverages, setOvDeptAverages] = useState({});
  const [ovCompanyAverage, setOvCompanyAverage] = useState(0);
  // Company trend (monthly over selected year)
  const [companyTrend, setCompanyTrend] = useState({ labels: [], values: [] });
  const [companyTrendDelta, setCompanyTrendDelta] = useState(0);
  // Departments section filter and aggregates
  const [depFilter, setDepFilter] = useState({ mode: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth()+1 });
  const [depDeptAverages, setDepDeptAverages] = useState({});
  const [deptCounts, setDeptCounts] = useState({ managers: 0, employees: 0, kras: 0, kpis: 0 });
  // Horizontal bar chart dedicated state and filter
  const [hbDept, setHbDept] = useState('__all__');
  const [hbManagers, setHbManagers] = useState([]);
  const [hbManagerId, setHbManagerId] = useState('');
  const [hbSeries, setHbSeries] = useState({ labels: [], values: [] });
  const [hbLoading, setHbLoading] = useState(false);
  const [hbFilter, setHbFilter] = useState({ mode: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth()+1 });
  // KRA filters (dept -> manager -> employee)
  const [kraDept, setKraDept] = useState('');
  const [kraManagers, setKraManagers] = useState([]); // options for manager select (by dept)
  const [kraManagerId, setKraManagerId] = useState('');
  const [kraEmployees, setKraEmployees] = useState([]); // options for employee select (by dept/manager)
  const [deptEmployeeCache, setDeptEmployeeCache] = useState([]); // cached employees for current dept
  const [kraEmployeeName, setKraEmployeeName] = useState('');
  // KRA modal for KPI details
  const [kraModalOpen, setKraModalOpen] = useState(false);
  const [kraModalState, setKraModalState] = useState({ kra: null, kpis: [], aggregate: null, loading: false });
  // Admin: direct assignment change modal
  const [assignModal, setAssignModal] = useState({ open: false, kraId: null, manager_name: '', employee_name: '' });
  const [exportOpen, setExportOpen] = useState(false);

  const renderCommentHtml = (text) => {
    if (!text) return '';
    const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const esc = escapeHtml(String(text));
    const withMd = esc.replace(/\[(.+?)\]\s*\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
      const safeLabel = label;
      const safeUrl = url;
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline">${safeLabel}</a>`;
    });
    return withMd.replace(/(?<![\w"'=])(https?:\/\/[^\s)]+)(?![^<]*>)/g, (m, url) => {
      const safeUrl = url;
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline">${safeUrl}</a>`;
    });
  };

  const openAssignModal = async (kra) => {
    try {
      const res = await axios.get(`http://localhost:3000/kra/${kra.kra_id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const k = res.data?.data || kra;
      setAssignModal({ open: true, kraId: k.kra_id, manager_name: k.manager_name || '', employee_name: k.employee_name || '' });
    } catch (_) {
      setAssignModal({ open: true, kraId: kra.kra_id, manager_name: kra.manager_name || '', employee_name: kra.employee_name || '' });
    }
  };

  const submitAssign = async () => {
    try {
      if (!assignModal.kraId) return;
      await axios.post(`http://localhost:3000/kra/${assignModal.kraId}/assign`, {
        manager_name: assignModal.manager_name === '' ? null : assignModal.manager_name,
        employee_name: assignModal.employee_name === '' ? null : assignModal.employee_name,
      }, { headers: { Authorization: `Bearer ${getToken()}` } });
      setAssignModal({ open: false, kraId: null, manager_name: '', employee_name: '' });
      // refresh KRAs list
      fetchAllKRAs();
      // if kra modal open, refresh its details
      if (kraModalOpen && kraModalState.kra) {
        openKraModal(kraModalState.kra);
      }
      alert('KRA updated');
    } catch (_) {}
  };

  // Performance section state
  const [perfDept, setPerfDept] = useState('');
  const [perfManagers, setPerfManagers] = useState([]);
  const [perfEmployees, setPerfEmployees] = useState([]);
  const [perfManagerId, setPerfManagerId] = useState('');
  const [perfEmployeeId, setPerfEmployeeId] = useState('');
  const [perfFilter, setPerfFilter] = useState({ mode: 'monthly', year: new Date().getFullYear(), month: new Date().getMonth()+1 });
  const [perfDeptAvg, setPerfDeptAvg] = useState(0);
  const [perfManagerAvg, setPerfManagerAvg] = useState(0);
  const [perfEmployeeAvg, setPerfEmployeeAvg] = useState(0);
  const [perfMgrKraBars, setPerfMgrKraBars] = useState({ labels: [], values: [] });
  const [perfEmpKraBars, setPerfEmpKraBars] = useState({ labels: [], values: [] });
  const [perfLoading, setPerfLoading] = useState({ dept:false, manager:false, employee:false });

  const openKraModal = async (kra) => {
    setKraModalOpen(true);
    setKraModalState({ kra, kpis: [], aggregate: null, loading: true });
    try {
      const [kpisRes, aggRes] = await Promise.all([
        axios.get(`http://localhost:3000/scoring/kra/${kra.kra_id}`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        axios.get(`http://localhost:3000/scoring/kra/${kra.kra_id}/aggregate`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      setKraModalState({
        kra,
        kpis: kpisRes.data?.data || [],
        aggregate: aggRes.data?.data || null,
        loading: false,
      });
    } catch (_) {
      setKraModalState(prev => ({ ...prev, loading: false }));
    }
  };

  // Review: when department changes, load managers of that dept
  useEffect(() => {
    const run = async () => {
      try {
        if (!revDept) { setRevDeptManagers([]); return; }
        const list = await fetchManagersByDept(revDept);
        setRevDeptManagers(list || []);
      } catch (_) { setRevDeptManagers([]); }
    };
    // reset selections on dept change
    setRevManagerId('');
    setRevKraId('');
    setRevActiveKpis([]);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revDept]);
//summary
  // Review: when KRA changes, load its active KPIs
  useEffect(() => {
    const run = async () => {
      try {
        if (!revKraId) { setRevActiveKpis([]); return; }
        const res = await axios.get(`http://localhost:3000/scoring/kra/${revKraId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
        const items = res.data?.data || [];
        const today = new Date(); today.setHours(0,0,0,0);
        const active = items.filter(i => {
          if (i.kpi_status) return String(i.kpi_status).toLowerCase() === 'active';
          return !i.due_date || new Date(i.due_date) >= today;
        });
        setRevActiveKpis(active);
      } catch (_) { setRevActiveKpis([]); }
    };
    run();
  }, [revKraId]);

  const computeUserAverage = async (userId, filter) => {
    try {
      if (!userId) return 0;
      if (filter.mode === 'monthly') {
        const list = await fetchUserMonthlyReviews(userId, filter.year, filter.month);
        const scores = (list || []).map(r => (typeof r.score === 'number' ? r.score : Number(r.score || 0))).filter(v => !Number.isNaN(v));
        if (!scores.length) return 0;
        return Math.round((scores.reduce((a,b)=>a+b,0) / scores.length) * 100) / 100;
      }
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const arrs = await Promise.all(months.map(mm => fetchUserMonthlyReviews(userId, filter.year, mm)));
      const list = arrs.flat();
      const scores = (list || []).map(r => (typeof r.score === 'number' ? r.score : Number(r.score || 0))).filter(v => !Number.isNaN(v));
      if (!scores.length) return 0;
      return Math.round((scores.reduce((a,b)=>a+b,0) / scores.length) * 100) / 100;
    } catch (_) { return 0; }
  };

  const closeKraModal = () => {
    setKraModalOpen(false);
  };

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    const name = getUserName() || 'Admin';

    if (!token || (role || '').toLowerCase() !== 'admin') {
      window.location.href = '/login';
      return;
    }

    setUserName(name);

    // Fetch all admin-specific data
    fetchCompanyStats();
    fetchDepts();
    fetchManagerPerformance();
    fetchAllKRAs();
    fetchManagers();
  }, []);

  const fetchCompanyStats = async () => {
    try {
      const response = await axios.get('http://localhost:3000/users/company/stats', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setCompanyStats(response.data);
    } catch (error) {
      console.error('Error fetching company stats:', error);
    }
  };

  const uniqueFromKras = (arr, key) => {
    const set = new Set();
    const out = [];
    (arr || []).forEach((k) => {
      const v = (k?.[key] ?? '') || '';
      const norm = String(v).trim().toLowerCase();
      if (v && !set.has(norm)) { set.add(norm); out.push(v); }
    });
    return out;
  };

  const fetchManagersByDept = async (deptName) => {
    try {
      const res = await axios.get(`http://localhost:3000/users/department/${encodeURIComponent(deptName)}/managers`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      return res.data || [];
    } catch (_) { return []; }
  };

  const fetchEmployeesByDept = async (deptName) => {
    try {
      const res = await axios.get(`http://localhost:3000/users/department/${encodeURIComponent(deptName)}/employees`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      return res.data || [];
    } catch (_) { return []; }
  };

  const fetchUserMonthlyReviews = async (userId, year, month) => {
    try {
      const res = await axios.get(`http://localhost:3000/review/employee/${userId}/month`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        params: { year, month }
      });
      return res.data?.data || [];
    } catch (_) { return []; }
  };

  const computeDeptAverage = async (deptName, filter) => {
    const mgrs = await fetchManagersByDept(deptName);
    const emps = await fetchEmployeesByDept(deptName);
    let allReviews = [];
    if (filter.mode === 'monthly') {
      const [mgrLists, empLists] = await Promise.all([
        Promise.all(mgrs.map(m => fetchUserMonthlyReviews(m.user_id, filter.year, filter.month))),
        Promise.all(emps.map(e => fetchUserMonthlyReviews(e.user_id, filter.year, filter.month))),
      ]);
      allReviews = mgrLists.flat().concat(empLists.flat());
    } else {
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const [mgrLists, empLists] = await Promise.all([
        Promise.all(mgrs.map(async (m) => {
          const arrs = await Promise.all(months.map(mm => fetchUserMonthlyReviews(m.user_id, filter.year, mm)));
          return arrs.flat();
        })),
        Promise.all(emps.map(async (e) => {
          const arrs = await Promise.all(months.map(mm => fetchUserMonthlyReviews(e.user_id, filter.year, mm)));
          return arrs.flat();
        })),
      ]);
      allReviews = mgrLists.flat().concat(empLists.flat());
    }
    const scores = allReviews.map(r => (typeof r.score === 'number' ? r.score : Number(r.score || 0))).filter(v => !Number.isNaN(v));
    if (!scores.length) return 0;
    return Math.round((scores.reduce((a,b)=>a+b,0) / scores.length) * 100) / 100;
  };

  const refreshDeptAndCompanyAveragesWithFilter = async (filter, setMap, setAvg) => {
    const names = (depts || []).map(d => d.name).filter(Boolean);
    if (!names.length) { setMap({}); setAvg?.(0); return; }
    const entries = await Promise.all(names.map(async (nm) => [nm, await computeDeptAverage(nm, filter)]));
    const map = {};
    let sum = 0; let count = 0;
    entries.forEach(([k, v]) => { map[k] = v; if (typeof v === 'number') { sum += v; count++; } });
    setMap(map);
    if (setAvg) setAvg(count ? Math.round((sum / count) * 100) / 100 : 0);
  };

  const fetchDepts = async () => {
    try {
      const response = await axios.get('http://localhost:3000/departments', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setDepts(response.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchManagerPerformance = async () => {
    try {
      const response = await axios.get('http://localhost:3000/users/managers/performance', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setManagerPerformance(response.data);
    } catch (error) {
      console.error('Error fetching manager performance:', error);
    }
  };

  const fetchAllKRAs = async () => {
    try {
      const response = await axios.get('http://localhost:3000/kra', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setKras(response.data.data || []);
    } catch (error) {
      console.error('Error fetching KRAs:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const res = await axios.get('http://localhost:3000/users/managers', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setManagers(res.data || []);
    } catch (e) {
      setManagers([]);
    }
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

  useEffect(() => {
    if (activeSection === 'review') {
      fetchMyReviews();
    }
  }, [activeSection]);

  // Overview section averages
  useEffect(() => {
    if (!depts || !depts.length) return;
    refreshDeptAndCompanyAveragesWithFilter(ovFilter, setOvDeptAverages, setOvCompanyAverage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depts, ovFilter.mode, ovFilter.year, ovFilter.month]);

  // Build company monthly trend for selected year (average across depts per month)
  useEffect(() => {
    const run = async () => {
      try {
        if (!depts || !depts.length || !ovFilter?.year) { setCompanyTrend({ labels: [], values: [] }); setCompanyTrendDelta(0); return; }
        const now = new Date();
        const maxMonth = (ovFilter.year === now.getFullYear()) ? (now.getMonth() + 1) : 12;
        const months = Array.from({ length: maxMonth }, (_, i) => i + 1);
        const labels = months.map(m => new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'short' }));
        const values = [];
        for (const m of months) {
          const entries = await Promise.all((depts || []).map(async d => await computeDeptAverage(d.name, { mode: 'monthly', year: ovFilter.year, month: m })));
          const nums = entries.filter(v => typeof v === 'number' && !Number.isNaN(v));
          const avg = nums.length ? Math.round((nums.reduce((a,b)=>a+b,0) / nums.length) * 100) / 100 : 0;
          values.push(avg);
        }
        setCompanyTrend({ labels, values });
        const nums = values.filter(v => typeof v === 'number');
        const cur = nums.length ? nums[nums.length - 1] : undefined;
        const prev = nums.length > 1 ? nums[nums.length - 2] : undefined;
        const delta = (typeof cur === 'number' && typeof prev === 'number') ? Math.round((cur - prev) * 100) / 100 : 0;
        setCompanyTrendDelta(delta);
      } catch (_) {
        setCompanyTrend({ labels: [], values: [] });
        setCompanyTrendDelta(0);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depts, ovFilter.year]);

  // Departments section averages
  useEffect(() => {
    if (!depts || !depts.length) return;
    refreshDeptAndCompanyAveragesWithFilter(depFilter, setDepDeptAverages, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depts, depFilter.mode, depFilter.year, depFilter.month]);

  useEffect(() => {
    const run = async () => {
      try {
        setHbLoading(true);
        if (!depts || !depts.length) { setHbSeries({ labels: [], values: [] }); return; }
        if (!hbDept || hbDept === '__all__') {
          const labels = (depts || []).map(d => d.name);
          const values = await Promise.all(labels.map(async nm => await computeDeptAverage(nm, hbFilter)));
          setHbManagers([]);
          setHbManagerId('');
          setHbSeries({ labels, values });
          return;
        }
        const mgrs = await fetchManagersByDept(hbDept);
        setHbManagers(mgrs);
        if (hbManagerId) {
          const mgr = (mgrs || []).find(m => String(m.user_id) === String(hbManagerId));
          const mgrName = mgr?.name || '';
          const mgrAvg = mgr ? await computeUserAverage(mgr.user_id, hbFilter) : 0;
          let empList = await fetchEmployeesByDept(hbDept);
          const allowedNames = new Set((kras || []).filter(k => String(k.dept || '') === String(hbDept) && String(k.created_by || '').toLowerCase() === String(mgrName).toLowerCase() && k.employee_name).map(k => String(k.employee_name)));
          const employees = (empList || []).filter(e => allowedNames.has(String(e.name)));
          const pairs = await Promise.all(employees.map(async e => [e.name, await computeUserAverage(e.user_id, hbFilter)]));
          const labels = ['Manager Avg'].concat(pairs.map(p => p[0]));
          const values = [mgrAvg].concat(pairs.map(p => p[1]));
          setHbSeries({ labels, values });
        } else {
          const deptAvg = await computeDeptAverage(hbDept, hbFilter);
          const pairs = await Promise.all((mgrs || []).map(async m => [m.name, await computeUserAverage(m.user_id, hbFilter)]));
          const labels = [hbDept].concat(pairs.map(p => p[0]));
          const values = [deptAvg].concat(pairs.map(p => p[1]));
          setHbSeries({ labels, values });
        }
      } catch (_) {
        setHbSeries({ labels: [], values: [] });
      } finally {
        setHbLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hbDept, hbManagerId, depts, hbFilter.mode, hbFilter.year, hbFilter.month, kras]);

  // Performance: when dept changes load managers and employees
  useEffect(() => {
    const run = async () => {
      try {
        if (!perfDept) { setPerfManagers([]); setPerfEmployees([]); setPerfDeptAvg(0); return; }
        const [mgrs, emps, avg] = await Promise.all([
          fetchManagersByDept(perfDept),
          fetchEmployeesByDept(perfDept),
          computeDeptAverage(perfDept, perfFilter),
        ]);
        setPerfManagers(mgrs || []);
        setPerfEmployees((emps || []).map(e => ({ user_id: e.user_id, name: e.name })));
        setPerfDeptAvg(avg || 0);
      } catch (_) {
        setPerfManagers([]); setPerfEmployees([]); setPerfDeptAvg(0);
      }
      setPerfManagerId(''); setPerfEmployeeId('');
      setPerfMgrKraBars({ labels: [], values: [] }); setPerfManagerAvg(0);
      setPerfEmpKraBars({ labels: [], values: [] }); setPerfEmployeeAvg(0);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfDept]);

  // Performance: recompute dept avg when filter changes
  useEffect(() => {
    const run = async () => {
      if (!perfDept) { setPerfDeptAvg(0); return; }
      setPerfLoading(prev=>({ ...prev, dept:true }));
      const avg = await computeDeptAverage(perfDept, perfFilter);
      setPerfDeptAvg(avg || 0);
      setPerfLoading(prev=>({ ...prev, dept:false }));
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfFilter.mode, perfFilter.year, perfFilter.month]);

  // Helper to load KRA aggregates for a filtered list
  const loadKraBars = async (items) => {
    try {
      const pairs = await Promise.all((items || []).map(async k => {
        try {
          const aggRes = await axios.get(`http://localhost:3000/scoring/kra/${k.kra_id}/aggregate`, { headers: { Authorization: `Bearer ${getToken()}` } });
          const pct = aggRes.data?.data?.percentage;
          return [k.name, typeof pct === 'number' ? pct : (typeof k.overall_score === 'number' ? k.overall_score : 0)];
        } catch { return [k.name, typeof k.overall_score === 'number' ? k.overall_score : 0]; }
      }));
      return { labels: pairs.map(p=>p[0]), values: pairs.map(p=>p[1]) };
    } catch (_) { return { labels: [], values: [] }; }
  };

  // Performance: when manager changes compute manager avg and KRA bars (within dept)
  useEffect(() => {
    const run = async () => {
      try {
        setPerfLoading(prev=>({ ...prev, manager:true }));
        setPerfManagerAvg(0); setPerfMgrKraBars({ labels: [], values: [] });
        const mgr = (perfManagers || []).find(m => String(m.user_id) === String(perfManagerId));
        const mgrId = mgr?.user_id; const mgrName = mgr?.name || '';
        if (!perfDept || !mgrId) { setPerfLoading(prev=>({ ...prev, manager:false })); return; }
        const [avg, bars] = await Promise.all([
          computeUserAverage(mgrId, perfFilter),
          (async () => {
            const list = (kras || []).filter(k => String(k.dept || '') === String(perfDept) && String(k.manager_name || '').toLowerCase() === String(mgrName).toLowerCase());
            return await loadKraBars(list);
          })()
        ]);
        setPerfManagerAvg(avg || 0);
        setPerfMgrKraBars(bars);
      } catch(_) {
        setPerfManagerAvg(0); setPerfMgrKraBars({ labels: [], values: [] });
      } finally {
        setPerfLoading(prev=>({ ...prev, manager:false }));
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfManagerId, perfDept, perfFilter.mode, perfFilter.year, perfFilter.month, kras]);

  // Performance: when employee changes compute employee avg and KRA bars (within dept)
  useEffect(() => {
    const run = async () => {
      try {
        setPerfLoading(prev=>({ ...prev, employee:true }));
        setPerfEmployeeAvg(0); setPerfEmpKraBars({ labels: [], values: [] });
        const emp = (perfEmployees || []).find(e => String(e.user_id) === String(perfEmployeeId));
        const empId = emp?.user_id; const empName = emp?.name || '';
        if (!perfDept || !empId) { setPerfLoading(prev=>({ ...prev, employee:false })); return; }
        const [avg, bars] = await Promise.all([
          computeUserAverage(empId, perfFilter),
          (async () => {
            const list = (kras || []).filter(k => String(k.dept || '') === String(perfDept) && String(k.employee_name || '').toLowerCase() === String(empName).toLowerCase());
            return await loadKraBars(list);
          })()
        ]);
        setPerfEmployeeAvg(avg || 0);
        setPerfEmpKraBars(bars);
      } catch(_) {
        setPerfEmployeeAvg(0); setPerfEmpKraBars({ labels: [], values: [] });
      } finally {
        setPerfLoading(prev=>({ ...prev, employee:false }));
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfEmployeeId, perfDept, perfFilter.mode, perfFilter.year, perfFilter.month, kras]);

  const handleCreateManager = () => {
    window.location.href = '/create_profile';
  };

  const handleCreateKRA = () => {
    window.location.href = '/kracreation';
  };

  const handleDeptChange = (e) => {
    setSelectedDept(e.target.value);
  };

  useEffect(() => {
    const loadCounts = async () => {
      if (!selectedDept || selectedDept === '__all__') { setDeptCounts({ managers: 0, employees: 0, kras: 0, kpis: 0 }); return; }
      try {
        const [mgrRes, empRes, kraRes, kpiRes] = await Promise.all([
          axios.get(`http://localhost:3000/users/department/${encodeURIComponent(selectedDept)}/managers`, { headers: { Authorization: `Bearer ${getToken()}` } }),
          axios.get(`http://localhost:3000/users/department/${encodeURIComponent(selectedDept)}/employees`, { headers: { Authorization: `Bearer ${getToken()}` } }),
          axios.get(`http://localhost:3000/kra/department/${encodeURIComponent(selectedDept)}`, { headers: { Authorization: `Bearer ${getToken()}` } }),
          axios.get(`http://localhost:3000/kpi/department/${encodeURIComponent(selectedDept)}`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        ]);
        setDeptCounts({
          managers: (mgrRes.data || []).length,
          employees: (empRes.data || []).length,
          kras: (kraRes.data?.data || []).length,
          kpis: (kpiRes.data?.data || []).length,
        });
      } catch (_) {
        setDeptCounts({ managers: 0, employees: 0, kras: 0, kpis: 0 });
      }
    };
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept]);

  const handleExportReport = (format) => {
    try {
      if (format === 'csv') {
        exportTableToCSV('#kra-table', 'kras.csv');
      } else if (format === 'excel') {
        exportTableToExcel('#kra-table', 'kras.xls');
      } else if (format === 'pdf') {
        exportSectionById('kras-section', 'kras', 'pdf');
      }
    } catch (_) {}
  };

  const submitReview = async () => {
    try {
      if (!revManagerId || !revKraId || revScore === '') return;
      const manager = managers.find(m => String(m.user_id) === String(revManagerId));
      const kra = kras.find(k => String(k.kra_id) === String(revKraId)) || {};
      if (!manager) return;
      await axios.post('http://localhost:3000/review', {
        employee_id: Number(manager.user_id),
        employee_name: manager.name,
        dept: manager.dept || null,
        role: 'Manager',
        kra_name: kra.name || kra.kra_name || '',
        kra_id: Number(revKraId),
        score: Number(revScore),
        comment: revComment || null,
        review_at: new Date().toISOString(),
      }, { headers: { Authorization: `Bearer ${getToken()}` } });
      setRevScore('');
      setRevComment('');
      fetchMyReviews();
    } catch (_) {}
  };

  const openEditReview = (r) => {
    setRevEditForm({ id: r.id, score: String(r.score ?? ''), comment: r.comment || '', review_at: r.review_at ? String(r.review_at).substring(0,10) : '' });
    setRevEditOpen(true);
  };

  const submitEditReview = async () => {
    try {
      await axios.post(`http://localhost:3000/review/${revEditForm.id}`, {
        score: revEditForm.score === '' ? undefined : Number(revEditForm.score),
        comment: revEditForm.comment || undefined,
        review_at: revEditForm.review_at || undefined,
      }, { headers: { Authorization: `Bearer ${getToken()}` } });
      setRevEditOpen(false);
      fetchMyReviews();
    } catch (_) {}
  };

  useEffect(() => {
    const load = async () => {
      // Dept -> managers
      if (kraDept) {
        const mgrs = await fetchManagersByDept(kraDept);
        setKraManagers(mgrs);
      } else {
        // Fallback: all unique managers from KRAs
        const mgrNames = uniqueFromKras(kras, 'manager_name');
        setKraManagers(mgrNames.map((name, i) => ({ user_id: `name:${i}`, name })));
      }

      // Reset manager/employee when dept changes
      setKraManagerId('');
      setKraEmployeeName('');

      // Dept -> employees (broad list for when manager not yet chosen)
      if (kraDept) {
        try {
          const emps = await fetchEmployeesByDept(kraDept);
          setDeptEmployeeCache(emps.map(e => ({ name: e.name })));
          setKraEmployees(emps.map(e => ({ name: e.name })));
        } catch { setKraEmployees([]); }
      } else {
        const empNames = uniqueFromKras(kras, 'employee_name');
        setKraEmployees(empNames.map(name => ({ name })));
        setDeptEmployeeCache(empNames.map(name => ({ name })));
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kraDept]);

  useEffect(() => {
    // Manager -> restrict employees to those appearing with this manager within selected dept
    const run = async () => {
      const mgr = (kraManagers || []).find(m => String(m.user_id) === String(kraManagerId));
      const mgrName = mgr?.name || '';
      // Base employees = dept employees if dept selected, else from KRAs
      let base = [];
      if (kraDept) {
        base = deptEmployeeCache; // already loaded by dept effect
        if (!base.length) {
          try {
            const emps = await fetchEmployeesByDept(kraDept);
            base = emps.map(e => ({ name: e.name }));
            setDeptEmployeeCache(base);
          } catch { base = []; }
        }
      } else {
        const empNames = uniqueFromKras(kras, 'employee_name');
        base = empNames.map(name => ({ name }));
      }
      if (mgrName) {
        const filteredKras = (kras || []).filter(k => {
          const okDept = kraDept ? String(k.dept || '') === String(kraDept) : true;
          const okMgr = String(k.manager_name || '').toLowerCase() === String(mgrName).toLowerCase();
          return okDept && okMgr;
        });
        const allowed = new Set(uniqueFromKras(filteredKras, 'employee_name').map(n => n.toLowerCase()));
        const narrowed = base.filter(e => allowed.has(String(e.name).toLowerCase()));
        setKraEmployees(narrowed);
      } else {
        setKraEmployees(base);
      }
      setKraEmployeeName('');
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kraManagerId, kras, kraDept]);

  if (!userName) return <div className="text-white">Loading...</div>;

  const sections = {
    overview: (
      <div id="overview-section" className="space-y-6">
        
          <div className="relative">
            <h3 className="text-xl font-semibold text-white">Overview</h3>
                <button className="px-3 py-2 rounded text-white absolute right-0 -mt-7 bg-gradient-to-r from-blue-800 to-blue-500 disabled:opacity-50" onClick={(e)=>{
                  const btn = e.currentTarget; const menu = btn.nextSibling; if (menu) menu.classList.toggle('hidden');
                }}>Export All</button>
                <div className="absolute right-0 mt-1 bg-white border rounded shadow hidden z-10">
                  <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>exportSectionById('overview-section','overview','png')}>PNG</button>
                  <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>exportSectionById('overview-section','overview','jpg')}>JPG</button>
                  <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>exportSectionById('overview-section','overview','pdf')}>PDF</button>
                </div>
              </div>
        {/* Company Trend Analysis (first in overview) */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 md:p-5 shadow-lg border border-white/20 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(1200px 400px at 20% -10%, rgba(0,255,255,0.10), transparent), radial-gradient(800px 300px at 120% 20%, rgba(0,128,255,0.12), transparent), radial-gradient(1000px 500px at 50% 120%, rgba(0,255,128,0.08), transparent)' }} />
          <div className="relative flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-cyan-200">Trend Analysis</div>
              <div className="text-white text-lg font-semibold">Company Performance — {ovFilter.year}</div>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className="p-1.5 rounded bg-white/10 text-white w-24 border border-white/20" value={ovFilter.year} onChange={(e)=>setOvFilter(prev=>({ ...prev, year: Number(e.target.value)||new Date().getFullYear() }))} />
              <div className={`text-sm font-semibold ${companyTrendDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{companyTrendDelta >= 0 ? '▲' : '▼'} {Math.abs(companyTrendDelta)}</div>
            </div>
          </div>
          <div className="relative h-56 md:h-72">
            {companyTrend.labels.length ? (
              <Line
                data={{
                  labels: companyTrend.labels,
                  datasets: [{
                    label: 'Avg %',
                    data: companyTrend.values,
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
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#cbd5e1' } },
                    y: { suggestedMin: 0, suggestedMax: 100, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#cbd5e1' } }
                  },
                  animation: { duration: 0 }
                }}
              />
            ) : (
              <div className="text-gray-300">No data.</div>
            )}
          </div>
        </div>

        <div id="company-performance" className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg p-6 border border-white/20 text-white">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-xl font-semibold text-white">Company Performance</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={ovFilter.mode} onChange={(e)=>setOvFilter(prev=>({ ...prev, mode: e.target.value }))}>
                <option value="monthly" className="text-black">Monthly</option>
                <option value="yearly" className="text-black">Yearly</option>
              </select>
              <input type="number" className="p-2 border border-white/30 rounded bg-white/5 text-white w-24" value={ovFilter.year} onChange={(e)=>setOvFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
              {ovFilter.mode==='monthly' && (
                <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={ovFilter.month} onChange={(e)=>setOvFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                  {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m} className="text-black">{m}</option>)}
                </select>
              )}
             <button className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500 disabled:opacity-50" onClick={()=>exportSectionById('company-performance','pdf')}>Export PDF</button>
            </div>
            
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div id="dept-performance-chart" className="w-full">
              <div className="relative w-full h-[320px] md:h-[380px] lg:h-[420px]">
              {(() => {
                const centerText = {
                  id: 'centerText',
                  beforeDraw(chart) {
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return;
                    const { left, right, top, bottom } = chartArea;
                    const x = (left + right) / 2;
                    const y = (top + bottom) / 2;
                    ctx.save();
                    ctx.fillStyle = '#ffffff'; // Changed text color
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '600 14px sans-serif';
                    ctx.fillText('Dept Performance', x, y);
                    ctx.restore();
                  },
                };
                return (
                  <PolarArea
                    data={{
                      labels: (depts||[]).map(d=> d.name),
                      datasets: [{
                        label: 'Avg Score',
                        data: (depts||[]).map(d=> ovDeptAverages[d.name]||0),
                        backgroundColor: (depts||[]).map((_,i)=> {
                          const colors = ['#6366f1','#22c55e','#f59e0b','#06b6d4','#ef4444','#8b5cf6','#10b981','#3b82f6','#84cc16','#14b8a6'];
                          return colors[i % colors.length] + '33'; // translucent fill
                        }),
                        borderColor: (depts||[]).map((_,i)=> {
                          const colors = ['#6366f1','#22c55e','#f59e0b','#06b6d4','#ef4444','#8b5cf6','#10b981','#3b82f6','#84cc16','#14b8a6'];
                          return colors[i % colors.length];
                        }),
                        borderWidth: 1,
                      }]
                    }}
                    options={{
                      responsive:true,
                      maintainAspectRatio:false,
                      plugins:{ legend:{ display:true, position:'bottom', align:'center', labels: { color: '#ffffff' } } }, // Added label color
                      scales:{ r:{ 
                        suggestedMin:0, 
                        suggestedMax:100, 
                        grid: { color:'rgba(255,255,255,0.2)' }, // Changed grid color
                        angleLines:{ color:'rgba(255,255,255,0.2)' }, // Changed angle line color
                        ticks: { backdropColor: 'rgba(0,0,0,0.5)', color: '#ffffff' }, // Added tick color
                        pointLabels: { color: '#ffffff' } // Added point label color
                      }}
                    }}
                    plugins={[centerText]}
                  />
                  
                );
              
              })()}
              </div>
              <div className="mt-3 text-center text-base md:text-lg font-semibold text-white">Department Performance</div>
            </div>
            <div id="overview-company-chart" className="w-full">
              <div className="relative w-full h-[320px] md:h-[380px] lg:h-[420px]">
              {(() => {
                const liquidFill = {
                  id: 'liquidFill',
                  afterInit(chart) {
                    chart.$liquid = chart.$liquid || { phase: 0, raf: null };
                    const step = () => {
                      if (!chart.$liquid) return;
                      chart.$liquid.phase += 0.06; // speed
                      // keep phase bounded
                      if (chart.$liquid.phase > Math.PI * 2) chart.$liquid.phase -= Math.PI * 2;
                      chart.draw();
                      chart.$liquid.raf = requestAnimationFrame(step);
                    };
                    if (!chart.$liquid.raf) chart.$liquid.raf = requestAnimationFrame(step);
                  },
                  afterDestroy(chart) {
                    try { if (chart.$liquid?.raf) cancelAnimationFrame(chart.$liquid.raf); } catch(_) {}
                    chart.$liquid = null;
                  },
                  beforeDatasetsDraw(chart) {
                    try {
                      const ds = chart.data?.datasets?.[0];
                      if (!ds) return;
                      const sum = (Number(ds.data?.[0]||0) + Number(ds.data?.[1]||0)) || 0;
                      const pct = sum > 0 ? Number(ds.data?.[0]||0) / sum : 0;
                      const meta = chart.getDatasetMeta(0);
                      const arc0 = meta?.data?.[0]; if (!arc0) return;
                      const cx = arc0.x, cy = arc0.y;
                      const inner = arc0.innerRadius;
                      const ctx = chart.ctx; if (!ctx || !inner) return;
                      const phase = chart.$liquid?.phase || 0;
                      // Clip to inner circle
                      ctx.save();
                      ctx.beginPath();
                      ctx.arc(cx, cy, inner * 0.98, 0, Math.PI * 2);
                      ctx.clip();
                      // Compute water level
                      const yTop = cy - inner, yBot = cy + inner;
                      const yLevel = yBot - (yBot - yTop) * pct;
                      // Draw base water
                      const grad = ctx.createLinearGradient(0, yTop, 0, yBot);
                      grad.addColorStop(0, 'rgba(59,130,246,0.6)');
                      grad.addColorStop(1, 'rgba(59,130,246,0.9)');
                      ctx.fillStyle = grad;
                      // Build sine wave path with phase
                      const amp = Math.max(3, inner * 0.06);
                      const waveLen = inner * 1.6;
                      const startX = cx - inner - 2;
                      const endX = cx + inner + 2;
                      ctx.beginPath();
                      ctx.moveTo(startX, yBot + 2);
                      ctx.lineTo(startX, yLevel);
                      for (let x = startX; x <= endX; x += 3) {
                        const t = ((x - startX) / waveLen) * Math.PI * 2 + phase;
                        const y = yLevel + Math.sin(t) * amp;
                        ctx.lineTo(x, y);
                      }
                      ctx.lineTo(endX, yBot + 2);
                      ctx.closePath();
                      ctx.fill();
                      // Inner gloss
                      const gloss = ctx.createRadialGradient(cx, cy - inner * 0.4, inner * 0.1, cx, cy, inner);
                      gloss.addColorStop(0, 'rgba(255,255,255,0.15)');
                      gloss.addColorStop(1, 'rgba(255,255,255,0)');
                      ctx.fillStyle = gloss;
                      ctx.beginPath();
                      ctx.arc(cx, cy, inner * 0.95, 0, Math.PI * 2);
                      ctx.fill();
                      ctx.restore();
                      // Center percentage text
                      ctx.save();
                      ctx.fillStyle = '#FFFFFF'; // Changed text color
                      ctx.font = '600 50px sans-serif';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(`${Math.round(pct*100)}%`, cx, cy);
                      ctx.restore();
                    } catch (_) { /* noop */ }
                  }
                };
                return (
                  <Doughnut
                    data={{ labels:['Avg','Remaining'], datasets:[{ data:[Math.max(0, Math.min(100, ovCompanyAverage||0)), Math.max(0, 100 - Math.max(0, Math.min(100, ovCompanyAverage||0)))], backgroundColor:['#f0ad73ff','rgba(255,255,255,0.2)'], borderWidth:0, cutout:'70%' }] }} // Changed remaining color
                    options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:true, position:'bottom', align:'center', labels: { color: '#ffffff' } } } }} // Added label color
                    plugins={[liquidFill]}
                  />
                );
              })()}
              </div>
              <div className="mt-2 text-center text-base md:text-lg font-semibold text-white">Company Performance</div>

            </div>
          </div>
        </div>
      <div id="overview-progress-chart" className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg p-6 border border-white/20 text-white">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-xl font-semibold text-white">Company Progress</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={hbFilter.mode} onChange={(e)=>setHbFilter(prev=>({ ...prev, mode: e.target.value }))}>
              <option value="monthly" className="text-black">Monthly</option>
              <option value="yearly" className="text-black">Yearly</option>
            </select>
            <input type="number" className="p-2 border border-white/30 rounded bg-white/5 text-white w-24" value={hbFilter.year} onChange={(e)=>setHbFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
            {hbFilter.mode==='monthly' && (
              <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={hbFilter.month} onChange={(e)=>setHbFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m} className="text-black">{m}</option>)}
              </select>
            )}
            <button className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500 disabled:opacity-50" onClick={()=>exportSectionById('overview-progress-chart','company-progress','pdf')}>Export PDF</button>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={hbDept} onChange={(e)=>{ setHbDept(e.target.value); setHbManagerId(''); }}>
            <option value="__all__" className="text-black">All</option>
            {(depts||[]).map(d=> <option key={d.id} value={d.name} className="text-black">{d.name}</option>)}
          </select>
          <select className="p-2 border border-white/30 rounded bg-white/5 text-white disabled:bg-gray-800/50" disabled={!hbDept || hbDept==='__all__'} value={hbManagerId} onChange={(e)=> setHbManagerId(e.target.value)}>
            <option value="" className="text-black">Select Manager</option>
            {(hbManagers||[]).map(m=> <option key={m.user_id} value={m.user_id} className="text-black">{m.name}</option>)}
          </select>
          <input type="number" className="p-2 border border-white/30 rounded bg-white/5 text-white w-28" value={hbFilter.year} onChange={(e)=> setHbFilter(prev=>({ ...prev, year: Number(e.target.value)||new Date().getFullYear() }))} />
        </div>
        <div className="h-72">
          {hbSeries.labels.length ? (
            <Bar
              data={{ labels: hbSeries.labels, datasets:[{ label:'Avg Score', data: hbSeries.values, backgroundColor:'rgba(59,130,246,0.3)', borderColor:'#3b82f6' }] }}
              options={{ 
                indexAxis:'y', 
                responsive:true, 
                maintainAspectRatio:false, 
                plugins:{ legend:{ display:false } }, 
                scales:{ 
                  x:{ suggestedMin:0, suggestedMax:100, ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.2)' } }, // Added tick and grid color
                  y:{ ticks:{ autoSkip:false, color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.2)' } } // Added tick and grid color
                } 
              }}
            />
          ) : (
            <div className="text-gray-300">No data.</div>
          )}
          </div>
        </div>
      </div>
    ),
    performance: (
      <div id="performance-section" className="space-y-6">
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg p-6 border border-white/20 text-white">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-xl font-semibold text-white">Performance</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={perfFilter.mode} onChange={(e)=>setPerfFilter(prev=>({ ...prev, mode: e.target.value }))}>
                <option value="monthly" className="text-black">Monthly</option>
                <option value="yearly" className="text-black">Yearly</option>
              </select>
              <input type="number" className="p-2 border border-white/30 rounded bg-white/5 text-white w-24" value={perfFilter.year} onChange={(e)=>setPerfFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
              {perfFilter.mode==='monthly' && (
                <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={perfFilter.month} onChange={(e)=>setPerfFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                  {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m} className="text-black">{m}</option>)}
                </select>
              )}
              <button className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500 disabled:opacity-50" onClick={()=>exportSectionById('performance-section','performance','pdf')}>Export PDF</button>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={perfDept} onChange={(e)=> setPerfDept(e.target.value)}>
              <option value="" className="text-black">Select Department</option>
              {(depts||[]).map(d=> <option key={d.id} value={d.name} className="text-black">{d.name}</option>)}
            </select>
            <select className="p-2 border border-white/30 rounded bg-white/5 text-white disabled:bg-gray-800/50" disabled={!perfDept} value={perfManagerId} onChange={(e)=> setPerfManagerId(e.target.value)}>
              <option value="" className="text-black">Select Manager</option>
              {(perfManagers||[]).map(m=> <option key={m.user_id} value={m.user_id} className="text-black">{m.name}</option>)}
            </select>
            <select className="p-2 border border-white/30 rounded bg-white/5 text-white disabled:bg-gray-800/50" disabled={!perfDept} value={perfEmployeeId} onChange={(e)=> setPerfEmployeeId(e.target.value)}>
              <option value="" className="text-black">Select Employee</option>
              {(perfEmployees||[]).map(e=> <option key={e.user_id} value={e.user_id} className="text-black">{e.name}</option>)}
            </select>
          </div>

          {!perfDept && (
            <div className="text-gray-300">Select a department to view performance.</div>
          )}

          {/* Dept card */}
          {perfDept && (
            <div className="border border-white/20 rounded p-4 mt-4 bg-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="max-w-[220px] h-48 mx-auto">
                  {(() => {
                    const center = {
                      id: 'deptDoughnutCenter',
                      afterDatasetsDraw(chart) {
                        const { ctx, chartArea, data } = chart; if (!chartArea) return; const { left,right,top,bottom }=chartArea; const x=(left+right)/2; const y=(top+bottom)/2;
                        const ds = data?.datasets?.[0]; const v = Array.isArray(ds?.data) ? Number(ds.data[0]||0) : 0; const pct = Math.round(Math.max(0, Math.min(100, v)));
                        ctx.save(); ctx.fillStyle='#FFFFFF'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='600 20px sans-serif'; ctx.fillText(`${pct}%`, x, y); ctx.restore();
                      }
                    };
                    const val = Math.max(0, Math.min(100, perfDeptAvg||0));
                    return (
                      <Doughnut
                        key={`dept-${perfDept}-${perfFilter.mode}-${perfFilter.year}-${perfFilter.month}-${val}`}
                        data={{ labels:['Avg','Remaining'], datasets:[{ data:[val, 100-val], backgroundColor:['#3b82f6','rgba(255,255,255,0.1)'], borderWidth:0, cutout:'70%' }] }}
                        options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }}
                        redraw
                        plugins={[center]}
                      />
                    );
                  })()}
                </div>
                <div className="text-left">
                  <div className="text-lg font-semibold mb-1 text-white">{perfDept.charAt(0).toUpperCase() + perfDept.slice(1).toLowerCase()} Performance</div>
                </div>
              </div>
            </div>
          )}

          {/* Manager card: separate division */}
          {perfDept && perfManagerId && (
            <div className="border border-white/20 rounded p-4 mt-4 bg-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="max-w-[220px] h-48 mx-auto">
                  {(() => {
                    const center = {
                      id: 'mgrDoughnutCenter',
                      afterDatasetsDraw(chart) {
                        const { ctx, chartArea, data } = chart; if (!chartArea) return; const { left,right,top,bottom }=chartArea; const x=(left+right)/2; const y=(top+bottom)/2;
                        const ds = data?.datasets?.[0]; const v = Array.isArray(ds?.data) ? Number(ds.data[0]||0) : 0; const pct = Math.round(Math.max(0, Math.min(100, v)));
                        ctx.save(); ctx.fillStyle='#FFFFFF'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='600 20px sans-serif'; ctx.fillText(`${pct}%`, x, y); ctx.restore();
                      }
                    };
                    const val = Math.max(0, Math.min(100, perfManagerAvg||0));
                    return (
                      <Doughnut
                        key={`mgr-${perfManagerId}-${perfDept}-${perfFilter.mode}-${perfFilter.year}-${perfFilter.month}-${val}`}
                        data={{ labels:['Avg','Remaining'], datasets:[{ data:[val, 100-val], backgroundColor:['#6366f1','rgba(255,255,255,0.1)'], borderWidth:0, cutout:'70%' }] }}
                        options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }}
                        redraw
                        plugins={[center]}
                      />
                    );
                  })()}
                  <div className="text-center mt-2 text-lg text-white">Manager Performance</div>
                </div>
                <div className="h-64">
                  {perfMgrKraBars.labels.length ? (
                    <Bar
                      data={{ labels: perfMgrKraBars.labels, datasets:[{ label:'KRA %', data: perfMgrKraBars.values, backgroundColor:'rgba(99,102,241,0.35)', borderColor:'#6366f1' }] }}
                      options={{
                        responsive:true,
                        maintainAspectRatio:false,
                        plugins:{ legend:{ display:false } },
                        scales:{ 
                          y:{ suggestedMin:0, suggestedMax:100, ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.2)' } },
                          x:{ ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.2)' } }
                        },
                        animation:{
                          duration:800,
                          easing:'easeOutCubic',
                          delay: (ctx) => ctx?.type === 'data' && ctx?.mode === 'default' ? ctx.dataIndex * 120 : 0,
                          y: { from: 0 }
                        }
                      }}
                    />
                  ) : (
                    <div className="text-gray-300">No KRA data.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Employee card: separate division */}
          {perfDept && perfEmployeeId && (
            <div className="border border-white/20 rounded p-4 mt-4 bg-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="max-w-[220px] h-48 mx-auto">
                  {(() => {
                    const center = {
                      id: 'empDoughnutCenter',
                      afterDatasetsDraw(chart) {
                        const { ctx, chartArea, data } = chart; if (!chartArea) return; const { left,right,top,bottom }=chartArea; const x=(left+right)/2; const y=(top+bottom)/2;
                        const ds = data?.datasets?.[0]; const v = Array.isArray(ds?.data) ? Number(ds.data[0]||0) : 0; const pct = Math.round(Math.max(0, Math.min(100, v)));
                        ctx.save(); ctx.fillStyle='#FFFFFF'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='600 20px sans-serif'; ctx.fillText(`${pct}%`, x, y); ctx.restore();
                      }
                    };
                    const val = Math.max(0, Math.min(100, perfEmployeeAvg||0));
                    return (
                      <Doughnut
                        key={`emp-${perfEmployeeId}-${perfDept}-${perfFilter.mode}-${perfFilter.year}-${perfFilter.month}-${val}`}
                        data={{ labels:['Avg','Remaining'], datasets:[{ data:[val, 100-val], backgroundColor:['#10b981','rgba(255,255,255,0.1)'], borderWidth:0, cutout:'70%' }] }}
                        options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }}
                        redraw
                        plugins={[center]}
                      />
                    );
                  })()}
                  <div className="text-center mt-2 text-lg text-white">Employee Performance</div>
                </div>
                <div className="h-64">
                  {perfEmpKraBars.labels.length ? (
                    <Bar
                      data={{ labels: perfEmpKraBars.labels, datasets:[{ label:'KRA %', data: perfEmpKraBars.values, backgroundColor:'rgba(16,185,129,0.35)', borderColor:'#10b981' }] }}
                      options={{
                        responsive:true,
                        maintainAspectRatio:false,
                        plugins:{ legend:{ display:false } },
                        scales:{ 
                          y:{ suggestedMin:0, suggestedMax:100, ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.2)' } },
                          x:{ ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.2)' } }
                        },
                        animation:{
                          duration:800,
                          easing:'easeOutCubic',
                          delay: (ctx) => ctx?.type === 'data' && ctx?.mode === 'default' ? ctx.dataIndex * 120 : 0,
                          y: { from: 0 }
                        }
                      }}
                    />
                  ) : (
                    <div className="text-gray-300">No KRA data.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    departments: (
      <div id="departments-section" className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg p-6 border border-white/20 text-white mb-8">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <select
              value={selectedDept}
              onChange={handleDeptChange}
              className="p-2 border border-white/30 rounded bg-white/5 text-white"
            >
              <option value="" className="text-black">Select Department</option>
              <option value="__all__" className="text-black">All</option>
              {depts.map((dept) => (
                <option key={dept.id} value={dept.name} className="text-black">{dept.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={depFilter.mode} onChange={(e)=>setDepFilter(prev=>({ ...prev, mode: e.target.value }))}>
              <option value="monthly" className="text-black">Monthly</option>
              <option value="yearly" className="text-black">Yearly</option>
            </select>
            <input type="number" className="p-2 border border-white/30 rounded bg-white/5 text-white w-24" value={depFilter.year} onChange={(e)=>setDepFilter(prev=>({ ...prev, year: Number(e.target.value) }))} />
            {depFilter.mode==='monthly' && (
              <select className="p-2 border border-white/30 rounded bg-white/5 text-white" value={depFilter.month} onChange={(e)=>setDepFilter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m} className="text-black">{m}</option>)}
              </select>
            )}
            <button className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500 disabled:opacity-50" onClick={()=>exportSectionById('departments-section','departments','pdf')}>Export PDF</button>
          </div>
        </div>
        {selectedDept && selectedDept !== '__all__' ? (
          <div className="grid grid-cols-1 items-center justify-center lg:grid-cols-4 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded p-4 border border-white/20">
              <div className="text-sm text-gray-300 mb-1">Managers</div>
              <div className="text-2xl font-semibold text-white">{deptCounts.managers}</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded p-4 border border-white/20">
              <div className="text-sm text-gray-300 mb-1">Employees</div>
              <div className="text-2xl font-semibold text-white">{deptCounts.employees}</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded p-4 border border-white/20">
              <div className="text-sm text-gray-300 mb-1">KRAs</div>
              <div className="text-2xl font-semibold text-white">{deptCounts.kras}</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded p-4 h-24 border border-white/20">
              <div className="text-sm text-gray-300 mb-1">KPIs</div>
              <div className="text-2xl font-semibold text-white">{deptCounts.kpis}</div>
            </div>
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="max-w-sm">
                <Doughnut
                  data={{ labels:['Avg','Remaining'], datasets:[{ data:[Math.max(0, Math.min(100, depDeptAverages[selectedDept]||0)), Math.max(0, 100 - Math.max(0, Math.min(100, depDeptAverages[selectedDept]||0)))], backgroundColor:['#10b981','rgba(255,255,255,0.1)'], borderWidth:0, cutout:'70%' }] }}
                  options={{ responsive:true, plugins:{ legend:{ display:false } } }}
                />
              </div>
              <div className="text-center mt-2 text-xl font-semibold text-white">{selectedDept} - {depDeptAverages[selectedDept]||0}%</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(depts||[]).map(d => (
              <div key={d.id} className="border border-white/20 rounded p-4 bg-white/5">
                <div className="font-medium mb-2 text-white">{d.name} - {depDeptAverages[d.name]||0}%</div>
                <div className="max-w-xs">
                  <Doughnut
                    data={{ labels:['Avg','Remaining'], datasets:[{ data:[Math.max(0, Math.min(100, depDeptAverages[d.name]||0)), Math.max(0, 100 - Math.max(0, Math.min(100, depDeptAverages[d.name]||0)))], backgroundColor:['#60a5fa','rgba(255,255,255,0.1)'], borderWidth:0, cutout:'70%' }] }}
                    options={{ responsive:true, plugins:{ legend:{ display:false } } }}
                  />
                </div>
                <div className="text-center mt-2 text-lg text-white">{depDeptAverages[d.name]||0}%</div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    kras: (
      <div id="kras-section" className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg p-6 border border-white/20 text-white mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">KRA Management</h3>
          <div className="relative">
            <button className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500 disabled:opacity-50" onClick={(e)=>{ const m=e.currentTarget.nextSibling; if (m) m.classList.toggle('hidden'); }}>Export</button>
            <div className="absolute right-0 mt-1 bg-white border rounded shadow hidden z-10">
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>handleExportReport('csv')}>CSV</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>handleExportReport('excel')}>Excel</button>
              <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>handleExportReport('pdf')}>PDF</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">Department</label>
            <select className="w-full p-2 border border-white/30 rounded bg-white/5 text-white" value={kraDept} onChange={(e)=> setKraDept(e.target.value)}>
              <option value="" className="text-black">Select Department</option>
              {(depts||[]).map(d=> <option key={d.id} value={d.name} className="text-black">{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">Manager</label>
            <select className="w-full p-2 border border-white/30 rounded bg-white/5 text-white disabled:bg-gray-800/50" disabled={!kraDept} value={kraManagerId} onChange={(e)=> setKraManagerId(e.target.value)}>
              <option value="" className="text-black">Select Manager</option>
              {(kraManagers||[]).map(m=> <option key={m.user_id} value={m.user_id} className="text-black">{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">Employee</label>
            <select className="w-full p-2 border border-white/30 rounded bg-white/5 text-white disabled:bg-gray-800/50" disabled={!kraDept} value={kraEmployeeName} onChange={(e)=> setKraEmployeeName(e.target.value)}>
              <option value="" className="text-black">Select Employee</option>
              {(kraEmployees||[]).map(e=> <option key={e.name} value={e.name} className="text-black">{e.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCreateKRA}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full"
            >
              Create New KRA
            </button>
          </div>
          <div className="flex items-end">
            <div className="relative w-full">
              <button type="button" onClick={()=> setExportOpen(prev=>!prev)} className="w-full px-4 py-2 rounded border border-white/30 bg-white/5 text-white hover:bg-white/10">Export</button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-white border rounded shadow z-10">
                  <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>{ handleExportReport('pdf'); setExportOpen(false); }}>PDF</button>
                  <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>{ handleExportReport('excel'); setExportOpen(false); }}>Excel</button>
                  <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>{ handleExportReport('csv'); setExportOpen(false); }}>CSV</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {kraDept && (() => {
          // Apply filters
          const mgr = (kraManagers || []).find(m => String(m.user_id) === String(kraManagerId));
          const mgrName = mgr?.name || '';
          const filtered = (kras || []).filter(k => {
            const okDept = kraDept ? String(k.dept || '') === String(kraDept) : true;
            const okMgr = mgrName ? String(k.manager_name || '').toLowerCase() === String(mgrName).toLowerCase() : true;
            const okEmp = kraEmployeeName ? String(k.employee_name || '').toLowerCase() === String(kraEmployeeName).toLowerCase() : true;
            return okDept && okMgr && okEmp;
          });
          return (
            <div className="overflow-x-auto">
              <table id="kra-table" className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left p-2 text-white">KRA Name</th>
                    <th className="text-left p-2 text-white">Score</th>
                    <th className="text-left p-2 text-white">Manager</th>
                    <th className="text-left p-2 text-white">Employee</th>
                    <th className="text-left p-2 text-white">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {filtered.map((kra) => (
                    <tr key={kra.kra_id} className="border-b border-white/20">
                      <td className="p-2 font-medium">{kra.name}</td>
                      <td className="p-2">{(typeof kra.overall_score === 'number' ? `${kra.overall_score}%` : '-') }</td>
                      <td className="p-2">{kra.manager_name || '-'}</td>
                      <td className="p-2">{kra.employee_name || '-'}</td>
                      <td className="p-2">
                        <button onClick={() => openKraModal(kra)} className="text-blue-400 hover:text-blue-300 text-sm">View</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td className="p-3 text-gray-300" colSpan="5">No KRAs found for the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}

        {kraModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-gray-900/50 backdrop-blur-lg border border-white/20 text-white w-full max-w-2xl rounded shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">KRA KPIs{kraModalState.kra ? ` — ${kraModalState.kra.name}` : ''}</h3>
                <button onClick={closeKraModal} className="text-gray-300 hover:text-white">✕</button>
              </div>
              {kraModalState.loading ? (
                <div className="p-6 text-center text-gray-300">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {kraModalState.aggregate && (
                    <div className="bg-white/5 border border-white/20 rounded p-3">
                      <div className="text-sm text-gray-300">Aggregate Score</div>
                      <div className="text-2xl font-semibold text-white">{kraModalState.aggregate.percentage ?? 0}% <span className="text-sm text-gray-400">({kraModalState.aggregate.count || 0} KPIs)</span></div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/20">
                          <th className="text-left p-2">KPI</th>
                          <th className="text-left p-2">Method</th>
                          <th className="text-left p-2">Target</th>
                          <th className="text-left p-2">Score</th>
                          <th className="text-left p-2">%</th>
                          <th className="text-left p-2">Due</th>
                          <th className="text-left p-2">Comments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(kraModalState.kpis || []).map(k => (
                          <tr key={k.id} className="border-b border-white/20">
                            <td className="p-2 font-medium">{k.name}</td>
                            <td className="p-2">{k.scoring_method}</td>
                            <td className="p-2">{k.target ?? '-'}</td>
                            <td className="p-2">{k.score ?? '-'}</td>
                            <td className="p-2">{typeof k.percentage === 'number' ? `${k.percentage}%` : '-'}</td>
                            <td className="p-2">{k.due_date ? new Date(k.due_date).toLocaleDateString() : '-'}</td>
                            <td className="p-2"><span dangerouslySetInnerHTML={{ __html: k.comments ? renderCommentHtml(k.comments) : '-' }} /></td>
                          </tr>
                        ))}
                        {(!kraModalState.kpis || kraModalState.kpis.length === 0) && (
                          <tr><td className="p-3 text-gray-300" colSpan="7">No KPIs found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-2 rounded border border-white/30 text-white" onClick={()=> closeKraModal()}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    ),
    review: (
      <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg p-6 border border-white/20 text-white mb-8">
        <h3 className="text-xl font-semibold mb-4 text-white">Add Manager Review</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">Department</label>
            <select className="w-full p-2 border border-white/30 rounded bg-white/5 text-white" value={revDept} onChange={(e)=>{ setRevDept(e.target.value); }}>
              <option value="" className="text-black">-- Select --</option>
              {(depts||[]).map(d=> <option key={d.id} value={d.name} className="text-black">{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">Select Manager</label>
            <select className="w-full p-2 border border-white/30 rounded bg-white/5 text-white disabled:bg-gray-800/50" disabled={!revDept} value={revManagerId} onChange={(e)=>{ setRevManagerId(e.target.value); setRevKraId(''); }}>
              <option value="" className="text-black">-- Select --</option>
              {(revDeptManagers||[]).map(m=> <option key={m.user_id} value={m.user_id} className="text-black">{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">Select KRA (Assigned to manager)</label>
            <select className="w-full p-2 border border-white/30 rounded bg-white/5 text-white disabled:bg-gray-800/50" disabled={!revDept || !revManagerId} value={revKraId} onChange={(e)=> setRevKraId(e.target.value)}>
              <option value="" className="text-black">-- Select --</option>
              {(function(){
                const manager = (revDeptManagers||[]).find(m=> String(m.user_id)===String(revManagerId));
                const managerName = manager?.name || '';
                return (kras||[])
                  .filter(k => String(k.dept || '') === String(revDept))
                  .filter(k => managerName ? String(k.manager_name || '').toLowerCase() === String(managerName).toLowerCase() : true)
                  .map(k => (
                    <option key={k.kra_id} value={k.kra_id} className="text-black">{k.name}</option>
                  ));
              })()}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">Score (Percentage)</label>
            <div className="flex items-center gap-2"><input type="range" min="0" max="100" value={revScore===''?0:Number(revScore)} onChange={(e)=>setRevScore(e.target.value)} /><span className="w-12 text-right text-sm text-white">{revScore||0}%</span></div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-200">Comments</label>
            <textarea className="w-full p-2 border border-white/30 rounded bg-white/5 text-white placeholder-gray-400" rows={2} value={revComment} onChange={(e)=>setRevComment(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end mb-6">
          <button onClick={submitReview} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50" disabled={!revManagerId || !revKraId || revScore===''}>Add Review</button>
        </div>

        {revKraId && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-2 text-white">Active KPIs for selected KRA</h4>
            <div className="space-y-3">
              {(revActiveKpis||[]).map(k => (
                <div key={k.id} className="border border-white/20 rounded p-3 bg-white/5">
                  <div className="font-medium text-white">{k.name}</div>
                  <div className="text-sm text-gray-300">Target: {k.target != null ? `${k.target}%` : '-'}</div>
                  <div className="text-sm text-gray-300">Achieved: {typeof k.percentage === 'number' ? `${k.percentage}%` : (typeof k.score === 'number' ? `${k.score}%` : '-')}</div>
                  <div className="text-sm text-gray-300">Comments: <span dangerouslySetInnerHTML={{ __html: k.comments ? renderCommentHtml(k.comments) : '-' }} /></div>
                </div>
              ))}
              {(!revActiveKpis || revActiveKpis.length === 0) && (
                <div className="p-3 text-gray-300 border border-white/20 rounded bg-white/5">No active KPIs.</div>
              )}
            </div>
          </div>
        )}

        <div id="admin-myreviews-section" className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold text-white">My Reviews</h3>
            <div className="relative">
              <button className="px-3 py-2 rounded text-white bg-gradient-to-r from-blue-800 to-blue-500 disabled:opacity-50" onClick={(e)=>{ const m=e.currentTarget.nextSibling; if (m) m.classList.toggle('hidden'); }}>Export</button>
              <div className="absolute right-0 mt-1 bg-white border rounded shadow hidden z-10">
                <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>exportTableToCSV('#admin-myreviews-table','my-reviews.csv')}>CSV</button>
                <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>exportTableToExcel('#admin-myreviews-table','my-reviews.xls')}>Excel</button>
                <button className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-black" onClick={()=>exportSectionById('admin-myreviews-section','my-reviews','pdf')}>PDF</button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table id="admin-myreviews-table" className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left p-3 text-white">KRA</th>
                  <th className="text-left p-3 text-white">Manager</th>
                  <th className="text-left p-3 text-white">Score</th>
                  <th className="text-left p-3 text-white">Comment</th>
                  <th className="text-left p-3 text-white">Reviewed At</th>
                  <th className="text-left p-3 text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {myReviews.map(r => (
                  <tr key={r.id} className="border-b border-white/20">
                    <td className="p-3">{r.kra_name}</td>
                    <td className="p-3">{r.employee_name}</td>
                    <td className="p-3">{r.score}</td>
                    <td className="p-3"><span dangerouslySetInnerHTML={{ __html: r.comment ? renderCommentHtml(r.comment) : '-' }} /></td>
                    <td className="p-3">{r.review_at ? new Date(r.review_at).toLocaleDateString() : '-'}</td>
                    <td className="p-3"><button className="text-blue-400 hover:text-blue-300 text-sm" onClick={()=>openEditReview(r)}>Update</button></td>
                  </tr>
                ))}
                {myReviews.length===0 && (
                  <tr><td className="p-4 text-gray-300" colSpan="6">No reviews yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {revEditOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-gray-900/50 backdrop-blur-lg border border-white/20 text-white w-full max-w-md rounded shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Update Review</h3>
                <button onClick={()=>setRevEditOpen(false)} className="text-gray-300 hover:text-white">✕</button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-200">Score (0-100)</label>
                  <input type="number" min="0" max="100" className="w-full p-2 border border-white/30 rounded bg-white/5 text-white" value={revEditForm.score} onChange={(e)=>setRevEditForm(prev=>({ ...prev, score: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-200">Comment</label>
                  <textarea className="w-full p-2 border border-white/30 rounded bg-white/5 text-white" rows={3} value={revEditForm.comment} onChange={(e)=>setRevEditForm(prev=>({ ...prev, comment: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={()=>setRevEditOpen(false)} className="px-4 py-2 rounded border border-white/30 text-white">Cancel</button>
                <button onClick={submitEditReview} className="px-4 py-2 rounded bg-indigo-600 text-white">Update</button>
              </div>
            </div>
          </div>
        )}
      </div>
    ),
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-fixed bg-center" 
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="max-w-7xl mx-auto p-4 md:p-8"> {/* Added padding for spacing */}
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap border-b border-white/30">
          {Object.keys(sections).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 rounded-t-lg font-medium ${
                activeSection === section
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/10 backdrop-blur-sm text-gray-200 hover:bg-white/20'
              }`}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        {/* Active Section Content */}
        {sections[activeSection]}
      </div>
    </div>
  );
}