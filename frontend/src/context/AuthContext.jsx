import { createContext, useContext, useState } from 'react';
import { apiFetch, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);
const SESION_KEY = 'qa_tracker_sesion';

function cargarSesion() {
  const raw = localStorage.getItem(SESION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function guardarSesion(sesion) {
  if (sesion) localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
  else localStorage.removeItem(SESION_KEY);
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(() => (getToken() ? cargarSesion() : null));

  function aplicarSesion({ token, tenant, usuario }) {
    setToken(token);
    const nuevaSesion = { tenant, usuario };
    guardarSesion(nuevaSesion);
    setSesion(nuevaSesion);
  }

  async function registrarTenant(datos) {
    const resultado = await apiFetch('/auth/registro-tenant', { method: 'POST', body: datos, auth: false });
    aplicarSesion(resultado);
  }

  async function login(datos) {
    const resultado = await apiFetch('/auth/login', { method: 'POST', body: datos, auth: false });
    aplicarSesion(resultado);
  }

  function logout() {
    setToken(null);
    guardarSesion(null);
    setSesion(null);
  }

  const valor = {
    tenant: sesion?.tenant ?? null,
    usuario: sesion?.usuario ?? null,
    autenticado: Boolean(sesion),
    registrarTenant,
    login,
    logout,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
