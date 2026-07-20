import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProyecto } from '../context/ProyectoContext';

function Layout() {
  const { tenant, usuario, logout } = useAuth();
  const { proyectos, proyectoActual, proyectoActualId, modulos, seleccionarProyecto } = useProyecto();
  const navigate = useNavigate();

  function onCambiarProyecto(e) {
    const id = e.target.value || null;
    seleccionarProyecto(id);
    navigate('/');
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-gray-800">Plataforma QA — {tenant?.nombre}</span>
          <select
            value={proyectoActualId || ''}
            onChange={onCambiarProyecto}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Seleccionar proyecto...</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <Link to="/proyectos" className="text-sm text-blue-600 hover:underline">
            Gestionar proyectos
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{usuario?.nombre}</span>
          <button type="button" onClick={logout} className="text-red-600 hover:underline">
            Salir
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-gray-200 bg-gray-50 p-4">
          <nav className="flex flex-col gap-2 text-sm">
            <Link to="/" className="text-gray-700 hover:text-gray-900">
              Inicio
            </Link>
            {usuario?.esAdmin && (
              <Link to="/usuarios" className="text-gray-700 hover:text-gray-900">
                Usuarios
              </Link>
            )}
            {usuario?.esAdmin && (
              <Link to="/roles" className="text-gray-700 hover:text-gray-900">
                Roles
              </Link>
            )}
          </nav>

          {proyectoActual && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase text-gray-400">
                Módulos de {proyectoActual.nombre}
              </p>
              <nav className="mt-2 flex flex-col gap-2 text-sm">
                {modulos.length === 0 && <span className="text-gray-400">Sin módulos todavía</span>}
                {modulos.map((m) => (
                  <Link key={m.id} to={`/modulos/${m.id}`} className="text-gray-700 hover:text-gray-900">
                    {m.nombre}
                  </Link>
                ))}
              </nav>
              {usuario?.esAdmin && (
                <Link
                  to={`/proyectos/${proyectoActual.id}/equipo`}
                  className="mt-4 block text-xs text-blue-600 hover:underline"
                >
                  Configurar equipo
                </Link>
              )}
            </>
          )}
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
