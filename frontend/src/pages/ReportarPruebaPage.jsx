import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useProyecto } from '../context/ProyectoContext';

function ReportarPruebaPage() {
  const { proyectoActual, proyectoActualId, modulos } = useProyecto();
  const [moduloId, setModuloId] = useState('');
  const [historias, setHistorias] = useState([]);
  const [historiaIds, setHistoriaIds] = useState([]);
  const [resultado, setResultado] = useState('exitosa');
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function cargarHistorias(idModulo) {
    if (!idModulo) {
      setHistorias([]);
      return;
    }
    const requerimientos = await apiFetch(`/modulos/${idModulo}/requerimientos`);
    const listas = await Promise.all(
      requerimientos.map((r) => apiFetch(`/requerimientos/${r.id}/historias`)),
    );
    setHistorias(listas.flat());
  }

  useEffect(() => {
    setHistoriaIds([]);
    setResumen(null);
    cargarHistorias(moduloId).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduloId]);

  function onCambiarHistoria(idHistoria) {
    setHistoriaIds((ids) => (ids.includes(idHistoria) ? ids.filter((i) => i !== idHistoria) : [...ids, idHistoria]));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setResumen(null);
    setCargando(true);
    try {
      const data = await apiFetch(`/proyectos/${proyectoActualId}/reportar-prueba`, {
        method: 'POST',
        body: { moduloId, historiaIds, resultado, comentario: comentario || undefined },
      });
      setResumen(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  if (!proyectoActualId) {
    return <p className="text-gray-500">Selecciona un proyecto en la barra superior para reportar una prueba.</p>;
  }

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
        <div>
          <label className="block text-sm text-gray-600">Módulo</label>
          <select
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={moduloId}
            onChange={(e) => setModuloId(e.target.value)}
            required
          >
            <option value="">Seleccionar módulo...</option>
            {modulos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        {moduloId && (
          <div>
            <p className="text-sm text-gray-600">Historias de usuario probadas</p>
            <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
              {historias.map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={historiaIds.includes(h.id)}
                    onChange={() => onCambiarHistoria(h.id)}
                  />
                  <span className="font-mono text-xs text-gray-400">{h.codigo}</span> {h.texto}
                </label>
              ))}
              {historias.length === 0 && <p className="text-sm text-gray-400">Sin historias en este módulo.</p>}
            </div>
          </div>
        )}

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
          disabled={cargando || historiaIds.length === 0}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {cargando ? 'Enviando...' : 'Reportar prueba'}
        </button>
      </form>
    </div>
  );
}

export default ReportarPruebaPage;
