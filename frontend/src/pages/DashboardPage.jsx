import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProyecto } from '../context/ProyectoContext';

const ICONOS = ['carpeta', 'documento', 'engranaje', 'grafico', 'usuarios', 'caja', 'etiqueta', 'campana'];

function DashboardPage() {
  const { usuario } = useAuth();
  const { proyectoActual, proyectoActualId, modulos, cargarModulos } = useProyecto();
  const [estadoBackend, setEstadoBackend] = useState('verificando...');
  const [form, setForm] = useState({ nombre: '', icono: 'carpeta', descripcion: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    apiFetch('/health', { auth: false })
      .then((data) => setEstadoBackend(data.status))
      .catch(() => setEstadoBackend('sin conexión'));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch(`/proyectos/${proyectoActualId}/modulos`, { method: 'POST', body: form });
      setForm({ nombre: '', icono: 'carpeta', descripcion: '' });
      await cargarModulos();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(id) {
    try {
      await apiFetch(`/proyectos/${proyectoActualId}/modulos/${id}`, { method: 'DELETE' });
      await cargarModulos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function mover(index, direccion) {
    const nuevoOrden = [...modulos];
    const destino = index + direccion;
    if (destino < 0 || destino >= nuevoOrden.length) return;
    [nuevoOrden[index], nuevoOrden[destino]] = [nuevoOrden[destino], nuevoOrden[index]];
    try {
      await apiFetch(`/proyectos/${proyectoActualId}/modulos/reordenar`, {
        method: 'PUT',
        body: { ids: nuevoOrden.map((m) => m.id) },
      });
      await cargarModulos();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!proyectoActualId) {
    return (
      <div className="space-y-2">
        <p className="text-gray-700">
          Estado del backend: <span className="font-mono">{estadoBackend}</span>
        </p>
        <p className="text-gray-500">Selecciona un proyecto en la barra superior para ver sus módulos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">{proyectoActual?.nombre}</h1>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m, index) => (
          <div key={m.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">{m.nombre}</span>
              <div className="flex gap-1 text-xs text-gray-500">
                <button type="button" onClick={() => mover(index, -1)} disabled={index === 0} className="disabled:opacity-30">
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => mover(index, 1)}
                  disabled={index === modulos.length - 1}
                  className="disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500">{m.descripcion || 'Sin descripción'}</p>
            {usuario?.esAdmin && (
              <button type="button" onClick={() => eliminar(m.id)} className="mt-2 text-xs text-red-600 hover:underline">
                Eliminar
              </button>
            )}
          </div>
        ))}
        {modulos.length === 0 && <p className="text-gray-400">Sin módulos todavía.</p>}
      </div>

      <form onSubmit={onSubmit} className="max-w-sm space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">Nuevo módulo</h2>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          required
        />
        <select
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={form.icono}
          onChange={(e) => setForm((f) => ({ ...f, icono: e.target.value }))}
        >
          {ICONOS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
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
          {cargando ? 'Creando...' : 'Crear módulo'}
        </button>
      </form>
    </div>
  );
}

export default DashboardPage;
