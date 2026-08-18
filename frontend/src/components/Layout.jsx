import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProyecto } from '../context/ProyectoContext';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

function Layout() {
  const { usuario, logout } = useAuth();
  const { proyectos, proyectoActual, proyectoActualId, modulos, seleccionarProyecto } = useProyecto();
  const navigate = useNavigate();

  function onCambiarProyecto(id) {
    seleccionarProyecto(id);
    // "/" ahora es el Inicio global (independiente del proyecto seleccionado) — elegir un
    // proyecto te lleva a su espacio de trabajo, no de vuelta al panorama general.
    navigate('/proyecto');
  }

  const proyectosParaSelector = proyectos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    totalIntegrantes: p.equipo.length,
    proyectoBaseNombre: p.proyectoBaseNombre,
  }));

  return (
    <div className="min-h-screen bg-surface">
      <TopBar
        proyectos={proyectosParaSelector}
        proyectoActualId={proyectoActualId}
        onCambiarProyecto={onCambiarProyecto}
        onGestionarProyectos={() => navigate('/proyectos')}
        usuario={usuario}
        onLogout={logout}
      />
      <div className="flex pt-16">
        <Sidebar usuario={usuario} proyectoActual={proyectoActual} modulos={modulos} />
        <main className="w-full flex-1 p-gutter md:ml-64">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
