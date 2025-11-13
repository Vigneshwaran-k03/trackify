import { useEffect, useState, useRef } from 'react';
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

export default function AdminProfile() {
  const [userName, setUserName] = useState('');
  const [userDept, setUserDept] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [avatar, setAvatar] = useState('default:male1');
  const [pendingAvatar, setPendingAvatar] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef(null);
  const [cpOpen, setCpOpen] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpMsg, setCpMsg] = useState('');

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    const name = getUserName() || 'Admin';
    if (!token || (role || '').toLowerCase() !== 'admin') {
      window.location.href = '/login';
      return;
    }
    setUserName(name);
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('http://localhost:3000/auth/profile', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const profile = response.data?.user || response.data || {};
      setUserDept(profile.dept || profile.department || profile.dept_name || '');
      setUserEmail(profile.email || profile.mail || '');
      if (profile.avatar) setAvatar(profile.avatar);
    } catch (_) {}
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
    setPendingAvatar(`default:${key}`);
    if (pendingFile) setPendingFile(null);
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setPendingAvatar(url);
  };

  const saveAvatar = async () => {
    try {
      if (!pendingAvatar) return;
      const token = getToken();
      if (!token) { window.location.href = '/login'; return; }
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
        }
        return;
      }
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
        }
      }
    } catch {}
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">My Profile</h3>
        <button onClick={()=>setCpOpen(true)} className="px-3 py-2 rounded bg-indigo-600 text-white text-sm">Change Password</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3">Personal Information</h4>
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {userName}</p>
            <p><span className="font-medium">Department:</span> {userDept}</p>
            <p><span className="font-medium">Role:</span> Admin</p>
            <p><span className="font-medium">Email:</span> {userEmail}</p>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-3">Profile Picture</h4>
          <div className="flex items-start gap-4">
            <img src={pendingFile ? pendingAvatar : resolveAvatar(pendingAvatar || avatar)} alt="passport" className="w-[160px] h-[200px] object-cover border rounded" />
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-5 gap-3">
                {['male1','male2','male3','male4','male5','female1','female2','female3','female4','female5'].map(key=> (
                  <button type="button" key={key} onClick={()=>selectDefault(key)} className={`border rounded overflow-hidden focus:outline-none ${(pendingAvatar===`default:${key}`) || (!pendingAvatar && avatar===`default:${key}`) ? 'ring-2 ring-indigo-500' : ''}`}>
                    <img src={resolveAvatar(`default:${key}`)} alt={key} className="w-16 h-16 object-cover" />
                  </button>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Upload from device</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
                <button type="button" onClick={()=>fileRef.current?.click()} className="px-3 py-2 rounded border text-sm">Choose from local</button>
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
      {cpOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">Change Password</h4>
              <button onClick={()=>setCpOpen(false)} className="text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input disabled value={userEmail} className="w-full p-2 border rounded bg-gray-100" />
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
              {cpMsg && <div className="text-sm text-emerald-700">{cpMsg}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
