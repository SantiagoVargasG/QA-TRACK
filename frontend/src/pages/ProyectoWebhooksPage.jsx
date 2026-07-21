import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';

const EVENTOS = [
  { valor: 'criterio_aprobado', etiqueta: 'Criterio aprobado' },
  { valor: 'criterio_rechazado', etiqueta: 'Criterio rechazado' },
  { valor: 'caso_solucionado', etiqueta: 'Caso solucionado' },
  { valor: 'caso_cerrado', etiqueta: 'Caso cerrado' },
  { valor: 'prueba_reportada', etiqueta: 'Prueba reportada' },
];

const FORM_VACIO = { nombre: '', url: '', proveedor: 'generico', eventos: [] };

function ProyectoWebhooksPage() {
  const { id } = useParams();
  const [proyecto, setProyecto] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  async function cargarTodo() {
    const [p, w] = await Promise.all([apiFetch(`/proyectos/${id}`), apiFetch(`/proyectos/${id}/webhooks`)]);
    setProyecto(p);
    setWebhooks(w);
  }

  useEffect(() => {
    cargarTodo().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function onCambiarEvento(valor) {
    setForm((f) => ({
      ...f,
      eventos: f.eventos.includes(valor) ? f.eventos.filter((e) => e !== valor) : [...f.eventos, valor],
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setMensaje('');
    setCargando(true);
    try {
      await apiFetch(`/proyectos/${id}/webhooks`, { method: 'POST', body: form });
      setForm(FORM_VACIO);
      setMensaje('Webhook creado.');
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function alternarActivo(webhook) {
    setError('');
    try {
      await apiFetch(`/proyectos/${id}/webhooks/${webhook.id}`, {
        method: 'PUT',
        body: { activo: !webhook.activo },
      });
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(webhookId) {
    setError('');
    try {
      await apiFetch(`/proyectos/${id}/webhooks/${webhookId}`, { method: 'DELETE' });
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!proyecto) {
    return error ? <p className="text-red-700">{error}</p> : <p>Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">Webhooks: {proyecto.nombre}</h1>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {mensaje && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{mensaje}</p>}

      <table className="w-full max-w-3xl text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Nombre</th>
            <th className="py-2">Proveedor</th>
            <th className="py-2">Eventos</th>
            <th className="py-2">Activo</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map((w) => (
            <tr key={w.id} className="border-b border-gray-100">
              <td className="py-2">
                {w.nombre}
                <div className="text-xs text-gray-400">{w.url}</div>
              </td>
              <td className="py-2">{w.proveedor}</td>
              <td className="py-2 text-xs text-gray-500">{w.eventos.join(', ')}</td>
              <td className="py-2">
                <button
                  type="button"
                  onClick={() => alternarActivo(w)}
                  className={w.activo ? 'text-green-700 hover:underline' : 'text-gray-400 hover:underline'}
                >
                  {w.activo ? 'Sí' : 'No'}
                </button>
              </td>
              <td className="py-2">
                <button type="button" onClick={() => eliminar(w.id)} className="text-red-600 hover:underline">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {webhooks.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-gray-400">
                Sin webhooks todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form onSubmit={onSubmit} className="max-w-md space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">Nuevo webhook</h2>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          required
        />
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="https://chat.googleapis.com/..."
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          required
        />
        <select
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={form.proveedor}
          onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
        >
          <option value="generico">Genérico (POST JSON)</option>
          <option value="google_chat">Google Chat</option>
        </select>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Eventos suscritos</p>
          {EVENTOS.map((ev) => (
            <label key={ev.valor} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.eventos.includes(ev.valor)}
                onChange={() => onCambiarEvento(ev.valor)}
              />
              {ev.etiqueta}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={cargando || form.eventos.length === 0}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear webhook'}
        </button>
      </form>
    </div>
  );
}

export default ProyectoWebhooksPage;
