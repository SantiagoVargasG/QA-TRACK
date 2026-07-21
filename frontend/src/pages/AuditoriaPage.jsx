import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

function AuditoriaPage() {
  const [eventos, setEventos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/auditoria')
      .then(setEventos)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-800">Auditoría</h1>
      <p className="text-sm text-gray-500">
        Últimas acciones administrativas: correcciones de columna por un admin, reaperturas de CA, y
        cambios de roles/equipo.
      </p>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <table className="w-full max-w-4xl text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Fecha</th>
            <th className="py-2">Entidad</th>
            <th className="py-2">Acción</th>
            <th className="py-2">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e.id} className="border-b border-gray-100">
              <td className="py-2 text-xs text-gray-500">{new Date(e.fecha).toLocaleString()}</td>
              <td className="py-2">{e.entidad}</td>
              <td className="py-2 font-mono text-xs">{e.accion}</td>
              <td className="py-2 text-gray-600">{e.detalle}</td>
            </tr>
          ))}
          {eventos.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-400">
                Sin eventos de auditoría todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AuditoriaPage;
