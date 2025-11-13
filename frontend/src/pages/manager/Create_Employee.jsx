import { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken, getRole } from '../../utils/authStorage';
// [CHANGE] Import your background image
// !! You may need to change this path depending on your file structure !!
import backgroundImage from '../../assets/background.png';

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

  // [LOGIC UNCHANGED]
  useEffect(() => {
    const token = getToken();
    const role = getRole();
    if (!token || (role || '').toLowerCase() !== 'manager') {
      window.location.href = '/login';
      return;
    }
    preloadManagerContext();
  }, []);

  // [LOGIC UNCHANGED]
  const preloadManagerContext = async () => {
    try {
      const profileRes = await axios.get('http://localhost:3000/auth/profile', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const profile = profileRes.data.user || profileRes.data;
      const deptName =
        profile.dept || profile.department || profile.dept_name || '';
      setDept(deptName);

      const deptsRes = await axios.get('http://localhost:3000/departments', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const matchDept = (deptsRes.data || []).find(
        (d) => (d.name || '').toLowerCase() === (deptName || '').toLowerCase()
      );
      if (matchDept) setDeptId(matchDept.id);

      const rolesRes = await axios.get('http://localhost:3000/roles', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const employeeRole = (rolesRes.data || []).find(
        (r) => (r.role_name || '').toLowerCase() === 'employee'
      );
      if (employeeRole) setEmployeesRoleId(employeeRole.id);
    } catch (err) {
      console.error('Error preloading manager context', err);
    }
  };

  // [LOGIC UNCHANGED]
  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  // [LOGIC UNCHANGED]
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
      showMessage(
        'Error creating employee: ' +
          (error.response?.data?.message || error.message),
        'error'
      );
    }
  };

  return (
    // [STYLE CHANGE] New wrapper for background image and centering
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* [STYLE CHANGE] Frosted glass effect card */}
      <div className="w-full max-w-md mx-auto bg-white/10 backdrop-blur-md p-8 rounded-lg shadow-xl border border-white/20">
        
        {/* [STYLE CHANGE] Text color changed to white */}
        <h2 className="text-2xl text-white font-bold mb-6">
          Create Employee (Manager)
        </h2>
        
        {/* [STYLE CHANGE] Popup styling updated for high contrast */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-md ${
              messageType === 'success'
                ? 'bg-green-600 text-white' // Solid background
                : 'bg-red-600 text-white' // Solid background
            }`}
          >
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            {/* [STYLE CHANGE] Text color changed to light gray */}
            <label className="block text-gray-200">Name</label>
            {/* [STYLE CHANGE] Input made transparent, text white */}
            <input
              type="text"
              value={name}
              placeholder="Enter Name"
              onChange={(e) => setName(e.target.value)}
              className="w-full text-white bg-transparent p-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-200">Email</label>
            <input
              type="email"
              value={email}
              placeholder="Enter Email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-white bg-transparent p-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-200">Department</label>
            {/* [STYLE CHANGE] Disabled input styled to match */}
            <input
              type="text"
              value={dept}
              disabled
              className="w-full text-gray-300 p-2 border border-gray-500 rounded bg-white/10 cursor-not-allowed"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-200">Role</label>
            <input
              type="text"
              value="Employee"
              disabled
              className="w-full text-gray-300 p-2 border border-gray-500 rounded bg-white/10 cursor-not-allowed"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-200">Password</label>
            <input
              type="password"
              value={password}
              placeholder="Enter Password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-white bg-transparent p-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-200">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              placeholder="Enter Confirm Password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full text-white bg-transparent p-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400"
              required
            />
          </div>
          {/* [STYLE UNCHANGED] Button style already works well */}
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            Create Employee
          </button>
        </form>
      </div>
    </div>
  );
}