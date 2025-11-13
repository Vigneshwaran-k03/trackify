import AdminKpiLog from '../admin/KpiLog';
import ManagerKpiLog from '../manager/KpiLog';
import EmployeeKpiLog from '../employee/KpiLog';
import { getRole } from '../../utils/authStorage';

export default function KpiLogRouter() {
  const role = (getRole() || '').toLowerCase();
  if (role === 'admin') return <AdminKpiLog />;
  if (role === 'manager') return <ManagerKpiLog />;
  if (role === 'employee') return <EmployeeKpiLog />;
  return <div>Unauthorized</div>;
}
