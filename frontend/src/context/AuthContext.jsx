import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { apiFetch, getToken, setToken, tokenExpirado, registrarManejador401 } from '../api/client';

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
  const [sesionExpirada, setSesionExpirada] = useState(false);
  // El chequeo de token vencido corre durante el render (no en un efecto): si lo hiciéramos
  // en un useEffect, los componentes hijos ya habrían montado sus propios efectos de carga
  // (con `sesion` todavía truthy) y disparado llamadas a la API condenadas a un 401 antes de
  // que este efecto alcance a limpiar la sesión. Actualizar estado durante el render es un
  // patrón soportado por React para "corregir" el resultado antes de que se pinte nada — acá
  // se ejecuta una sola vez por montaje gracias al ref de guarda.
  const verificadoAlMontar = useRef(false);
  if (!verificadoAlMontar.current) {
    verificadoAlMontar.current = true;
    const token = getToken();
    if (token && tokenExpirado(token)) {
      setToken(null);
      guardarSesion(null);
      if (sesion) setSesion(null);
      setSesionExpirada(true);
    }
  }

  function limpiarSesion() {
    setToken(null);
    guardarSesion(null);
    setSesion(null);
  }

  function aplicarSesion({ token, tenant, usuario }) {
    setToken(token);
    const nuevaSesion = { tenant, usuario };
    guardarSesion(nuevaSesion);
    setSesion(nuevaSesion);
    setSesionExpirada(false);
  }

  // Interceptor global: cualquier request autenticado que reciba 401 (token vencido o
  // revocado en el servidor, ej. usuario desactivado) limpia la sesión y marca
  // sesionExpirada para que LoginPage muestre el aviso — nunca deja al usuario en un estado
  // a medias (con token guardado pero llamadas fallando en silencio).
  useEffect(() => {
    registrarManejador401(() => {
      limpiarSesion();
      setSesionExpirada(true);
    });
  }, []);

  async function registrarTenant(datos) {
    const resultado = await apiFetch('/auth/registro-tenant', { method: 'POST', body: datos, auth: false });
    aplicarSesion(resultado);
  }

  async function login(datos) {
    const resultado = await apiFetch('/auth/login', { method: 'POST', body: datos, auth: false });
    aplicarSesion(resultado);
  }

  function logout() {
    limpiarSesion();
    setSesionExpirada(false);
  }

  const valor = {
    tenant: sesion?.tenant ?? null,
    usuario: sesion?.usuario ?? null,
    autenticado: Boolean(sesion),
    sesionExpirada,
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
