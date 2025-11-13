import AdminKraLog from '../admin/KraLog';
import ManagerKraLog from '../manager/KraLog';
import { getRole } from '../../utils/authStorage';

export default function KraLogRouter() {
  const role = (getRole() || '').toLowerCase();
  if (role === 'admin') return <AdminKraLog />;
  if (role === 'manager') return <ManagerKraLog />;
  return <div>Unauthorized</div>;
}
