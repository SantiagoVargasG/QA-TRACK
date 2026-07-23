import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';

function RegistroTenantPage() {
  const { autenticado, registrarTenant } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombreTenant: '', nombreUsuario: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  if (autenticado) return <Navigate to="/" replace />;

  function actualizarCampo(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await registrarTenant(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">Crear cuenta y organización</h1>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <label className="block text-sm text-gray-600" htmlFor="nombreTenant">Nombre de la organización</label>
          <input
            id="nombreTenant"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.nombreTenant}
            onChange={actualizarCampo('nombreTenant')}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600" htmlFor="nombreUsuario">Tu nombre</label>
          <input
            id="nombreUsuario"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.nombreUsuario}
            onChange={actualizarCampo('nombreUsuario')}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.email}
            onChange={actualizarCampo('email')}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600" htmlFor="password">Contraseña</label>
          <div className="mt-1">
            <PasswordInput
              id="password"
              minLength={8}
              value={form.password}
              onChange={actualizarCampo('password')}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {cargando ? 'Creando...' : 'Crear organización'}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta? <Link to="/login" className="text-gray-800 underline">Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
}

export default RegistroTenantPage;
