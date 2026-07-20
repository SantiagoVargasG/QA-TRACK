import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', esAdmin: false });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    const data = await apiFetch('/usuarios');
    setUsuarios(data);
  }

  useEffect(() => {
    cargar().catch((err) => setError(err.message));
  }, []);

  function actualizarCampo(campo) {
    return (e) => {
      const valor = campo === 'esAdmin' ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [campo]: valor }));
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch('/usuarios', { method: 'POST', body: form });
      setForm({ nombre: '', email: '', password: '', esAdmin: false });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function desactivar(id) {
    try {
      await apiFetch(`/usuarios/${id}`, { method: 'DELETE' });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-800">Usuarios</h1>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Nombre</th>
            <th className="py-2">Email</th>
            <th className="py-2">Admin</th>
            <th className="py-2">Activo</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-b border-gray-100">
              <td className="py-2">{u.nombre}</td>
              <td className="py-2">{u.email}</td>
              <td className="py-2">{u.esAdmin ? 'Sí' : 'No'}</td>
              <td className="py-2">{u.activo ? 'Sí' : 'No'}</td>
              <td className="py-2">
                {u.activo && (
                  <button type="button" onClick={() => desactivar(u.id)} className="text-red-600 hover:underline">
                    Desactivar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={onSubmit} className="max-w-sm space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">Nuevo usuario</h2>
        <input
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Nombre"
          value={form.nombre}
          onChange={actualizarCampo('nombre')}
          required
        />
        <input
          type="email"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Email"
          value={form.email}
          onChange={actualizarCampo('email')}
          required
        />
        <input
          type="password"
          minLength={8}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Contraseña (mín. 8 caracteres)"
          value={form.password}
          onChange={actualizarCampo('password')}
          required
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.esAdmin} onChange={actualizarCampo('esAdmin')} />
          Administrador del tenant
        </label>
        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear usuario'}
        </button>
      </form>
    </div>
  );
}

export default UsuariosPage;
