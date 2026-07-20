import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

const CAPACIDADES = [
  { valor: 'gestionar_contenido', etiqueta: 'Gestionar contenido' },
  { valor: 'marcar_finalizado', etiqueta: 'Marcar finalizado' },
  { valor: 'aprobar_rechazar', etiqueta: 'Aprobar / rechazar' },
  { valor: 'solo_lectura', etiqueta: 'Solo lectura' },
];

function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ nombre: '', capacidades: [] });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    const data = await apiFetch('/roles');
    setRoles(data);
  }

  useEffect(() => {
    cargar().catch((err) => setError(err.message));
  }, []);

  function toggleCapacidad(valor) {
    setForm((f) => ({
      ...f,
      capacidades: f.capacidades.includes(valor)
        ? f.capacidades.filter((c) => c !== valor)
        : [...f.capacidades, valor],
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch('/roles', { method: 'POST', body: form });
      setForm({ nombre: '', capacidades: [] });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(id) {
    try {
      await apiFetch(`/roles/${id}`, { method: 'DELETE' });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">Roles</h1>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Nombre</th>
            <th className="py-2">Capacidades</th>
            <th className="py-2">Semilla</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="py-2">{r.nombre}</td>
              <td className="py-2">{r.capacidades.join(', ') || '—'}</td>
              <td className="py-2">{r.esSemilla ? 'Sí' : 'No'}</td>
              <td className="py-2">
                {!r.esSemilla && (
                  <button type="button" onClick={() => eliminar(r.id)} className="text-red-600 hover:underline">
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={onSubmit} className="max-w-sm space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">Nuevo rol</h2>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Nombre del rol"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          required
        />
        <div className="space-y-1">
          {CAPACIDADES.map((c) => (
            <label key={c.valor} className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.capacidades.includes(c.valor)}
                onChange={() => toggleCapacidad(c.valor)}
              />
              {c.etiqueta}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear rol'}
        </button>
      </form>
    </div>
  );
}

export default RolesPage;
