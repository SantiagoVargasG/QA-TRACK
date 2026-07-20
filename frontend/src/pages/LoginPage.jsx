import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { autenticado, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ tenantSlug: '', email: '', password: '' });
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
      await login(form);
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
        <h1 className="text-lg font-semibold text-gray-800">Iniciar sesión</h1>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <label className="block text-sm text-gray-600" htmlFor="tenantSlug">Organización (slug)</label>
          <input
            id="tenantSlug"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.tenantSlug}
            onChange={actualizarCampo('tenantSlug')}
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
          <input
            id="password"
            type="password"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.password}
            onChange={actualizarCampo('password')}
            required
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿No tienes organización? <Link to="/registro" className="text-gray-800 underline">Créala aquí</Link>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
