import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import RegistroTenantPage from './pages/RegistroTenantPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsuariosPage from './pages/UsuariosPage';
import RolesPage from './pages/RolesPage';

function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

export default App;
