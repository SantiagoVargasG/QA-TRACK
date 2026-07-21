import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from './AuthContext';

const ProyectoContext = createContext(null);
const PROYECTO_KEY = 'qa_tracker_proyecto';

export function ProyectoProvider({ children }) {
  const { autenticado } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoActualId, setProyectoActualIdState] = useState(() => localStorage.getItem(PROYECTO_KEY));
  const [modulos, setModulos] = useState([]);

  async function cargarProyectos() {
    const data = await apiFetch('/proyectos');
    setProyectos(data);
    return data;
  }

  function seleccionarProyecto(id) {
    if (id) localStorage.setItem(PROYECTO_KEY, id);
    else localStorage.removeItem(PROYECTO_KEY);
    setProyectoActualIdState(id);
  }

  async function cargarModulos() {
    if (!proyectoActualId) {
      setModulos([]);
      return [];
    }
    const data = await apiFetch(`/proyectos/${proyectoActualId}/modulos`);
    setModulos(data);
    return data;
  }

  // `proyectoActual`/`columnasCheck` dependen de que `proyectos` esté cargado. Antes esto
  // solo pasaba al visitar /proyectos (ProyectosPage llama a cargarProyectos en su propio
  // useEffect) — una recarga de página o un link directo a /modulos/:id dejaba
  // `proyectoActual` en null y `columnasCheck` vacío en silencio. Se carga acá, una vez por
  // sesión autenticada, para que cualquier ruta funcione igual sin depender de haber
  // pasado antes por /proyectos.
  useEffect(() => {
    if (autenticado) cargarProyectos().catch(() => setProyectos([]));
    else setProyectos([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado]);

  useEffect(() => {
    cargarModulos().catch(() => setModulos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoActualId]);

  const proyectoActual = proyectos.find((p) => p.id === proyectoActualId) || null;

  const valor = {
    proyectos,
    proyectoActual,
    proyectoActualId,
    modulos,
    cargarProyectos,
    cargarModulos,
    seleccionarProyecto,
  };

  return <ProyectoContext.Provider value={valor}>{children}</ProyectoContext.Provider>;
}

export function useProyecto() {
  const ctx = useContext(ProyectoContext);
  if (!ctx) throw new Error('useProyecto debe usarse dentro de ProyectoProvider');
  return ctx;
}
