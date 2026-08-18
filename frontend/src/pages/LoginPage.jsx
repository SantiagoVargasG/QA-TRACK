import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import Logo from '../components/Logo';
import Icon from '../components/ui/Icon';
import Button from '../components/ui/Button';
import { CAMPO_INPUT } from '../components/ui/campoClassName';

const CARACTERISTICAS = [
  'Trazabilidad completa por criterio de aceptación',
  'Roles y permisos por proyecto',
  'Notificaciones automáticas a Google Chat',
];

function CaracteristicaItem({ texto }) {
  return (
    <li className="flex items-center gap-4">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
        <Icon name="check" className="text-[16px] text-white" />
      </span>
      <span className="font-body text-label-md text-white/90">{texto}</span>
    </li>
  );
}

function LoginPage() {
  const { autenticado, login, sesionExpirada } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
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
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      {/* Panel de marca: solo desktop, mismo Logo que el resto de la app. */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-16 brand-panel-gradient md:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-1/4 -top-1/4 h-[150%] w-[150%] rounded-full bg-primary-container/20 blur-3xl"
        />
        <div className="relative z-10">
          <Logo variant="light" layout="stacked" className="mb-24" />
          <p className="mb-4 font-body text-label-md font-bold uppercase tracking-widest text-white/70">
            Bienvenido de nuevo
          </p>
          <h1 className="mb-6 font-headline text-headline-xl leading-tight text-white">
            Inicia sesión en tu espacio de trabajo
          </h1>
          <p className="mb-12 max-w-md font-body text-body-lg text-white/80">
            Accede a tus proyectos, gestiona el equipo y hacé seguimiento de cada criterio de
            aceptación sin fricción.
          </p>
          <ul className="space-y-6">
            {CARACTERISTICAS.map((texto) => (
              <CaracteristicaItem key={texto} texto={texto} />
            ))}
          </ul>
        </div>
        <p className="relative z-10 font-body text-label-md text-white/50">
          © {new Date().getFullYear()} QA Tracker. Todos los derechos reservados.
        </p>
      </aside>

      {/* Panel de formulario */}
      <main className="flex flex-1 flex-col items-center justify-center p-6 md:p-12 lg:p-24">
        <div className="mb-12 md:hidden">
          <Logo />
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center">
            <h2 className="mb-2 font-headline text-headline-lg text-on-surface">Bienvenido de nuevo</h2>
            <p className="font-body text-body-md text-on-surface-variant">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            {error && (
              <p className="rounded-xl bg-error-container px-4 py-3 font-body text-body-md text-on-error-container">
                {error}
              </p>
            )}
            {!error && sesionExpirada && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 font-body text-body-md text-amber-700">
                Tu sesión expiró, inicia de nuevo
              </p>
            )}

            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                className={CAMPO_INPUT}
                value={form.email}
                onChange={actualizarCampo('email')}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">
                Contraseña
              </label>
              <PasswordInput
                id="password"
                value={form.password}
                onChange={actualizarCampo('password')}
                autoComplete="current-password"
                className={CAMPO_INPUT}
                required
              />
            </div>

            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>
          </form>

          <p className="mt-10 text-center font-body text-body-md text-on-surface-variant">
            ¿No tienes organización?{' '}
            <Link to="/registro" className="font-label-md font-bold text-primary hover:underline">
              Créala aquí
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
