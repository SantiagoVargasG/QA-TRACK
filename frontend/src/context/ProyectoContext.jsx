import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

const ProyectoContext = createContext(null);
const PROYECTO_KEY = 'qa_tracker_proyecto';

export function ProyectoProvider({ children }) {
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
