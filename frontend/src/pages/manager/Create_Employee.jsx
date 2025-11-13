import { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken, getRole } from '../../utils/authStorage';

export default function Create_Employee() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dept, setDept] = useState('');
  const [deptId, setDeptId] = useState(null);
  const [employeesRoleId, setEmployeesRoleId] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    const token = getToken();
    const role = getRole();
    if (!token || (role || '').toLowerCase() !== 'manager') {
      window.location.href = '/login';
      return;
    }
    preloadManagerContext();
  }, []);

  const preloadManagerContext = async () => {
    try {
      // Get manager profile (to derive department)
      const profileRes = await axios.get('http://localhost:3000/auth/profile', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const profile = profileRes.data.user || profileRes.data;
      const deptName = profile.dept || profile.department || profile.dept_name || '';
      setDept(deptName);

      // Fetch departments to resolve dept id
      const deptsRes = await axios.get('http://localhost:3000/departments', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const matchDept = (deptsRes.data || []).find(d => (d.name || '').toLowerCase() === (deptName || '').toLowerCase());
      if (matchDept) setDeptId(matchDept.id);

      // Fetch roles and resolve Employee role id
      const rolesRes = await axios.get('http://localhost:3000/roles', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const employeeRole = (rolesRes.data || []).find(r => (r.role_name || '').toLowerCase() === 'employee');
      if (employeeRole) setEmployeesRoleId(employeeRole.id);
    } catch (err) {
      console.error('Error preloading manager context', err);
    }
  };

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    const userData = {
      name,
      email,
      password,
      dept_id: deptId,
      dept: dept,
      role_id: employeesRoleId,
      role: 'Employee',
    };

    try {
      await axios.post('http://localhost:3000/auth/register', userData);
      showMessage('Employee created successfully!', 'success');
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      showMessage('Error creating employee: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
      <h2 className="text-2xl text-black font-bold mb-6">Create Employee (Manager)</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-md ${
          messageType === 'success'
            ? 'bg-green-100 border border-green-400 text-green-700'
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          <div className="flex">
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
          <input type="text" value={name} placeholder="Enter Name" onChange={(e) => setName(e.target.value)} className="w-full text-black p-2 border rounded" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Email</label>
          <input type="email" value={email} placeholder="Enter Email" onChange={(e) => setEmail(e.target.value)} className="w-full text-black p-2 border rounded" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Department</label>
          <input type="text" value={dept} disabled className="w-full text-black p-2 border rounded bg-gray-100" />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Role</label>
          <input type="text" value="Employee" disabled className="w-full text-black p-2 border rounded bg-gray-100" />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Password</label>
          <input type="password" value={password} placeholder="Enter Password" onChange={(e) => setPassword(e.target.value)} className="w-full  text-black p-2 border rounded" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Confirm Password</label>
          <input type="password" value={confirmPassword} placeholder="Enter Confirm Password" onChange={(e) => setConfirmPassword(e.target.value)} className="w-full  text-black p-2 border rounded" required />
        </div>
        <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Create Employee</button>
      </form>
    </div>
  );
}
