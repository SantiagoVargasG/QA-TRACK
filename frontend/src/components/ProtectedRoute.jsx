import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, soloAdmin = false }) {
  const { autenticado, usuario } = useAuth();

  if (!autenticado) return <Navigate to="/login" replace />;
  if (soloAdmin && !usuario?.esAdmin) return <Navigate to="/" replace />;

  return children;
}

export default ProtectedRoute;
