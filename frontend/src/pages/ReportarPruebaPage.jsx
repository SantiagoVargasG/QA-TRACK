import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useProyecto } from '../context/ProyectoContext';

function ReportarPruebaPage() {
  const { proyectoActual, proyectoActualId, modulos } = useProyecto();
  const [modulos_seleccionados, setModulosSeleccionados] = useState([]);
  const [moduloActual, setModuloActual] = useState('');
  const [historiasDisponibles, setHistoriasDisponibles] = useState([]);
  const [historiasSeleccionadas, setHistoriasSeleccionadas] = useState([]);
  const [resultado, setResultado] = useState('exitosa');
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function cargarHistorias(idModulo) {
    if (!idModulo) {
      setHistoriasDisponibles([]);
      return;
    }
    const requerimientos = await apiFetch(`/modulos/${idModulo}/requerimientos`);
    const listas = await Promise.all(
      requerimientos.map((r) => apiFetch(`/requerimientos/${r.id}/historias`)),
    );
    setHistoriasDisponibles(listas.flat());
  }

  useEffect(() => {
    setHistoriasSeleccionadas([]);
    setResumen(null);
    cargarHistorias(moduloActual).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduloActual]);

  function agregarModulo() {
    if (!moduloActual || historiasSeleccionadas.length === 0) {
      setError('Selecciona un módulo y al menos una historia antes de agregar.');
      return;
    }

    const modObj = modulos.find((m) => m.id === moduloActual);
    const nuevoItem = {
      moduloId: moduloActual,
      moduloNombre: modObj.nombre,
      historiaIds: historiasSeleccionadas,
    };

    setModulosSeleccionados((prev) => [...prev, nuevoItem]);
    setModuloActual('');
    setHistoriasSeleccionadas([]);
    setHistoriasDisponibles([]);
    setError('');
  }

  function eliminarModulo(index) {
    setModulosSeleccionados((prev) => prev.filter((_, i) => i !== index));
  }

  function onCambiarHistoria(idHistoria) {
    setHistoriasSeleccionadas((ids) => (ids.includes(idHistoria) ? ids.filter((i) => i !== idHistoria) : [...ids, idHistoria]));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setResumen(null);
    setCargando(true);
    try {
      const data = await apiFetch(`/proyectos/${proyectoActualId}/reportar-prueba`, {
        method: 'POST',
        body: { modulos: modulos_seleccionados, resultado, comentario: comentario || undefined },
      });
      setResumen(data);
      setModulosSeleccionados([]);
      setModuloActual('');
      setHistoriasSeleccionadas([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  if (!proyectoActualId) {
    return <p className="text-gray-500">Selecciona un proyecto en la barra superior para reportar una prueba.</p>;
  }

  const totalHistoriasSeleccionadas = modulos_seleccionados.reduce((sum, m) => sum + m.historiaIds.length, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">Reportar prueba — {proyectoActual?.nombre}</h1>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {resumen && (
        <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          <p>
            Reporte enviado ({resumen.webhooksNotificados}{' '}
            {resumen.webhooksNotificados === 1 ? 'webhook notificado' : 'webhooks notificados'}).
          </p>
          {resumen.criterios_rechazados.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {resumen.criterios_rechazados.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.hu}</span>: {c.criterio} — {c.comentario}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        {/* Agregador de módulos */}
        <div className="space-y-3 rounded-lg bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-700">Seleccionar módulos y historias probadas</h2>

          <div>
            <label className="block text-sm text-gray-600">Módulo</label>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={moduloActual}
              onChange={(e) => setModuloActual(e.target.value)}
            >
              <option value="">Seleccionar módulo...</option>
              {modulos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          {moduloActual && (
            <div>
              <p className="text-sm text-gray-600">Historias de usuario probadas</p>
              <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2">
                {historiasDisponibles.map((h) => (
                  <label key={h.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={historiasSeleccionadas.includes(h.id)}
                      onChange={() => onCambiarHistoria(h.id)}
                    />
                    <span className="font-mono text-xs text-gray-400">{h.codigo}</span> {h.texto}
                  </label>
                ))}
                {historiasDisponibles.length === 0 && <p className="text-sm text-gray-400">Sin historias en este módulo.</p>}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={agregarModulo}
            disabled={!moduloActual || historiasSeleccionadas.length === 0}
            className="rounded bg-gray-400 px-3 py-2 text-sm font-medium text-white hover:bg-gray-500 disabled:opacity-50"
          >
            + Agregar módulo
          </button>
        </div>

        {/* Lista de módulos agregados */}
        {modulos_seleccionados.length > 0 && (
          <div className="space-y-2 rounded-lg bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700">Módulos agregados ({modulos_seleccionados.length})</h3>
            {modulos_seleccionados.map((mod, idx) => (
              <div key={idx} className="flex items-start justify-between rounded bg-white px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{mod.moduloNombre}</p>
                  <p className="text-xs text-gray-500">{mod.historiaIds.length} historia(s)</p>
                </div>
                <button
                  type="button"
                  onClick={() => eliminarModulo(idx)}
                  className="text-red-600 hover:text-red-800 hover:underline"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Resultado y comentario (aplica a todos los módulos) */}
        <div>
          <p className="text-sm text-gray-600">Resultado</p>
          <div className="mt-1 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="resultado"
                checked={resultado === 'exitosa'}
                onChange={() => setResultado('exitosa')}
              />
              Exitosa
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="resultado"
                checked={resultado === 'con_errores'}
                onChange={() => setResultado('con_errores')}
              />
              Con errores
            </label>
          </div>
        </div>

        <textarea
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Comentario (opcional)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />

        <button
          type="submit"
          disabled={cargando || totalHistoriasSeleccionadas === 0}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {cargando ? 'Enviando...' : 'Reportar prueba'}
        </button>
      </form>
    </div>
  );
}

export default ReportarPruebaPage;
