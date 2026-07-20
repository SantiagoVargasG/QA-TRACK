import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';

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

function RequerimientoCard({ requerimiento, onCambio }) {
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
          <li key={h.id} className="text-sm text-gray-700">
            <span className="font-mono text-xs text-gray-400">{h.codigo}</span> — {h.texto}
          </li>
        ))}
        {historias.length === 0 && <li className="text-sm text-gray-400">Sin historias de usuario todavía.</li>}
      </ul>

      <NuevaHistoriaForm requerimientoId={requerimiento.id} onCreada={cargarHistorias} />
    </div>
  );
}

function ModuloDetallePage() {
  const { moduloId } = useParams();
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

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">Requerimientos</h1>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        {requerimientos.map((r) => (
          <RequerimientoCard key={r.id} requerimiento={r} onCambio={cargar} />
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
