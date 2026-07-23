import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProyectoProvider } from './context/ProyectoContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import RegistroTenantPage from './pages/RegistroTenantPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InicioPage from './pages/InicioPage';
import UsuariosPage from './pages/UsuariosPage';
import RolesPage from './pages/RolesPage';
import ProyectosPage from './pages/ProyectosPage';
import ProyectoEquipoPage from './pages/ProyectoEquipoPage';
import ProyectoWebhooksPage from './pages/ProyectoWebhooksPage';
import ReportarPruebaPage from './pages/ReportarPruebaPage';
import AuditoriaPage from './pages/AuditoriaPage';
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
            <Route path="/" element={<InicioPage />} />
            <Route path="/proyecto" element={<DashboardPage />} />
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
            <Route path="/reportar-prueba" element={<ReportarPruebaPage />} />
            <Route
              path="/proyectos/:id/webhooks"
              element={(
                <ProtectedRoute soloAdmin>
                  <ProyectoWebhooksPage />
                </ProtectedRoute>
              )}
            />
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
            <Route
              path="/auditoria"
              element={(
                <ProtectedRoute soloAdmin>
                  <AuditoriaPage />
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
