import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';

const TIPOS_COLUMNA = [
  { valor: 'finalizado', etiqueta: 'Finalizado' },
  { valor: 'aprobacion', etiqueta: 'Aprobación' },
];

function ProyectoEquipoPage() {
  const { id } = useParams();
  const [proyecto, setProyecto] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [seleccionEquipo, setSeleccionEquipo] = useState({});
  const [columnas, setColumnas] = useState([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function cargarTodo() {
    const [p, u, r] = await Promise.all([
      apiFetch(`/proyectos/${id}`),
      apiFetch('/usuarios'),
      apiFetch('/roles'),
    ]);
    setProyecto(p);
    setUsuarios(u);
    setRoles(r);
    setColumnas(p.columnasCheck);
    const seleccion = {};
    p.equipo.forEach((m) => {
      seleccion[m.usuarioId] = m.rolId;
    });
    setSeleccionEquipo(seleccion);
  }

  useEffect(() => {
    cargarTodo().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function onCambiarRolUsuario(usuarioId, rolId) {
    setSeleccionEquipo((s) => {
      const copia = { ...s };
      if (rolId) copia[usuarioId] = rolId;
      else delete copia[usuarioId];
      return copia;
    });
  }

  async function guardarEquipo() {
    setError('');
    setMensaje('');
    try {
      const equipo = Object.entries(seleccionEquipo).map(([usuarioId, rolId]) => ({ usuarioId, rolId }));
      await apiFetch(`/proyectos/${id}/equipo`, { method: 'PUT', body: { equipo } });
      setMensaje('Equipo actualizado.');
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  }

  function onCambiarColumna(index, campo, valor) {
    setColumnas((c) => c.map((col, i) => (i === index ? { ...col, [campo]: valor } : col)));
  }

  function agregarColumna() {
    setColumnas((c) => [...c, { nombre: '', tipo: 'finalizado', rolId: '' }]);
  }

  function quitarColumna(index) {
    setColumnas((c) => c.filter((_, i) => i !== index));
  }

  async function guardarColumnas() {
    setError('');
    setMensaje('');
    try {
      await apiFetch(`/proyectos/${id}/columnas-check`, {
        method: 'PUT',
        body: { columnasCheck: columnas.map((c) => ({ ...c, rolId: c.rolId || null })) },
      });
      setMensaje('Columnas de check actualizadas.');
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!proyecto) {
    return error ? <p className="text-red-700">{error}</p> : <p>Cargando...</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-800">Configurar: {proyecto.nombre}</h1>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {mensaje && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{mensaje}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Equipo</h2>
        <table className="w-full max-w-xl text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Usuario</th>
              <th className="py-2">Rol en este proyecto</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="py-2">{u.nombre}</td>
                <td className="py-2">
                  <select
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                    value={seleccionEquipo[u.id] || ''}
                    onChange={(e) => onCambiarRolUsuario(u.id, e.target.value)}
                  >
                    <option value="">No es miembro</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={guardarEquipo}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Guardar equipo
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Columnas de check</h2>
        <div className="max-w-2xl space-y-2">
          {columnas.map((col, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                placeholder="Nombre de columna"
                value={col.nombre}
                onChange={(e) => onCambiarColumna(index, 'nombre', e.target.value)}
              />
              <select
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                value={col.tipo}
                onChange={(e) => onCambiarColumna(index, 'tipo', e.target.value)}
              >
                {TIPOS_COLUMNA.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                value={col.rolId || ''}
                onChange={(e) => onCambiarColumna(index, 'rolId', e.target.value)}
              >
                <option value="">Sin rol asignado</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => quitarColumna(index)} className="text-red-600 hover:underline">
                Quitar
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={agregarColumna} className="text-sm text-blue-600 hover:underline">
            + Agregar columna
          </button>
          <button
            type="button"
            onClick={guardarColumnas}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Guardar columnas
          </button>
        </div>
      </section>
    </div>
  );
}

export default ProyectoEquipoPage;
