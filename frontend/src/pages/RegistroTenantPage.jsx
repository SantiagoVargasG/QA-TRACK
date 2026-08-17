import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import Logo from '../components/Logo';
import Icon from '../components/ui/Icon';
import Button from '../components/ui/Button';
import { CAMPO_INPUT } from '../components/ui/campoClassName';

const CARACTERISTICAS = [
  'Crea tu organización en un solo paso',
  'Invita a tu equipo y asigna roles',
  'Empieza a trackear tus criterios de aceptación',
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
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      {/* Panel de marca: mismo tratamiento que LoginPage (paleta y logo consistentes). */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-16 brand-panel-gradient md:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-1/4 -top-1/4 h-[150%] w-[150%] rounded-full bg-primary-container/20 blur-3xl"
        />
        <div className="relative z-10">
          <Logo variant="light" layout="stacked" className="mb-24" />
          <p className="mb-4 font-body text-label-md font-bold uppercase tracking-widest text-white/70">
            Crea tu cuenta
          </p>
          <h1 className="mb-6 font-headline text-headline-xl leading-tight text-white">
            Configura tu organización en minutos
          </h1>
          <p className="mb-12 max-w-md font-body text-body-lg text-white/80">
            Registra tu organización, crea tu cuenta de administrador e invita a tu equipo a
            colaborar.
          </p>
          <ul className="space-y-6">
            {CARACTERISTICAS.map((texto) => (
              <CaracteristicaItem key={texto} texto={texto} />
            ))}
          </ul>
        </div>
        <p className="relative z-10 font-body text-label-md text-white/50">
          © {new Date().getFullYear()} Mi Oiko Track. Todos los derechos reservados.
        </p>
      </aside>

      {/* Panel de formulario */}
      <main className="flex flex-1 flex-col items-center justify-center p-6 md:p-12 lg:p-24">
        <div className="mb-12 md:hidden">
          <Logo />
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center">
            <h2 className="mb-2 font-headline text-headline-lg text-on-surface">Crea tu organización</h2>
            <p className="font-body text-body-md text-on-surface-variant">
              Registra tu organización y tu cuenta de administrador para empezar
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            {error && (
              <p className="rounded-xl bg-error-container px-4 py-3 font-body text-body-md text-on-error-container">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface" htmlFor="nombreTenant">
                Nombre de la organización
              </label>
              <input
                id="nombreTenant"
                className={CAMPO_INPUT}
                value={form.nombreTenant}
                onChange={actualizarCampo('nombreTenant')}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface" htmlFor="nombreUsuario">
                Tu nombre
              </label>
              <input
                id="nombreUsuario"
                className={CAMPO_INPUT}
                value={form.nombreUsuario}
                onChange={actualizarCampo('nombreUsuario')}
                required
              />
            </div>

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
                minLength={8}
                value={form.password}
                onChange={actualizarCampo('password')}
                autoComplete="new-password"
                className={CAMPO_INPUT}
                required
              />
              <p className="font-body text-label-md text-on-surface-variant">Mínimo 8 caracteres.</p>
            </div>

            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? 'Creando…' : 'Crear organización'}
            </Button>
          </form>

          <p className="mt-10 text-center font-body text-body-md text-on-surface-variant">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-label-md font-bold text-primary hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default RegistroTenantPage;
