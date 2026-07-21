import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, apiFetchBlob } from '../api/client';
import { useProyecto } from '../context/ProyectoContext';

const ESTADO_COLOR = {
  PENDIENTE: 'border-gray-200 bg-gray-50',
  FINALIZADO_DEV: 'border-blue-200 bg-blue-50',
  APROBADO: 'border-green-200 bg-green-50',
  RECHAZADO: 'border-red-200 bg-red-50',
  SOLUCIONADO: 'border-amber-200 bg-amber-50',
};

// Acciones habilitadas por estado actual del criterio y tipo de columna (espejo de
// ACCIONES/ACCIONES_POR_TIPO_COLUMNA en backend/src/services/criterio.service.js). El
// backend es quien valida rol/capacidad de verdad; esto solo decide qué botón mostrar.
const ACCIONES_DISPONIBLES = {
  PENDIENTE: { finalizado: [{ accion: 'finalizar', label: 'Marcar finalizado' }] },
  FINALIZADO_DEV: {
    aprobacion: [
      { accion: 'aprobar', label: 'Aprobar' },
      { accion: 'rechazar', label: 'Rechazar', modal: true },
    ],
  },
  RECHAZADO: { finalizado: [{ accion: 'solucionar', label: 'Marcar solucionado' }] },
  SOLUCIONADO: {
    aprobacion: [
      { accion: 'cerrar_caso', label: 'Cerrar caso' },
      { accion: 'rechazar', label: 'Rechazar', modal: true },
    ],
  },
  APROBADO: { aprobacion: [{ accion: 'reabrir', label: 'Reabrir' }] },
};

const ENTRADA_LABEL = {
  rechazo: 'Rechazado',
  solucion: 'Marcado como solucionado',
  reapertura: 'Reabierto',
  cierre: 'Caso cerrado',
};

function RechazarModal({ criterioId, columna, onClose, onRechazado }) {
  const [comentario, setComentario] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append('columna', columna);
      formData.append('accion', 'rechazar');
      formData.append('comentario', comentario);
      for (const archivo of archivos) formData.append('evidencias', archivo);
      await apiFetch(`/criterios/${criterioId}/check`, { method: 'POST', body: formData });
      onRechazado();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-gray-800">Rechazar criterio — columna {columna}</h3>
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Comentario (obligatorio)"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            required
          />
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
            onChange={(e) => setArchivos(Array.from(e.target.files))}
            className="block w-full text-xs text-gray-500"
          />
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {enviando ? 'Rechazando...' : 'Rechazar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EvidenciaPreview({ evidencia }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const esImagen = evidencia.tipoMime.startsWith('image/');

  useEffect(() => {
    let objectUrl;
    let cancelado = false;
    apiFetchBlob(`/uploads/${evidencia.archivo}`)
      .then((blob) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidencia.archivo]);

  if (error) return <p className="text-xs text-red-600">No se pudo cargar la evidencia</p>;
  if (!url) return <p className="text-xs text-gray-400">Cargando evidencia...</p>;

  return esImagen ? (
    <img src={url} alt="Evidencia adjunta" className="mt-1 max-h-40 rounded border border-gray-200" />
  ) : (
    <video src={url} controls className="mt-1 max-h-40 rounded border border-gray-200" />
  );
}

function HistoricoDrawer({ criterioId, onClose }) {
  const [reportes, setReportes] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    apiFetch(`/criterios/${criterioId}/reportes`)
      .then(setReportes)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [criterioId]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Histórico del criterio</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {cargando && <p className="mt-3 text-sm text-gray-400">Cargando...</p>}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {!cargando && reportes.length === 0 && (
          <p className="mt-3 text-sm text-gray-400">Sin reportes todavía.</p>
        )}
        <div className="mt-3 space-y-4">
          {reportes.map((reporte) => (
            <div key={reporte.id} className="rounded border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500">
                Caso {reporte.estadoCaso} — {new Date(reporte.createdAt).toLocaleString()}
              </p>
              <ul className="mt-2 space-y-3">
                {reporte.entradas.map((entrada, idx) => (
                  <li key={idx} className="border-l-2 border-gray-200 pl-3 text-sm">
                    <p className="font-medium text-gray-700">
                      {ENTRADA_LABEL[entrada.tipo] || entrada.tipo}
                      {entrada.porAdmin && (
                        <span className="ml-2 text-xs font-normal text-amber-600">(acción administrativa)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(entrada.fecha).toLocaleString()}</p>
                    {entrada.comentario && <p className="mt-1 text-gray-600">{entrada.comentario}</p>}
                    {entrada.evidencias?.map((ev) => (
                      <EvidenciaPreview key={ev.archivo} evidencia={ev} />
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const [modalColumna, setModalColumna] = useState(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

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
        <div className="flex items-center gap-2">
          {criterio.estado === 'SOLUCIONADO' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Corrección realizada
            </span>
          )}
          <span className="text-xs font-medium text-gray-500">{criterio.estado}</span>
          <button
            type="button"
            onClick={() => setMostrarHistorico(true)}
            className="text-xs text-gray-400 underline hover:text-gray-600"
          >
            Histórico
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-4">
        {columnasCheck.map((col) => {
          const check = criterio.checks.find((c) => c.columnaNombre === col.nombre);
          const acciones = ACCIONES_DISPONIBLES[criterio.estado]?.[col.tipo] || [];
          return (
            <div key={col.nombre} className="text-xs">
              <div className="font-medium text-gray-500">{col.nombre}</div>
              {check && <div className="text-gray-700">{check.valor}</div>}
              <div className="mt-1 flex gap-1">
                {acciones.map(({ accion, label, modal }) => (
                  <button
                    key={accion}
                    type="button"
                    onClick={() => (modal ? setModalColumna(col.nombre) : marcar(col.nombre, accion))}
                    className="rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50"
                  >
                    {label}
                  </button>
                ))}
                {acciones.length === 0 && !check && <span className="text-gray-300">—</span>}
              </div>
            </div>
          );
        })}
      </div>
      {modalColumna && (
        <RechazarModal
          criterioId={criterio.id}
          columna={modalColumna}
          onClose={() => setModalColumna(null)}
          onRechazado={onCambio}
        />
      )}
      {mostrarHistorico && (
        <HistoricoDrawer criterioId={criterio.id} onClose={() => setMostrarHistorico(false)} />
      )}
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
