import { useState } from 'react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMsg('');
    try {
      const res = await fetch('http://localhost:3000/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('sent');
      setMsg('You may login your account');
      setTimeout(()=>{ window.location.href = '/login'; }, 1500);
    } catch (_) {
      setStatus('error');
      setMsg('Failed to send reset email.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-6">
      <form onSubmit={submit} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Forgot Password</h2>
        <label className="block text-sm mb-1">Email</label>
        <input type="email" className="w-full p-2 border rounded mb-4" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-60" disabled={status==='loading'}>
          {status==='loading' ? 'Sending...' : 'Send reset email'}
        </button>
        {msg && <div className={`mt-3 text-sm ${status==='error' ? 'text-red-600' : 'text-green-700'}`}>{msg}</div>}
      </form>
    </div>
  );
}
