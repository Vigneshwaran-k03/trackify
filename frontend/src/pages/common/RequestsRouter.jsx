import React from 'react';
import AdminRequests from '../admin/Requests';
import ManagerRequests from '../manager/Requests';
import EmployeeMyRequests from '../employee/MyRequests';
import { getRole } from '../../utils/authStorage';

export default function RequestsRouter() {
  const role = (getRole() || '').toLowerCase();
  if (role === 'admin') return <AdminRequests />;
  if (role === 'manager') return <ManagerRequests />;
  return <EmployeeMyRequests />;
}
