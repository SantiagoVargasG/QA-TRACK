import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { CAMPO_INPUT } from '../components/ui/campoClassName';

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
    return error ? (
      <p className="rounded-xl bg-red-50 px-4 py-3 font-body text-body-md text-red-700">{error}</p>
    ) : (
      <p className="font-body text-body-md text-on-surface-variant">Cargando…</p>
    );
  }

  return (
    <div>
      <h1 className="mb-8 font-headline text-headline-lg text-on-surface">Configurar: {proyecto.nombre}</h1>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 font-body text-body-md text-red-700">{error}</p>}
      {mensaje && (
        <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 font-body text-body-md text-green-700">{mensaje}</p>
      )}

      <Card className="mb-gutter p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-headline text-headline-md text-[18px] text-on-surface">Equipo del proyecto</h2>
          <Button variant="primary" onClick={guardarEquipo}>
            Guardar equipo
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-icon-bg">
                <th className="px-4 py-3 font-label-md text-[11px] uppercase tracking-widest text-outline-variant">
                  Usuario
                </th>
                <th className="px-4 py-3 font-label-md text-[11px] uppercase tracking-widest text-outline-variant">
                  Rol en este proyecto
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="px-4 py-3 font-body text-body-md text-on-surface">{u.nombre}</td>
                  <td className="px-4 py-3">
                    <select
                      className={`${CAMPO_INPUT} max-w-xs py-2`}
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
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-6 font-headline text-headline-md text-[18px] text-on-surface">Columnas de check</h2>
        <div className="space-y-3">
          {columnas.map((col, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className={`${CAMPO_INPUT} py-2 sm:flex-1`}
                placeholder="Nombre de columna"
                value={col.nombre}
                onChange={(e) => onCambiarColumna(index, 'nombre', e.target.value)}
              />
              <select
                className={`${CAMPO_INPUT} py-2 sm:w-48`}
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
                className={`${CAMPO_INPUT} py-2 sm:w-48`}
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
              <button
                type="button"
                onClick={() => quitarColumna(index)}
                className="font-label-md font-bold text-error transition-all hover:underline"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={agregarColumna}
            className="flex items-center gap-1 font-label-md font-bold text-primary transition-all hover:underline"
          >
            <Icon name="add_circle" />
            Agregar columna
          </button>
          <Button variant="primary" onClick={guardarColumnas}>
            Guardar columnas
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default ProyectoEquipoPage;
