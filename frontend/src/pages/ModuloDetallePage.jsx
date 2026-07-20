import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useProyecto } from '../context/ProyectoContext';

const ESTADO_COLOR = {
  PENDIENTE: 'border-gray-200 bg-gray-50',
  FINALIZADO_DEV: 'border-blue-200 bg-blue-50',
  APROBADO: 'border-green-200 bg-green-50',
  RECHAZADO: 'border-red-200 bg-red-50',
  SOLUCIONADO: 'border-amber-200 bg-amber-50',
};

const ACCION_POR_TIPO = { finalizado: 'finalizar', aprobacion: 'aprobar' };
const ESTADO_ORIGEN_POR_ACCION = { finalizar: 'PENDIENTE', aprobar: 'FINALIZADO_DEV' };

function NuevoCriterioForm({ historiaId, onCreado }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(`/historias/${historiaId}/criterios`, { method: 'POST', body: { texto } });
      setTexto('');
      onCreado();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex gap-2">
      <input
        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        placeholder="Texto del criterio de aceptación"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        required
      />
      <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700">
        Agregar CA
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}

function CriterioRow({ criterio, columnasCheck, onCambio }) {
  const [error, setError] = useState('');

  async function marcar(columnaNombre, accion) {
    setError('');
    try {
      await apiFetch(`/criterios/${criterio.id}/check`, {
        method: 'POST',
        body: { columna: columnaNombre, accion },
      });
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={`rounded border p-3 ${ESTADO_COLOR[criterio.estado] || 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-800">{criterio.texto}</p>
        <span className="text-xs font-medium text-gray-500">{criterio.estado}</span>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex gap-4">
        {columnasCheck.map((col) => {
          const check = criterio.checks.find((c) => c.columnaNombre === col.nombre);
          const accion = ACCION_POR_TIPO[col.tipo];
          const puedeAccionar = !check && criterio.estado === ESTADO_ORIGEN_POR_ACCION[accion];
          return (
            <div key={col.nombre} className="text-xs">
              <div className="font-medium text-gray-500">{col.nombre}</div>
              {check && <span className="text-gray-700">{check.valor}</span>}
              {!check && puedeAccionar && (
                <button
                  type="button"
                  onClick={() => marcar(col.nombre, accion)}
                  className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50"
                >
                  {accion === 'finalizar' ? 'Marcar finalizado' : 'Aprobar'}
                </button>
              )}
              {!check && !puedeAccionar && <span className="text-gray-300">—</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoriaItem({ historia, columnasCheck }) {
  const [expandida, setExpandida] = useState(false);
  const [criterios, setCriterios] = useState([]);
  const [error, setError] = useState('');

  async function cargarCriterios() {
    const data = await apiFetch(`/historias/${historia.id}/criterios`);
    setCriterios(data);
  }

  useEffect(() => {
    if (expandida) cargarCriterios().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandida]);

  return (
    <li className="rounded border border-gray-100">
      <button
        type="button"
        onClick={() => setExpandida((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
      >
        <span>
          <span className="font-mono text-xs text-gray-400">{historia.codigo}</span> — {historia.texto}
        </span>
        <span className="text-xs text-gray-400">{expandida ? '▲' : '▼'}</span>
      </button>
      {expandida && (
        <div className="space-y-2 border-t border-gray-100 p-3">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {criterios.map((c) => (
            <CriterioRow key={c.id} criterio={c} columnasCheck={columnasCheck} onCambio={cargarCriterios} />
          ))}
          {criterios.length === 0 && <p className="text-sm text-gray-400">Sin criterios de aceptación todavía.</p>}
          <NuevoCriterioForm historiaId={historia.id} onCreado={cargarCriterios} />
        </div>
      )}
    </li>
  );
}

function RequerimientoCard({ requerimiento, onCambio, columnasCheck }) {
  const [historias, setHistorias] = useState([]);
  const [error, setError] = useState('');

  async function cargarHistorias() {
    const data = await apiFetch(`/requerimientos/${requerimiento.id}/historias`);
    setHistorias(data);
  }

  useEffect(() => {
    cargarHistorias().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requerimiento.id]);

  async function eliminarRequerimiento() {
    try {
      await apiFetch(`/modulos/${requerimiento.moduloId}/requerimientos/${requerimiento.id}`, {
        method: 'DELETE',
      });
      onCambio();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-gray-800">{requerimiento.titulo}</h3>
          <p className="text-sm text-gray-500">{requerimiento.descripcionResumida}</p>
        </div>
        <button type="button" onClick={eliminarRequerimiento} className="text-xs text-red-600 hover:underline">
          Eliminar
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <ul className="mt-3 space-y-1">
        {historias.map((h) => (
          <HistoriaItem key={h.id} historia={h} columnasCheck={columnasCheck} />
        ))}
        {historias.length === 0 && <li className="text-sm text-gray-400">Sin historias de usuario todavía.</li>}
      </ul>

      <NuevaHistoriaForm requerimientoId={requerimiento.id} onCreada={cargarHistorias} />
    </div>
  );
}

function NuevaHistoriaForm({ requerimientoId, onCreada }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(`/requerimientos/${requerimientoId}/historias`, { method: 'POST', body: { texto } });
      setTexto('');
      onCreada();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex gap-2">
      <input
        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        placeholder="Como [rol], quiero [acción], para [beneficio]"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        required
      />
      <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700">
        Agregar HU
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}

function ModuloDetallePage() {
  const { moduloId } = useParams();
  const { proyectoActual } = useProyecto();
  const [requerimientos, setRequerimientos] = useState([]);
  const [form, setForm] = useState({ titulo: '', descripcionResumida: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    const data = await apiFetch(`/modulos/${moduloId}/requerimientos`);
    setRequerimientos(data);
  }

  useEffect(() => {
    cargar().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduloId]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch(`/modulos/${moduloId}/requerimientos`, { method: 'POST', body: form });
      setForm({ titulo: '', descripcionResumida: '' });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const columnasCheck = proyectoActual?.columnasCheck || [];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">Requerimientos</h1>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        {requerimientos.map((r) => (
          <RequerimientoCard key={r.id} requerimiento={r} onCambio={cargar} columnasCheck={columnasCheck} />
        ))}
        {requerimientos.length === 0 && <p className="text-gray-400">Sin requerimientos todavía.</p>}
      </div>

      <form onSubmit={onSubmit} className="max-w-lg space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">Nuevo requerimiento</h2>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Título"
          value={form.titulo}
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          required
        />
        <textarea
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Descripción resumida (máx. 500 caracteres)"
          maxLength={500}
          value={form.descripcionResumida}
          onChange={(e) => setForm((f) => ({ ...f, descripcionResumida: e.target.value }))}
          required
        />
        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear requerimiento'}
        </button>
      </form>
    </div>
  );
}

export default ModuloDetallePage;
