import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProyectoProvider } from './context/ProyectoContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import RegistroTenantPage from './pages/RegistroTenantPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsuariosPage from './pages/UsuariosPage';
import RolesPage from './pages/RolesPage';
import ProyectosPage from './pages/ProyectosPage';
import ProyectoEquipoPage from './pages/ProyectoEquipoPage';
import ModuloDetallePage from './pages/ModuloDetallePage';

function App() {
  return (
    <AuthProvider>
      <ProyectoProvider>
        <Routes>
          <Route path="/registro" element={<RegistroTenantPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={(
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            )}
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/proyectos" element={<ProyectosPage />} />
            <Route
              path="/proyectos/:id/equipo"
              element={(
                <ProtectedRoute soloAdmin>
                  <ProyectoEquipoPage />
                </ProtectedRoute>
              )}
            />
            <Route path="/modulos/:moduloId" element={<ModuloDetallePage />} />
            <Route
              path="/usuarios"
              element={(
                <ProtectedRoute soloAdmin>
                  <UsuariosPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/roles"
              element={(
                <ProtectedRoute soloAdmin>
                  <RolesPage />
                </ProtectedRoute>
              )}
            />
          </Route>
        </Routes>
      </ProyectoProvider>
    </AuthProvider>
  );
}

export default App;
