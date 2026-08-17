import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFetch, apiFetchBlob } from '../api/client';
import { useProyecto } from '../context/ProyectoContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon, { IconBadge } from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { CAMPO_INPUT } from '../components/ui/campoClassName';

// Feedback inmediato en el cliente antes de mandar el enlace de una HU — el backend
// (validarUrlOpcional) es quien revalida de verdad, esto solo evita el viaje de red para el
// caso obvio de una URL mal formada.
function urlValida(valor) {
  if (!valor) return true;
  try {
    const parsed = new URL(valor);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const ESTADO_COLOR = {
  PENDIENTE: 'border-outline-variant bg-surface-container-lowest',
  FINALIZADO_DEV: 'border-blue-200 bg-blue-50',
  APROBADO: 'border-green-200 bg-green-50',
  RECHAZADO: 'border-red-200 bg-red-50',
  SOLUCIONADO: 'border-amber-200 bg-amber-50',
};

// Etiqueta legible del estado vigente del criterio. RECHAZADO se lee como "En corrección"
// porque, dentro del flujo real, ese estado significa que hay un reproceso pendiente de
// Dev — no es el punto final del criterio, solo el nombre técnico del enum lo hacía sonar
// así.
const ESTADO_LABEL = {
  PENDIENTE: 'Pendiente',
  FINALIZADO_DEV: 'Finalizado (Dev)',
  APROBADO: 'Aprobado',
  RECHAZADO: 'En corrección',
  SOLUCIONADO: 'Solucionado',
};

// Etiqueta legible + si dispara el modal de rechazo, para cada ACCIÓN que el backend ya
// marcó como disponible en `criterio.accionesPermitidas` (ver GET /historias/:id/criterios,
// Parte A). Esto NO recalcula quién puede hacer qué — no tiene estados de origen ni tipos
// de columna, es solo texto de presentación para una acción que el backend ya autorizó.
const ACCION_OPCION = {
  finalizar: { label: 'Marcar finalizado' },
  aprobar: { label: 'Aprobar' },
  rechazar: { label: 'Rechazar', modal: true },
  solucionar: { label: 'Marcar solucionado' },
  cerrar_caso: { label: 'Cerrar caso' },
  reabrir: { label: 'Reabrir' },
};

// Selector de estado "tipo Jira": una píldora coloreada (ESTADO_COLOR + ESTADO_LABEL) que,
// si `accionesPermitidas` (dato del backend, Parte A) trae opciones, abre un menú con
// exactamente esas transiciones — nunca la lista completa de estados. Si viene vacío, el
// botón queda deshabilitado: modo lectura para quien no le corresponde actuar. El backend
// sigue siendo quien valida cada transición en el clic (aplicarCheck); esto solo decide qué
// mostrar.
function SelectorEstado({ estado, accionesPermitidas, disabled, onSeleccionar }) {
  const [abierto, setAbierto] = useState(false);
  const soloLectura = accionesPermitidas.length === 0;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={soloLectura || disabled}
        onClick={() => setAbierto((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-label-md text-[12px] font-bold uppercase tracking-wide transition-colors disabled:cursor-default ${
          ESTADO_COLOR[estado] || 'border-outline-variant bg-surface-container-lowest'
        } ${soloLectura ? 'opacity-80' : 'hover:brightness-95'}`}
      >
        {ESTADO_LABEL[estado] || estado}
        {!soloLectura && <Icon name="expand_more" className={`text-[16px] transition-transform ${abierto ? 'rotate-180' : ''}`} />}
      </button>
      {abierto && !soloLectura && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-20 mt-1 min-w-[190px] overflow-hidden rounded-xl border border-icon-bg bg-surface-container-lowest card-shadow">
            {accionesPermitidas.map(({ accion, columna }) => (
              <button
                key={`${accion}-${columna}`}
                type="button"
                onClick={() => {
                  setAbierto(false);
                  onSeleccionar(accion, columna);
                }}
                className="block w-full px-4 py-2.5 text-left font-body text-body-md text-on-surface transition-colors hover:bg-surface-container-low"
              >
                {ACCION_OPCION[accion]?.label || accion}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const ENTRADA_LABEL = {
  rechazo: 'Rechazado',
  solucion: 'Marcado como solucionado',
  reapertura: 'Reabierto',
  cierre: 'Caso cerrado',
};

// Color por VALOR literal de check.valor (finalizado/aprobado/rechazado/solucionado), tal
// como lo devuelve el backend hoy — no es un mapeo por rol (Dev/QA), solo un tratamiento
// visual del mismo dato que ya se mostraba en texto. Una columna sin check todavía se
// pinta siempre neutro ("Sin evaluar"), nunca con un color que implique un estado que no
// tiene.
const VALOR_PILL = {
  finalizado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-700',
  solucionado: 'bg-amber-100 text-amber-700',
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
    <Modal open onClose={onClose}>
      <h3 className="mb-6 font-headline text-headline-md text-on-surface">Rechazar criterio — columna {columna}</h3>
      <form onSubmit={onSubmit} className="space-y-4">
        <textarea
          className={CAMPO_INPUT}
          placeholder="Comentario (obligatorio)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={4}
          required
        />
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
          onChange={(e) => setArchivos(Array.from(e.target.files))}
          className="block w-full font-body text-body-md text-on-surface-variant file:mr-3 file:rounded-full file:border-0 file:bg-icon-bg file:px-4 file:py-2 file:font-label-md file:font-bold file:text-primary"
        />
        {error && <p className="font-body text-body-md text-error">{error}</p>}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-outline-variant px-6 py-3 font-body text-label-md font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 rounded-xl bg-error px-6 py-3 font-body text-label-md font-bold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
          >
            {enviando ? 'Rechazando…' : 'Rechazar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EvidenciaPreview({ evidencia }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(false);
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

  if (error) return <p className="font-body text-body-md text-error">No se pudo cargar la evidencia</p>;
  if (!url) return <p className="font-body text-body-md text-on-surface-variant/60">Cargando evidencia…</p>;

  return (
    <>
      {esImagen ? (
        <button type="button" onClick={() => setAbierta(true)} title="Ver imagen en grande" className="mt-2 block">
          <img
            src={url}
            alt="Evidencia adjunta"
            className="max-h-40 rounded-xl border border-outline-variant transition-opacity hover:opacity-80"
          />
        </button>
      ) : (
        // El <video> conserva sus propios controles nativos (play/pausa/volumen) sin
        // interferencia — envolverlo en un <button> rompería esos controles (elemento
        // interactivo anidado dentro de otro). El ícono de expandir es un botón aparte,
        // superpuesto, que abre la versión grande sin tocar el video de la miniatura.
        <div className="relative mt-2 inline-block">
          <video src={url} controls className="max-h-40 rounded-xl border border-outline-variant" />
          <button
            type="button"
            onClick={() => setAbierta(true)}
            title="Ver video en grande"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-on-surface/60 text-white transition-colors hover:bg-on-surface/80"
          >
            <Icon name="fullscreen" className="text-[16px]" />
          </button>
        </div>
      )}
      <Modal open={abierta} onClose={() => setAbierta(false)} maxWidth="max-w-3xl">
        <button
          type="button"
          onClick={() => setAbierta(false)}
          title="Cerrar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
        >
          <Icon name="close" />
        </button>
        {esImagen ? (
          <img src={url} alt="Evidencia adjunta" className="max-h-[80vh] w-full rounded-xl object-contain" />
        ) : (
          <video src={url} controls autoPlay className="max-h-[80vh] w-full rounded-xl" />
        )}
      </Modal>
    </>
  );
}

// Ítems de la línea de tiempo "Actividad" de un criterio, fusionados en el cliente a partir
// de DOS fuentes que siguen siendo colecciones separadas en el backend: comentarios libres
// (Comentario) y entradas de Reporte (rechazo/solucion/reapertura/cierre). El campo `tipo`
// de cada ítem viene directo del dato de origen — 'comentario' para uno, `entrada.tipo` para
// el otro — nunca se reinterpreta, así que un rechazo no puede terminar etiquetado como
// comentario libre ni viceversa. Ver fusionarActividad() en CriterioRow.
const ACTIVIDAD_LABEL = { comentario: 'Comentario', ...ENTRADA_LABEL };
const ACTIVIDAD_ICON = {
  comentario: 'chat_bubble',
  rechazo: 'cancel',
  solucion: 'build',
  reapertura: 'refresh',
  cierre: 'task_alt',
};
const ACTIVIDAD_COLOR = {
  comentario: 'text-on-surface-variant',
  rechazo: 'text-red-600',
  solucion: 'text-amber-600',
  reapertura: 'text-amber-600',
  cierre: 'text-green-600',
};

function NuevoCriterioForm({ historiaId, onCreado }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await apiFetch(`/historias/${historiaId}/criterios`, { method: 'POST', body: { texto } });
      setTexto('');
      setAbierto(false);
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1 font-label-md text-[13px] font-bold text-primary hover:underline"
      >
        <Icon name="add_circle" className="text-[16px]" /> Añadir criterio
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        className={CAMPO_INPUT}
        placeholder="Texto del criterio de aceptación"
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        required
        autoFocus
      />
      {error && <p className="font-body text-body-md text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={enviando} className="flex-shrink-0">
          {enviando ? 'Agregando…' : 'Agregar'}
        </Button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="flex-shrink-0 font-label-md text-[13px] font-bold text-on-surface-variant hover:text-on-surface"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CriterioRow({ criterio, columnasCheck, onCambio }) {
  const [error, setError] = useState('');
  const [modalColumna, setModalColumna] = useState(null);
  const [editando, setEditando] = useState(false);
  const [textoEdit, setTextoEdit] = useState(criterio.texto);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  // El backend ya es seguro ante un doble clic (la transición se reclama atómicamente y la
  // segunda request concurrente recibe 400), pero deshabilitar el botón mientras hay una
  // request en vuelo evita mandarla siquiera: mejor UX, un clic de más no debe mostrar error.
  const [enviando, setEnviando] = useState(false);
  // "Actividad": único desplegable que fusiona EN EL CLIENTE dos fuentes que siguen siendo
  // colecciones separadas en el backend — comentarios libres (Comentario, sin relación con
  // la máquina de estados) y entradas de Reporte (rechazo/solucion/reapertura/cierre,
  // generadas solo por aplicarCheck()). Ver fusionarActividad() más abajo.
  const [mostrarActividad, setMostrarActividad] = useState(false);
  const [actividad, setActividad] = useState([]);
  const [cargandoActividad, setCargandoActividad] = useState(false);
  const [errorActividad, setErrorActividad] = useState('');
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [archivosComentario, setArchivosComentario] = useState([]);
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // El `tipo` y las `evidencias` de cada ítem se copian tal cual del dato de origen, sin
  // reinterpretarlos: un comentario libre siempre nace con tipo 'comentario' (nunca toca una
  // entrada de Reporte), y una entrada de Reporte conserva su `entrada.tipo` y SU PROPIO
  // arreglo de evidencias (no se comparten entre ítems ni se recalculan) — así un rechazo
  // jamás puede terminar mostrado como comentario libre ni viceversa, y una evidencia nunca
  // queda asociada a una entrada que no sea la suya.
  function fusionarActividad(comentarios, reportes) {
    const itemsComentario = comentarios.map((c) => ({
      id: `comentario-${c.id}`,
      tipo: 'comentario',
      fecha: c.fecha,
      texto: c.texto,
      evidencias: c.evidencias,
    }));
    const itemsReporte = reportes.flatMap((reporte) =>
      reporte.entradas.map((entrada, idx) => ({
        id: `reporte-${reporte.id}-${idx}`,
        tipo: entrada.tipo,
        fecha: entrada.fecha,
        texto: entrada.comentario,
        evidencias: entrada.evidencias,
        porAdmin: entrada.porAdmin,
      })),
    );
    return [...itemsComentario, ...itemsReporte].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }

  async function cargarActividad() {
    setCargandoActividad(true);
    try {
      const [comentarios, reportes] = await Promise.all([
        apiFetch(`/criterios/${criterio.id}/comentarios`),
        apiFetch(`/criterios/${criterio.id}/reportes`),
      ]);
      setActividad(fusionarActividad(comentarios, reportes));
    } catch (err) {
      setErrorActividad(err.message);
    } finally {
      setCargandoActividad(false);
    }
  }

  useEffect(() => {
    if (mostrarActividad) cargarActividad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarActividad]);

  // Los archivos seleccionados por el picker y los pegados desde el portapapeles conviven
  // en el mismo estado `archivosComentario` — una imagen pegada no aparece en el
  // <input type="file"> nativo, así que esta lista propia (con chips removibles en el
  // render) es la única forma de que quien comenta vea confirmado que quedó adjunta.
  function agregarArchivos(nuevos) {
    setArchivosComentario((actuales) => [...actuales, ...nuevos]);
  }

  function quitarArchivo(index) {
    setArchivosComentario((actuales) => actuales.filter((_, i) => i !== index));
  }

  function onPasteComentario(e) {
    const imagenes = Array.from(e.clipboardData?.items || [])
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (imagenes.length > 0) agregarArchivos(imagenes);
  }

  async function enviarComentario(e) {
    e.preventDefault();
    setErrorActividad('');
    setEnviandoComentario(true);
    try {
      const formData = new FormData();
      formData.append('texto', nuevoComentario);
      for (const archivo of archivosComentario) formData.append('evidencias', archivo);
      await apiFetch(`/criterios/${criterio.id}/comentarios`, { method: 'POST', body: formData });
      setNuevoComentario('');
      setArchivosComentario([]);
      await cargarActividad();
    } catch (err) {
      setErrorActividad(err.message);
    } finally {
      setEnviandoComentario(false);
    }
  }

  async function marcar(columnaNombre, accion) {
    setError('');
    setEnviando(true);
    try {
      await apiFetch(`/criterios/${criterio.id}/check`, {
        method: 'POST',
        body: { columna: columnaNombre, accion },
      });
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  function onSeleccionar(accion, columna) {
    if (ACCION_OPCION[accion]?.modal) setModalColumna(columna);
    else marcar(columna, accion);
  }

  function abrirEdicion() {
    setTextoEdit(criterio.texto);
    setError('');
    setEditando(true);
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await apiFetch(`/historias/${criterio.historiaId}/criterios/${criterio.id}`, {
        method: 'PUT',
        body: { texto: textoEdit },
      });
      setEditando(false);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCriterio() {
    setEliminando(true);
    try {
      await apiFetch(`/historias/${criterio.historiaId}/criterios/${criterio.id}`, { method: 'DELETE' });
      onCambio();
    } catch (err) {
      setError(err.message);
      setConfirmandoEliminar(false);
    } finally {
      setEliminando(false);
    }
  }

  if (editando) {
    return (
      <div className={`rounded-xl border p-4 ${ESTADO_COLOR[criterio.estado] || 'border-outline-variant'}`}>
        <form onSubmit={guardarEdicion} className="space-y-2">
          <textarea
            className={CAMPO_INPUT}
            rows={2}
            value={textoEdit}
            onChange={(e) => setTextoEdit(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="font-body text-body-md text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="font-label-md text-[12px] font-bold text-on-surface-variant hover:underline"
            >
              Cancelar
            </button>
            <Button type="submit" variant="primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${ESTADO_COLOR[criterio.estado] || 'border-outline-variant'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon name="radio_button_checked" className="mt-0.5 text-[18px] text-primary" />
          <p className="whitespace-pre-wrap font-body text-body-md text-on-surface">{criterio.texto}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <SelectorEstado
            estado={criterio.estado}
            accionesPermitidas={criterio.accionesPermitidas || []}
            disabled={enviando}
            onSeleccionar={onSeleccionar}
          />
          <button
            type="button"
            onClick={() => setMostrarActividad((v) => !v)}
            className="flex items-center gap-0.5 font-label-md text-[12px] font-bold text-on-surface-variant underline decoration-dotted hover:text-primary"
          >
            Actividad
            <Icon
              name="expand_more"
              className={`text-[16px] transition-transform ${mostrarActividad ? 'rotate-180' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={abrirEdicion}
            title="Editar criterio"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant/50 transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <Icon name="edit" className="text-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoEliminar(true)}
            title="Eliminar criterio"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant/50 transition-colors hover:bg-error/10 hover:text-error"
          >
            <Icon name="delete" className="text-[18px]" />
          </button>
        </div>
      </div>
      {error && <p className="mt-2 font-body text-body-md text-error">{error}</p>}
      {/* Registro por columna: dato histórico/secundario (qué pasó por última vez en cada
          columna), subordinado al estado vigente de arriba — nunca debe confundirse con él. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-outline-variant/40 pt-3">
        {columnasCheck.map((col) => {
          const check = criterio.checks.find((c) => c.columnaNombre === col.nombre);
          return (
            <div key={col.nombre} className="flex items-center gap-1.5">
              <span className="font-label-md text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/50">
                {col.nombre}:
              </span>
              {check ? (
                <span
                  className={`rounded-full px-2 py-0.5 font-label-md text-[10px] font-bold uppercase ${
                    VALOR_PILL[check.valor] || 'bg-surface-variant text-on-surface-variant'
                  }`}
                >
                  {check.valor}
                </span>
              ) : (
                <span className="rounded-full bg-surface-variant px-2 py-0.5 font-label-md text-[10px] font-bold uppercase text-on-surface-variant/50">
                  Sin evaluar
                </span>
              )}
            </div>
          );
        })}
      </div>
      {mostrarActividad && (
        <div className="mt-3 space-y-3 border-t border-outline-variant/40 pt-3">
          {cargandoActividad && (
            <p className="font-body text-body-md text-on-surface-variant">Cargando actividad…</p>
          )}
          {errorActividad && <p className="font-body text-body-md text-error">{errorActividad}</p>}
          {!cargandoActividad && actividad.length === 0 && (
            <p className="font-body text-body-md italic text-on-surface-variant/70">Sin actividad todavía.</p>
          )}
          <ul className="space-y-2">
            {actividad.map((item) => (
              <li key={item.id} className="flex items-start gap-2 rounded-lg bg-surface-container-low/60 p-3">
                <Icon
                  name={ACTIVIDAD_ICON[item.tipo] || 'chat_bubble'}
                  className={`mt-0.5 text-[16px] ${ACTIVIDAD_COLOR[item.tipo] || 'text-on-surface-variant'}`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-label-md text-[11px] font-bold uppercase tracking-wide ${
                      ACTIVIDAD_COLOR[item.tipo] || 'text-on-surface-variant'
                    }`}
                  >
                    {ACTIVIDAD_LABEL[item.tipo] || item.tipo}
                    {item.porAdmin && (
                      <span className="ml-2 font-label-md text-[11px] font-normal normal-case text-amber-600">
                        (acción administrativa)
                      </span>
                    )}
                  </p>
                  <p className="font-label-md text-[11px] text-on-surface-variant/70">
                    {new Date(item.fecha).toLocaleString()}
                  </p>
                  {item.texto && (
                    <p className="mt-1 whitespace-pre-wrap font-body text-body-md text-on-surface">{item.texto}</p>
                  )}
                  {item.evidencias?.map((ev) => (
                    <EvidenciaPreview key={ev.archivo} evidencia={ev} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <form onSubmit={enviarComentario} className="space-y-2">
            <textarea
              className={CAMPO_INPUT}
              placeholder="Agregar un comentario… (podés pegar una imagen con Ctrl+V)"
              rows={2}
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              onPaste={onPasteComentario}
              required
            />
            {archivosComentario.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {archivosComentario.map((archivo, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-1 rounded-full bg-icon-bg px-3 py-1 font-label-md text-[11px] font-bold text-primary"
                  >
                    {archivo.name}
                    <button
                      type="button"
                      onClick={() => quitarArchivo(idx)}
                      title="Quitar archivo"
                      className="text-primary/70 hover:text-error"
                    >
                      <Icon name="close" className="text-[14px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between gap-2">
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                onChange={(e) => {
                  agregarArchivos(Array.from(e.target.files));
                  e.target.value = '';
                }}
                className="block flex-1 font-body text-body-md text-on-surface-variant file:mr-3 file:rounded-full file:border-0 file:bg-icon-bg file:px-4 file:py-2 file:font-label-md file:font-bold file:text-primary"
              />
              <Button type="submit" variant="primary" disabled={enviandoComentario} className="flex-shrink-0">
                {enviandoComentario ? 'Enviando…' : 'Comentar'}
              </Button>
            </div>
          </form>
        </div>
      )}
      {modalColumna && (
        <RechazarModal
          criterioId={criterio.id}
          columna={modalColumna}
          onClose={() => setModalColumna(null)}
          onRechazado={onCambio}
        />
      )}
      <ConfirmDialog
        open={confirmandoEliminar}
        titulo="¿Eliminar este criterio?"
        mensaje="Puede tener reportes e histórico asociados que dejarán de ser consultables."
        textoConfirmar="Eliminar"
        cargando={eliminando}
        onCancelar={() => setConfirmandoEliminar(false)}
        onConfirmar={eliminarCriterio}
      />
    </div>
  );
}

function EnviarWebhookHistoria({ historiaId }) {
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function enviar() {
    setError('');
    setMensaje('');
    setEnviando(true);
    try {
      const resultado = await apiFetch(`/historias/${historiaId}/reportar-webhook`, { method: 'POST' });
      const resumen = resultado.resultado === 'aprobada' ? 'Aprobada ✅' : 'Rechazada ❌';
      setMensaje(`${resumen} — ${resultado.webhooksNotificados} webhook(s) notificados`);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-label-md text-[12px] font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
      >
        <Icon name="send" className="text-[14px]" />
        {enviando ? 'Enviando…' : 'Enviar a webhook'}
      </button>
      {mensaje && <span className="font-label-md text-[12px] font-bold text-green-700">{mensaje}</span>}
      {error && <span className="font-label-md text-[12px] font-bold text-error">{error}</span>}
    </div>
  );
}

function HistoriaItem({ historia, columnasCheck, historiaEnfocada, onCambio }) {
  const enfocada = historiaEnfocada === historia.id;
  const [expandida, setExpandida] = useState(enfocada);
  const [textoCompleto, setTextoCompleto] = useState(false);
  const [textoTruncado, setTextoTruncado] = useState(false);
  const [criterios, setCriterios] = useState([]);
  const [error, setError] = useState('');
  const elementoRef = useRef(null);
  const textoRef = useRef(null);
  const [editando, setEditando] = useState(false);
  const [textoEdit, setTextoEdit] = useState(historia.texto);
  const [enlaceEdit, setEnlaceEdit] = useState(historia.enlace || '');
  const [errorEdicion, setErrorEdicion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  async function cargarCriterios() {
    const data = await apiFetch(`/historias/${historia.id}/criterios`);
    setCriterios(data);
  }

  useEffect(() => {
    if (expandida) cargarCriterios().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandida]);

  // "Ver más" solo debe aparecer si el line-clamp-2 realmente recorta el texto — medirlo por
  // cantidad de caracteres es poco fiable (depende del ancho real del contenedor y del
  // idioma). Se mide contra el DOM mientras el texto sigue clampeado (textoCompleto=false);
  // una vez detectado que desborda, ese resultado no se vuelve a pisar al expandir (ver el
  // guard `!textoCompleto` de abajo), porque al expandir el clamp se saca y ya no hay overflow
  // que medir.
  useEffect(() => {
    const el = textoRef.current;
    if (el && !textoCompleto) {
      setTextoTruncado(el.scrollHeight > el.clientHeight + 1);
    }
  }, [historia.texto, textoCompleto]);

  // Deep link desde un webhook ("Abrir HU"): si esta es la HU indicada por ?hu=... en la
  // URL, se expande sola (arriba, en el estado inicial) y además se desplaza a la vista y se
  // resalta brevemente, para que no quede fuera de pantalla dentro de un módulo con muchas HU.
  useEffect(() => {
    if (enfocada) elementoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirEdicion() {
    setTextoEdit(historia.texto);
    setEnlaceEdit(historia.enlace || '');
    setErrorEdicion('');
    setEditando(true);
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    if (!urlValida(enlaceEdit)) {
      setErrorEdicion('El enlace no tiene un formato de URL válido (http/https).');
      return;
    }
    setErrorEdicion('');
    setGuardando(true);
    try {
      await apiFetch(`/requerimientos/${historia.requerimientoId}/historias/${historia.id}`, {
        method: 'PUT',
        body: { texto: textoEdit, enlace: enlaceEdit },
      });
      setEditando(false);
      onCambio();
    } catch (err) {
      setErrorEdicion(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarHistoria() {
    setEliminando(true);
    try {
      await apiFetch(`/requerimientos/${historia.requerimientoId}/historias/${historia.id}`, {
        method: 'DELETE',
      });
      onCambio();
    } catch (err) {
      setError(err.message);
      setConfirmandoEliminar(false);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <li
      ref={elementoRef}
      className={`overflow-hidden rounded-xl border bg-surface-container-lowest transition-colors ${
        enfocada ? 'border-primary ring-2 ring-primary/20' : 'border-icon-bg'
      }`}
    >
      {editando ? (
        <form onSubmit={guardarEdicion} className="space-y-3 p-4">
          <textarea
            className={CAMPO_INPUT}
            rows={3}
            value={textoEdit}
            onChange={(e) => setTextoEdit(e.target.value)}
            required
            autoFocus
          />
          <input
            className={CAMPO_INPUT}
            type="url"
            placeholder="Enlace de diseño o recurso (opcional)"
            value={enlaceEdit}
            onChange={(e) => setEnlaceEdit(e.target.value)}
          />
          {errorEdicion && <p className="font-body text-body-md text-error">{errorEdicion}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-full px-4 py-2 font-label-md text-label-md font-bold text-on-surface-variant hover:bg-surface-container-low"
            >
              Cancelar
            </button>
            <Button type="submit" variant="primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start">
          <button
            type="button"
            onClick={() => setExpandida((v) => !v)}
            className="flex min-w-0 flex-1 items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-surface-container-low"
          >
            <span className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 rounded bg-primary-container px-2 py-1 font-label-md text-[10px] font-bold uppercase text-white">
                {historia.codigo}
              </span>
              <span
                ref={textoRef}
                className={`min-w-0 whitespace-pre-wrap font-body text-body-md font-bold text-on-surface ${
                  textoCompleto ? '' : 'line-clamp-2'
                }`}
              >
                {historia.texto}
              </span>
            </span>
            <Icon
              name="expand_more"
              className={`mt-0.5 flex-shrink-0 text-on-surface-variant transition-transform ${expandida ? 'rotate-180' : ''}`}
            />
          </button>
          <div className="flex flex-shrink-0 items-center gap-1 py-3 pr-3">
            <button
              type="button"
              onClick={abrirEdicion}
              title="Editar historia"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant/50 transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              <Icon name="edit" className="text-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoEliminar(true)}
              title="Eliminar historia"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant/50 transition-colors hover:bg-error/10 hover:text-error"
            >
              <Icon name="delete" className="text-[18px]" />
            </button>
          </div>
        </div>
      )}
      {!editando && textoTruncado && (
        <div className="-mt-2 px-4 pb-2">
          <button
            type="button"
            onClick={() => setTextoCompleto((v) => !v)}
            className="font-label-md text-[12px] font-bold text-primary hover:underline"
          >
            {textoCompleto ? 'Ver menos' : 'Ver más…'}
          </button>
        </div>
      )}
      {!editando && historia.enlace && (
        <div className="-mt-2 px-4 pb-2">
          <a
            href={historia.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-label-md text-[12px] font-bold text-primary hover:underline"
          >
            <Icon name="link" className="text-[14px]" />
            Enlace de diseño o recurso
          </a>
        </div>
      )}
      {!editando && expandida && (
        <div className="space-y-3 border-t border-icon-bg p-4">
          {error && <p className="font-body text-body-md text-error">{error}</p>}
          <EnviarWebhookHistoria historiaId={historia.id} />
          <div className="space-y-3 border-l-2 border-outline-variant pl-4">
            {criterios.map((c) => (
              <CriterioRow key={c.id} criterio={c} columnasCheck={columnasCheck} onCambio={cargarCriterios} />
            ))}
            {criterios.length === 0 && (
              <p className="font-body text-body-md italic text-on-surface-variant/70">
                Sin criterios de aceptación todavía.
              </p>
            )}
            <NuevoCriterioForm historiaId={historia.id} onCreado={cargarCriterios} />
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmandoEliminar}
        titulo="¿Eliminar esta historia de usuario?"
        mensaje="Sus criterios de aceptación y el histórico de reportes dejarán de estar disponibles."
        textoConfirmar="Eliminar"
        cargando={eliminando}
        onCancelar={() => setConfirmandoEliminar(false)}
        onConfirmar={eliminarHistoria}
      />
    </li>
  );
}

function NuevaHistoriaForm({ requerimientoId, onCreada }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!urlValida(enlace)) {
      setError('El enlace no tiene un formato de URL válido (http/https).');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      await apiFetch(`/requerimientos/${requerimientoId}/historias`, {
        method: 'POST',
        body: { texto, enlace },
      });
      setTexto('');
      setEnlace('');
      setAbierto(false);
      onCreada();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="flex justify-end pt-1">
        <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
          <Icon name="post_add" className="text-[18px]" />
          Agregar HU
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <textarea
        className={CAMPO_INPUT}
        placeholder="Como [rol], quiero [acción], para [beneficio]"
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        required
        autoFocus
      />
      <input
        className={CAMPO_INPUT}
        type="url"
        placeholder="Enlace de diseño o recurso (opcional)"
        value={enlace}
        onChange={(e) => setEnlace(e.target.value)}
      />
      {error && <p className="font-body text-body-md text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-full px-4 py-2 font-label-md text-label-md font-bold text-on-surface-variant hover:bg-surface-container-low"
        >
          Cancelar
        </button>
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? 'Agregando…' : 'Agregar HU'}
        </Button>
      </div>
    </form>
  );
}

function RequerimientoCard({ requerimiento, onCambio, columnasCheck, historiaEnfocada }) {
  const [historias, setHistorias] = useState([]);
  const [error, setError] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  async function cargarHistorias() {
    const data = await apiFetch(`/requerimientos/${requerimiento.id}/historias`);
    setHistorias(data);
  }

  useEffect(() => {
    cargarHistorias().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requerimiento.id]);

  async function eliminarRequerimiento() {
    setEliminando(true);
    try {
      await apiFetch(`/modulos/${requerimiento.moduloId}/requerimientos/${requerimiento.id}`, {
        method: 'DELETE',
      });
      onCambio();
    } catch (err) {
      setError(err.message);
      setConfirmandoEliminar(false);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-icon-bg p-6">
        <div className="flex gap-4">
          <IconBadge name="assignment" />
          <div>
            <h3 className="font-headline text-headline-md text-[18px] text-on-surface">{requerimiento.titulo}</h3>
            <p className="mt-1 max-w-2xl font-body text-body-md text-on-surface-variant">
              {requerimiento.descripcionResumida}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmandoEliminar(true)}
          title="Eliminar requerimiento"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant/50 transition-colors hover:bg-error/10 hover:text-error"
        >
          <Icon name="delete" />
        </button>
      </div>

      {error && <p className="px-6 pt-4 font-body text-body-md text-error">{error}</p>}

      <div className="space-y-3 bg-surface-container-low/40 p-4">
        {historias.map((h) => (
          <HistoriaItem
            key={h.id}
            historia={h}
            columnasCheck={columnasCheck}
            historiaEnfocada={historiaEnfocada}
            onCambio={cargarHistorias}
          />
        ))}
        {historias.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-outline-variant p-6 text-center font-body text-body-md text-on-surface-variant/70">
            Sin historias de usuario todavía.
          </div>
        )}
        <NuevaHistoriaForm requerimientoId={requerimiento.id} onCreada={cargarHistorias} />
      </div>

      <ConfirmDialog
        open={confirmandoEliminar}
        titulo="¿Eliminar este requerimiento?"
        mensaje="El requerimiento, sus historias de usuario y criterios de aceptación dejarán de estar disponibles."
        textoConfirmar="Eliminar"
        cargando={eliminando}
        onCancelar={() => setConfirmandoEliminar(false)}
        onConfirmar={eliminarRequerimiento}
      />
    </Card>
  );
}

function ModuloDetallePage() {
  const { moduloId } = useParams();
  const [searchParams] = useSearchParams();
  const historiaEnfocada = searchParams.get('hu');
  const { proyectoActual, modulos } = useProyecto();
  const [requerimientos, setRequerimientos] = useState([]);
  const [form, setForm] = useState({ titulo: '', descripcionResumida: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);

  const modulo = modulos.find((m) => m.id === moduloId);

  async function cargar() {
    const data = await apiFetch(`/modulos/${moduloId}/requerimientos`);
    setRequerimientos(data);
  }

  useEffect(() => {
    cargar().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduloId]);

  function abrirModalCrear() {
    setForm({ titulo: '', descripcionResumida: '' });
    setError('');
    setModalCrearAbierto(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch(`/modulos/${moduloId}/requerimientos`, { method: 'POST', body: form });
      setForm({ titulo: '', descripcionResumida: '' });
      setModalCrearAbierto(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const columnasCheck = proyectoActual?.columnasCheck || [];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-headline-lg text-on-surface">{modulo?.nombre || 'Requerimientos'}</h1>
          {modulo?.descripcion && (
            <p className="mt-1 max-w-2xl font-body text-body-md text-on-surface-variant">{modulo.descripcion}</p>
          )}
        </div>
        <Button variant="primary" onClick={abrirModalCrear}>
          <Icon name="add" />
          Nuevo requerimiento
        </Button>
      </div>

      {error && !modalCrearAbierto && (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 font-body text-body-md text-red-700">{error}</p>
      )}

      <div className="space-y-6">
        {requerimientos.map((r) => (
          <RequerimientoCard
            key={r.id}
            requerimiento={r}
            onCambio={cargar}
            columnasCheck={columnasCheck}
            historiaEnfocada={historiaEnfocada}
          />
        ))}
        {requerimientos.length === 0 && (
          <p className="font-body text-body-md text-on-surface-variant/70">Sin requerimientos todavía.</p>
        )}
      </div>

      <Modal open={modalCrearAbierto} onClose={() => setModalCrearAbierto(false)}>
        <h2 className="mb-6 font-headline text-headline-md text-on-surface">Nuevo requerimiento</h2>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 font-body text-body-md text-red-700">{error}</p>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-on-surface-variant">
              Título del requerimiento
            </label>
            <input
              className={CAMPO_INPUT}
              placeholder="Ej. Gestión de permisos de lectura"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-on-surface-variant">
              Descripción (máx. 500 caracteres)
            </label>
            <textarea
              className={CAMPO_INPUT}
              placeholder="Describe brevemente el objetivo de esta funcionalidad…"
              rows={5}
              maxLength={500}
              value={form.descripcionResumida}
              onChange={(e) => setForm((f) => ({ ...f, descripcionResumida: e.target.value }))}
              required
            />
          </div>

          <div className="rounded-xl border border-primary/20 bg-icon-bg/50 p-4">
            <p className="flex items-center gap-2 font-label-md text-[11px] font-bold uppercase tracking-wide text-primary">
              <Icon name="info" className="text-[16px]" />
              Consejo
            </p>
            <p className="mt-1 font-body text-body-md text-on-surface-variant">
              Los requerimientos agrupan varias historias de usuario. Podrás añadirlas una vez creado el
              requerimiento.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setModalCrearAbierto(false)}
              className="flex-1 rounded-xl border border-outline-variant px-6 py-3 font-body text-label-md font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              Cancelar
            </button>
            <Button type="submit" variant="primary" disabled={cargando} className="flex-1">
              {cargando ? 'Creando…' : 'Crear requerimiento'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ModuloDetallePage;
