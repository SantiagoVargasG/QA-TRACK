import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

function DashboardPage() {
  const [estadoBackend, setEstadoBackend] = useState('verificando...');

  useEffect(() => {
    apiFetch('/health', { auth: false })
      .then((data) => setEstadoBackend(data.status))
      .catch(() => setEstadoBackend('sin conexión'));
  }, []);

  return (
    <p className="text-gray-700">
      Estado del backend: <span className="font-mono">{estadoBackend}</span>
    </p>
  );
}

export default DashboardPage;
