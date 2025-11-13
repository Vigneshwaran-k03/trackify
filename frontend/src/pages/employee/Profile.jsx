import { useEffect, useState, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import axios from 'axios';
import { getToken, getRole, getUserName } from '../../utils/authStorage';
import male1 from '../../assets/profile_image/male1.png';
import male2 from '../../assets/profile_image/male2.png';
import male3 from '../../assets/profile_image/male3.png';
import male4 from '../../assets/profile_image/male4.png';
import male5 from '../../assets/profile_image/male5.png';
import female1 from '../../assets/profile_image/female1.png';
import female2 from '../../assets/profile_image/female2.png';
import female3 from '../../assets/profile_image/female3.png';
import female4 from '../../assets/profile_image/female4.png';
import female5 from '../../assets/profile_image/female5.png';

// --- IMPORTANT ---
// Import your background image like this
import backgroundImage from '../../assets/background.png';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function EmployeeProfile() {
  const [userName, setUserName] = useState('');
  const [userDept, setUserDept] = useState('');
  const [userId, setUserId] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [avatar, setAvatar] = useState('default:male1');
  const [pendingAvatar, setPendingAvatar] = useState(''); // 'default:key' or uploaded object URL
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef(null);
  const [cpOpen, setCpOpen] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpMsg, setCpMsg] = useState('');
  const [myTasks, setMyTasks] = useState([]);
  const [recentKRAs, setRecentKRAs] = useState([]);
  const [allKras, setAllKras] = useState([]);

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
  const [gauge1Target, setGauge1Target] = useState(100);
  const [gauge2Target, setGauge2Target] = useState(100);

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    const name = getUserName() || 'Employee';
    if (!token || (role || '').toLowerCase() !== 'employee') {
      window.location.href = '/login';
      return;
    }
    setUserName(name);
    initLoads();
  }, []);

  const initLoads = async () => {
    await fetchUserProfile();
    await fetchMyKRAs();
    await fetchMyTasks();
  };

  const resolveAvatar = (val) => {
    const map = { male1, male2, male3, male4, male5, female1, female2, female3, female4, female5 };
    if (!val || typeof val !== 'string') return male1;
    if (val.startsWith('default:')) {
      const key = val.split(':')[1];
      return map[key] || male1;
    }
    return val;
  };

  const selectDefault = (key) => {
    // Only mark pending; persist on button click
    setPendingAvatar(`default:${key}`);
    if (pendingFile) setPendingFile(null);
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingAvatar(url); // use object URL for preview
  };

  const saveAvatar = async () => {
    try {
      // Nothing to save
      if (!pendingAvatar) return;
      const token = getToken();
      if (!token) { window.location.href = '/login'; return; }
      // Upload case
      if (pendingFile) {
        const fd = new FormData();
        fd.append('file', pendingFile);
        const res = await fetch('http://localhost:3000/users/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
        const data = await res.json();
        if (res.ok && data?.avatar) {
          setAvatar(data.avatar);
          setPendingAvatar('');
          setPendingFile(null);
          try { window.dispatchEvent(new CustomEvent('avatar_updated', { detail: { avatar: data.avatar } })); } catch {}
        }
        return;
      }
      // Default selection case
      if (pendingAvatar.startsWith('default:')) {
        const key = pendingAvatar.split(':')[1];
        const res = await fetch('http://localhost:3000/users/avatar/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key })
        });
        if (res.ok) {
          setAvatar(`default:${key}`);
          setPendingAvatar('');
          try { window.dispatchEvent(new CustomEvent('avatar_updated', { detail: { avatar: `default:${key}` } })); } catch {}
        }
      }
    } catch {}
  };

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('http://localhost:3000/auth/profile', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setUserDept(response.data.dept);
      setUserEmail(response.data.email || '');
      if (response.data?.avatar) setAvatar(response.data.avatar);
      if (response.data?.user_id) setUserId(response.data.user_id);
      else if (response.data?.id) setUserId(response.data.id);
    } catch (_) {}
  };

  const fetchMyTasks = async () => {
    try {
      setMyTasks([
        { id: 1, name: 'Complete Sales Report', status: 'Completed', dueDate: '2025-01-15', priority: 'High' },
        { id: 2, name: 'Team Meeting Preparation', status: 'Pending', dueDate: '2025-01-20', priority: 'Medium' },
        { id: 3, name: 'Code Review', status: 'Completed', dueDate: '2025-01-10', priority: 'Low' },
      ]);
    } catch (_) {}
  };

  const fetchMyKRAs = async () => {
    try {
      const token = getToken();
      const avail = await axios.get('http://localhost:3000/kpi/available', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const kras = avail.data?.data || [];
      setAllKras(kras);
      setRecentKRAs(kras.slice(0, 3));
    } catch (_) {}
  };

  const fetchMonthlyAverage = async (empId, y, m) => {
    if (!empId) return { avg: 0, targetAvg: 100 };
    try {
      const token = getToken();
      const res = await axios.get(`http://localhost:3000/review/employee/${empId}/month`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year: y, month: m }
      });
      const list = res.data?.data || [];
      const scores = list.map(r => (typeof r.score === 'number' ? r.score : Number(r.score || 0))).filter(v=>!Number.isNaN(v));
      const avg = scores.length ? (scores.reduce((a,b)=>a+b,0) / scores.length) : 0;
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
  }, [userId, gauge1Filter.year, gauge1Filter.month, gauge2Filter.year, gauge2Filter.month]);

  return (
    // New wrapper div for background image
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Main Frosted Glass Card */}
      <div className="bg-white/20 backdrop-blur-md p-6 rounded-lg shadow-xl max-w-7xl mx-auto text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">My Profile</h3>
          <button onClick={()=>setCpOpen(true)} className="px-3 py-2 rounded bg-indigo-600 text-white text-sm">Change Password</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3 text-gray-100">Personal Information</h4>
            <div className="space-y-2 text-white">
              <p><span className="font-medium text-gray-200">Name:</span> {userName}</p>
              <p><span className="font-medium text-gray-200">Department:</span> {userDept}</p>
              <p><span className="font-medium text-gray-200">Role:</span> Employee</p>
              <p><span className="font-medium text-gray-200">Email:</span> {userEmail}</p>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-3 text-gray-100">Profile Picture</h4>
            <div className="flex items-start gap-4">
              <img src={pendingFile ? pendingAvatar : resolveAvatar(pendingAvatar || avatar)} alt="passport" className="w-[160px] h-[200px] object-cover border border-white/30 rounded" />
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-5 gap-3">
                  {['male1','male2','male3','male4','male5','female1','female2','female3','female4','female5'].map(key=> (
                    <button type="button" key={key} onClick={()=>selectDefault(key)} className={`border border-white/30 rounded overflow-hidden focus:outline-none ${(pendingAvatar===`default:${key}`) || (!pendingAvatar && avatar===`default:${key}`) ? 'ring-2 ring-indigo-400' : ''}`}>
                      <img src={resolveAvatar(`default:${key}`)} alt={key} className="w-16 h-16 object-cover" />
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block text-gray-100">Upload from device</label>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
                  <button type="button" onClick={()=>fileRef.current?.click()} className="px-3 py-2 rounded border border-white/30 text-sm text-white hover:bg-white/10">Choose from local</button>
                </div>
                <div className="pt-1 flex justify-end">
                  <button type="button" onClick={saveAvatar} disabled={!pendingAvatar}
                    className="px-3 py-2 rounded bg-indigo-600 text-white text-sm disabled:opacity-60">
                    Change Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8">
          <h4 className="font-medium mb-4 text-gray-100">My Performance Gauges</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-white/30 rounded p-4 bg-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-white">Gauge 1</div>
                <div className="flex items-center gap-2">
                  <input type="number" className="p-2 border border-white/30 rounded w-24 bg-white/80 text-black" value={gauge1Filter.year} onChange={(e)=>setGauge1Filter(prev=>({ ...prev, year: Number(e.target.value) }))} />
                  <select className="p-2 border border-white/30 rounded bg-white/80 text-black" value={gauge1Filter.month} onChange={(e)=>setGauge1Filter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                    {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="max-w-xs mx-auto">
                <Doughnut
                  data={{
                    labels: ['Avg Score', 'Remaining'],
                    datasets: [{
                      data: [Math.max(0, Math.min(100, gauge1Avg)), Math.max(0, 100 - Math.max(0, Math.min(100, gauge1Avg)))],
                      backgroundColor: [gauge1Avg >= gauge1Target ? '#10b981' : '#fca5a5', '#e5e7eb'],
                      borderWidth: 0,
                      cutout: '70%'
                    }]
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: true } } }}
                />
                <div className="text-center mt-2 text-xl font-semibold text-white">{gauge1Avg}%</div>
                <div className="text-center text-sm text-gray-200">Target: {gauge1Target}%</div>
              </div>
            </div>
            <div className="border border-white/30 rounded p-4 bg-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-white">Gauge 2</div>
                <div className="flex items-center gap-2">
                  <input type="number" className="p-2 border border-white/30 rounded w-24 bg-white/80 text-black" value={gauge2Filter.year} onChange={(e)=>setGauge2Filter(prev=>({ ...prev, year: Number(e.target.value) }))} />
                  <select className="p-2 border border-white/30 rounded bg-white/80 text-black" value={gauge2Filter.month} onChange={(e)=>setGauge2Filter(prev=>({ ...prev, month: Number(e.target.value) }))}>
                    {Array.from({length:12},(_,i)=>i+1).map(m=> <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="max-w-xs mx-auto">
                <Doughnut
                  data={{
                    labels: ['Avg Score', 'Remaining'],
                    datasets: [{
                      data: [Math.max(0, Math.min(100, gauge2Avg)), Math.max(0, 100 - Math.max(0, Math.min(100, gauge2Avg)))],
                      backgroundColor: [gauge2Avg >= gauge2Target ? '#10b981' : '#fca5a5', '#e5e7eb'],
                      borderWidth: 0,
                      cutout: '70%'
                    }]
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: true } } }}
                />
                <div className="text-center mt-2 text-xl font-semibold text-white">{gauge2Avg}%</div>
                <div className="text-center text-sm text-gray-200">Target: {gauge2Target}%</div>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-200 mt-2">Each gauge shows the average of all KRA review scores for the selected month.</div>
        </div>
        {cpOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white/20 backdrop-blur-md w-full max-w-md rounded-lg shadow-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-white">Change Password</h4>
                <button onClick={()=>setCpOpen(false)} className="text-gray-100 hover:text-white text-2xl">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1 text-gray-100">Email</label>
                  <input disabled value={userEmail} className="w-full p-2 border border-white/30 rounded bg-gray-200/80 text-gray-700" />
                </div>
                <button
                  onClick={async()=>{
                    try {
                      setCpLoading(true); setCpMsg('');
                      await fetch('http://localhost:3000/auth/change-init', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${getToken()}` }});
                      setCpMsg('You may login your account');
                      setTimeout(()=> setCpOpen(false), 1500);
                    } catch { setCpMsg('Failed to send verification'); }
                    finally { setCpLoading(false); }
                  }}
                  className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
                  disabled={cpLoading}
                >{cpLoading? 'Sending...' : 'Send verification'}</button>
                {cpMsg && <div className="text-sm text-emerald-300">{cpMsg}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}