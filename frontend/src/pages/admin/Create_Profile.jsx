import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '../../utils/authStorage';

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
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl text-black font-bold mb-6">Create User</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-md ${
          messageType === 'success'
            ? 'bg-green-100 border border-green-400 text-green-700'
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {messageType === 'success' ? (
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                messageType === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message}
              </p>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-black text-gray-700">Name</label>
          <input type="text" placeholder="Enter Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-black p-2 border rounded" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Email</label>
          <input type="email" placeholder="Enter Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full text-black p-2 border rounded" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Password</label>
          <input type="password" placeholder="Enter Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full  text-black p-2 border rounded" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Confirm Password</label>
          <input type="password" placeholder="Enter Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full  text-black p-2 border rounded" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full text-black p-2 border rounded" required>
            <option value="">Select Role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id.toString()}>{r.role_name}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Department</label>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full p-2 text-black border rounded" required>
            <option value="">Select Department</option>
            <option value="none">None</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id.toString()}>{d.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
          Create User
        </button>
      </form>
    </div>
  );
}
