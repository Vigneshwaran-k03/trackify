import { useEffect, useState } from 'react';

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) setToken(t);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setMsg('Passwords do not match');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setMsg('');
    try {
      const res = await fetch('http://localhost:3000/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      if (!res.ok) throw new Error('Reset failed');
      setStatus('done');
      setMsg('You may login your account');
      setTimeout(()=>{ window.location.href = '/login'; }, 1500);
    } catch (_) {
      setStatus('error');
      setMsg('Failed to reset password. Token may be invalid or expired.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-6">
      <form onSubmit={submit} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Reset Password</h2>
        <label className="block text-sm mb-1">Token</label>
        <input className="w-full p-2 border rounded mb-4" value={token} onChange={(e)=>setToken(e.target.value)} required />
        <label className="block text-sm mb-1">New Password</label>
        <input type="password" className="w-full p-2 border rounded mb-4" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        <label className="block text-sm mb-1">Confirm Password</label>
        <input type="password" className="w-full p-2 border rounded mb-4" value={confirm} onChange={(e)=>setConfirm(e.target.value)} required />
        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-60" disabled={status==='loading'}>
          {status==='loading' ? 'Updating...' : 'Update Password'}
        </button>
        {msg && <div className={`mt-3 text-sm ${status==='error' ? 'text-red-600' : 'text-green-700'}`}>{msg}</div>}
      </form>
    </div>
  );
}
