import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProyecto } from '../context/ProyectoContext';

function ProyectosPage() {
  const { usuario } = useAuth();
  const { proyectos, cargarProyectos, seleccionarProyecto } = useProyecto();
  const [form, setForm] = useState({ nombre: '', descripcion: '', proyectoBaseId: '', clonarDesdeProyectoId: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const [bases, setBases] = useState([]);
  const [formBase, setFormBase] = useState({ nombre: '' });
  const [cargandoBase, setCargandoBase] = useState(false);

  useEffect(() => {
    cargarProyectos().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarBases() {
    const data = await apiFetch('/proyectos-base');
    setBases(data);
    return data;
  }

  // GET /proyectos-base requiere esAdmin: solo tiene sentido cargarla para quien puede
  // gestionar proyectos base — el resto de los usuarios ya recibe proyectoBaseNombre
  // denormalizado en cada proyecto (ver proyectoService.listar()) para agrupar el selector.
  useEffect(() => {
    if (usuario?.esAdmin) cargarBases().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.esAdmin]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch('/proyectos', {
        method: 'POST',
        body: {
          nombre: form.nombre,
          descripcion: form.descripcion,
          proyectoBaseId: form.proyectoBaseId || undefined,
          clonarDesdeProyectoId: form.clonarDesdeProyectoId || undefined,
        },
      });
      setForm({ nombre: '', descripcion: '', proyectoBaseId: '', clonarDesdeProyectoId: '' });
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

  async function crearBase(e) {
    e.preventDefault();
    setError('');
    setCargandoBase(true);
    try {
      await apiFetch('/proyectos-base', { method: 'POST', body: formBase });
      setFormBase({ nombre: '' });
      await cargarBases();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoBase(false);
    }
  }

  // Inactivar/reactivar es la misma acción (PUT con activo invertido) — igual que el
  // toggle de activo en usuarios. Al cambiarla, refresca también proyectos: inactivar una
  // base oculta sus sub-vistas del listado agrupado de inmediato.
  async function alternarBase(base) {
    try {
      await apiFetch(`/proyectos-base/${base.id}`, { method: 'PUT', body: { activo: !base.activo } });
      await Promise.all([cargarBases(), cargarProyectos()]);
    } catch (err) {
      setError(err.message);
    }
  }

  const sueltos = proyectos.filter((p) => !p.proyectoBaseId);
  const gruposPorBase = new Map();
  proyectos.forEach((p) => {
    if (!p.proyectoBaseId) return;
    const clave = p.proyectoBaseNombre || 'Sin nombre';
    if (!gruposPorBase.has(clave)) gruposPorBase.set(clave, []);
    gruposPorBase.get(clave).push(p);
  });

  const subVistasDeLaBaseElegida = proyectos.filter((p) => p.proyectoBaseId === form.proyectoBaseId);

  function TablaProyectos({ lista }) {
    return (
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
          {lista.map((p) => (
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
        </tbody>
      </table>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">Proyectos</h1>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {sueltos.length > 0 && <TablaProyectos lista={sueltos} />}

      {[...gruposPorBase.entries()].map(([nombreBase, subVistas]) => (
        <div key={nombreBase} className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-600">{nombreBase}</h2>
          <TablaProyectos lista={subVistas} />
        </div>
      ))}

      {proyectos.length === 0 && <p className="py-4 text-center text-gray-400">No hay proyectos todavía.</p>}

      {usuario?.esAdmin && (
        <div className="flex flex-wrap gap-6">
          <div className="w-full max-w-sm space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700">Proyectos base</h2>
            <p className="text-xs text-gray-500">
              Agrupan varias sub-vistas de un mismo proyecto real (ej. GoFixii con vistas de experto, admin,
              cliente y proveedor).
            </p>
            <ul className="space-y-1">
              {bases.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span className={b.activo ? 'text-gray-800' : 'text-gray-400 line-through'}>{b.nombre}</span>
                  <button type="button" onClick={() => alternarBase(b)} className="text-xs text-blue-600 hover:underline">
                    {b.activo ? 'Inactivar' : 'Reactivar'}
                  </button>
                </li>
              ))}
              {bases.length === 0 && <li className="text-xs text-gray-400">No hay proyectos base todavía.</li>}
            </ul>
            <form onSubmit={crearBase} className="flex gap-2">
              <input
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Nombre (ej. GoFixii)"
                value={formBase.nombre}
                onChange={(e) => setFormBase({ nombre: e.target.value })}
                required
              />
              <button
                type="submit"
                disabled={cargandoBase}
                className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {cargandoBase ? 'Creando...' : 'Crear'}
              </button>
            </form>
          </div>

          <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 rounded-lg border border-gray-200 bg-white p-4">
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
            <select
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={form.proyectoBaseId}
              onChange={(e) => setForm((f) => ({ ...f, proyectoBaseId: e.target.value, clonarDesdeProyectoId: '' }))}
            >
              <option value="">Sin proyecto base (suelto)</option>
              {bases
                .filter((b) => b.activo)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
            </select>
            {form.proyectoBaseId && subVistasDeLaBaseElegida.length > 0 && (
              <select
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={form.clonarDesdeProyectoId}
                onChange={(e) => setForm((f) => ({ ...f, clonarDesdeProyectoId: e.target.value }))}
              >
                <option value="">No clonar configuración (equipo/columnas por defecto)</option>
                {subVistasDeLaBaseElegida.map((p) => (
                  <option key={p.id} value={p.id}>
                    Clonar equipo y columnas de &quot;{p.nombre}&quot;
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {cargando ? 'Creando...' : 'Crear proyecto'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ProyectosPage;
