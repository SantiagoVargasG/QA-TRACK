import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Layout() {
  const { tenant, usuario, logout } = useAuth();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <span className="font-semibold text-gray-800">Plataforma QA — {tenant?.nombre}</span>
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
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
