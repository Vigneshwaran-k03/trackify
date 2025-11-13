import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '../../utils/authStorage';
import backgroundImage from '../../assets/background.png';

export default function Create_Profile() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [dept, setDept] = useState('');
  const [roles, setRoles] = useState([]);
  const [depts, setDepts] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchRoles();
    fetchDepts();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await axios.get('http://localhost:3000/roles', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchDepts = async () => {
    try {
      const response = await axios.get('http://localhost:3000/departments', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setDepts(response.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    const selectedRole = role === 'none' ? null : roles.find(r => r.id === parseInt(role));
    const selectedDept = dept === 'none' ? null : depts.find(d => d.id === parseInt(dept));

    const userData = {
      name,
      email,
      password,
      dept_id: selectedDept ? selectedDept.id : null,
      dept: selectedDept ? selectedDept.name : null,
      role_id: selectedRole ? selectedRole.id : null,
      role: selectedRole ? selectedRole.role_name : null,
    };

    try {
      await axios.post('http://localhost:3000/auth/register', userData);
      showMessage('User created successfully!', 'success');
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRole('');
      setDept('');
    } catch (error) {
      showMessage('Error creating user: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  return (
    <div
      // REMOVED `p-4` from here and added `px-4` to the inner card
      className="h-screen w-full flex items-center justify-center overflow-y-auto" 
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/*
        Changed `w-full` to `w-full sm:max-w-md`
        Added `px-4` for horizontal padding on all screen sizes
        Added `py-8` for vertical padding to give some breathing room
      */}
      <div className="w-full sm:max-w-md bg-black/30 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8 my-auto px-4 py-8">
        
        <h2 className="text-2xl text-white font-bold mb-6 text-center">Create User</h2>
        
        {message && (
          <div className={`mb-4 p-3 rounded-md border ${
            messageType === 'success'
              ? 'bg-green-500/20 border-green-400'
              : 'bg-red-500/20 border-red-400'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {messageType === 'success' ? (
                  <svg className="h-5 w-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">
                  {message}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-1">Name</label>
            <input 
              type="text" 
              placeholder="Enter Name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full text-white bg-white/10 border border-white/30 rounded-lg p-2.5 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-1">Email</label>
            <input 
              type="email" 
              placeholder="Enter Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full text-white bg-white/10 border border-white/30 rounded-lg p-2.5 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-1">Password</label>
            <input 
              type="password" 
              placeholder="Enter Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full text-white bg-white/10 border border-white/30 rounded-lg p-2.5 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-1">Confirm Password</label>
            <input 
              type="password" 
              placeholder="Enter Confirm Password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className="w-full text-white bg-white/10 border border-white/30 rounded-lg p-2.5 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-1">Role</label>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)} 
              className="w-full text-white bg-white/10 border border-white/30 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-white/50 transition" 
              required
            >
              <option value="" className="text-black">Select Role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id.toString()} className="text-black">{r.role_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/90 mb-1">Department</label>
            <select 
              value={dept} 
              onChange={(e) => setDept(e.target.value)} 
              className="w-full text-white bg-white/10 border border-white/30 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-white/50 transition" 
              required
            >
              <option value="" className="text-black">Select Department</option>
              <option value="none" className="text-black">None</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id.toString()} className="text-black">{d.name}</option>
              ))}
            </select>
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            Create User
          </button>
        </form>
      </div>
    </div>
  );
}