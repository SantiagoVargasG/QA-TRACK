import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProyecto } from '../context/ProyectoContext';

function ProyectosPage() {
  const { usuario } = useAuth();
  const { proyectos, cargarProyectos, seleccionarProyecto } = useProyecto();
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    cargarProyectos().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch('/proyectos', { method: 'POST', body: form });
      setForm({ nombre: '', descripcion: '' });
      await cargarProyectos();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(id) {
    try {
      await apiFetch(`/proyectos/${id}`, { method: 'DELETE' });
      await cargarProyectos();
    } catch (err) {
      setError(err.message);
    }
  }

  function entrar(id) {
    seleccionarProyecto(id);
    navigate('/proyecto');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">Proyectos</h1>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Nombre</th>
            <th className="py-2">Descripción</th>
            <th className="py-2">Equipo</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {proyectos.map((p) => (
            <tr key={p.id} className="border-b border-gray-100">
              <td className="py-2">{p.nombre}</td>
              <td className="py-2 text-gray-500">{p.descripcion || '—'}</td>
              <td className="py-2">{p.equipo.length}</td>
              <td className="py-2 space-x-3">
                <button type="button" onClick={() => entrar(p.id)} className="text-blue-600 hover:underline">
                  Entrar
                </button>
                {usuario?.esAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`/proyectos/${p.id}/equipo`)}
                      className="text-gray-600 hover:underline"
                    >
                      Configurar
                    </button>
                    <button type="button" onClick={() => eliminar(p.id)} className="text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {proyectos.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-400">
                No hay proyectos todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {usuario?.esAdmin && (
        <form onSubmit={onSubmit} className="max-w-sm space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700">Nuevo proyecto</h2>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            required
          />
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Descripción (opcional)"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {cargando ? 'Creando...' : 'Crear proyecto'}
          </button>
        </form>
      )}
    </div>
  );
}

export default ProyectosPage;
