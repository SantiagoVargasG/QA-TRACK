import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useProyecto } from '../context/ProyectoContext';
import Card from '../components/ui/Card';
import Icon, { IconBadge } from '../components/ui/Icon';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';

// "check_admin:<accion>" es dinámico (una entrada por cada acción de check corregida por un
// admin); el resto son valores fijos que ya usa auditoriaService.registrar en el backend.
function etiquetaAccion(accion) {
  if (accion.startsWith('check_admin:')) {
    return `Corrección de columna por admin (${accion.split(':')[1]})`;
  }
  const ETIQUETAS = {
    reabrir: 'Reapertura de criterio',
    rol_creado: 'Rol creado',
    rol_actualizado: 'Rol actualizado',
    rol_eliminado: 'Rol eliminado',
    equipo_actualizado: 'Equipo de proyecto actualizado',
  };
  return ETIQUETAS[accion] || accion;
}

function KpiCard({ icono, etiqueta, valor, tono = 'text-on-surface' }) {
  return (
    <Card className="flex items-start gap-4 p-6">
      <IconBadge name={icono} />
      <div>
        <p className="mb-1 font-body text-label-md text-on-surface-variant">{etiqueta}</p>
        <h3 className={`font-headline text-headline-md ${tono}`}>{valor}</h3>
      </div>
    </Card>
  );
}

function ProyectoCard({ proyecto, miembros, onVerDetalles }) {
  const visibles = miembros.slice(0, 3);
  const restantes = miembros.length - visibles.length;

  return (
    <Card
      className="group cursor-pointer overflow-hidden border border-transparent transition-all hover:border-primary/20"
      onClick={() => onVerDetalles(proyecto.id)}
    >
      <div className="p-6">
        <h4 className="mb-1 font-headline text-headline-md text-on-surface">{proyecto.nombre}</h4>
        <p className="mb-6 line-clamp-2 font-body text-label-md text-on-surface-variant">
          {proyecto.descripcion || 'Sin descripción'}
        </p>

        <div className="mb-2 flex items-center justify-between">
          <span className="font-body text-label-md text-on-surface-variant">Progreso de criterios</span>
          <span className="font-body text-label-md text-secondary">{proyecto.progresoAprobados}%</span>
        </div>
        <div className="mb-6 h-2.5 w-full rounded-full bg-surface-container-high">
          <div className="h-full rounded-full bg-secondary" style={{ width: `${proyecto.progresoAprobados}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <div className="avatar-stack flex">
            {visibles.map((m) => (
              <Avatar key={m.id} nombre={m.nombre} size="sm" />
            ))}
            {restantes > 0 && <Avatar variant="overflow" nombre={`+${restantes}`} size="sm" />}
            {miembros.length === 0 && (
              <span className="font-body text-label-md text-on-surface-variant/60">Sin integrantes</span>
            )}
          </div>
          <span className="font-body text-label-md text-on-surface-variant">
            {proyecto.totalHistorias} HU{proyecto.totalHistorias === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-6 py-4 transition-colors group-hover:bg-primary/5">
        <span className="font-body text-label-md font-bold text-primary">Ver detalles</span>
        <Icon name="arrow_forward" className="text-primary transition-transform group-hover:translate-x-1" />
      </div>
    </Card>
  );
}

// Pantalla de Inicio: panorama global (no depende de qué proyecto esté seleccionado en la
// barra superior) con KPIs agregados, las tarjetas de "Mis proyectos" y, solo para
// esAdmin, la actividad reciente registrada en eventosAuditoria.
function InicioPage() {
  const { usuario } = useAuth();
  const { seleccionarProyecto } = useProyecto();
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [miembrosPorProyecto, setMiembrosPorProyecto] = useState({});
  const [auditoria, setAuditoria] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/dashboard')
      .then(async (data) => {
        setResumen(data);
        const entradas = await Promise.all(
          data.proyectos.map((p) =>
            apiFetch(`/proyectos/${p.id}/miembros`)
              .then((m) => [p.id, m])
              .catch(() => [p.id, []]),
          ),
        );
        setMiembrosPorProyecto(Object.fromEntries(entradas));
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!usuario?.esAdmin) return;
    apiFetch('/auditoria')
      .then((data) => setAuditoria(data.slice(0, 6)))
      .catch(() => setAuditoria([]));
  }, [usuario?.esAdmin]);

  function verDetalles(id) {
    seleccionarProyecto(id);
    navigate('/proyecto');
  }

  if (error) {
    return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!resumen) {
    return <p className="font-body text-body-md text-on-surface-variant">Cargando…</p>;
  }

  return (
    <div>
      <div className="mb-section-gap grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icono="account_tree" etiqueta="Proyectos" valor={resumen.totalProyectos} />
        <KpiCard icono="fact_check" etiqueta="Criterios pendientes de QA" valor={resumen.criteriosPendientesQA} />
        <KpiCard
          icono="rule"
          etiqueta="Rechazados abiertos"
          valor={resumen.criteriosRechazadosAbiertos}
          tono="text-error"
        />
        <KpiCard
          icono="verified"
          etiqueta="Aprobado a la primera"
          valor={resumen.porcentajeAprobadoPrimeraVez === null ? '—' : `${resumen.porcentajeAprobadoPrimeraVez}%`}
          tono="text-secondary"
        />
      </div>

      <div className="mb-gutter flex items-end justify-between">
        <div>
          <h2 className="mb-2 font-headline text-headline-lg text-on-surface">Mis proyectos</h2>
          <p className="font-body text-body-md text-on-surface-variant">
            Seguimiento de calidad y criterios de aceptación.
          </p>
        </div>
        {usuario?.esAdmin && (
          <Button variant="primary" onClick={() => navigate('/proyectos')}>
            <Icon name="add" />
            Nuevo proyecto
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {resumen.proyectos.map((p) => (
          <ProyectoCard key={p.id} proyecto={p} miembros={miembrosPorProyecto[p.id] || []} onVerDetalles={verDetalles} />
        ))}
        {usuario?.esAdmin && (
          <button
            type="button"
            onClick={() => navigate('/proyectos')}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant p-8 text-center transition-all hover:border-primary hover:bg-surface-container-low"
          >
            <IconBadge name="add_circle" fondo="bg-surface-container-lowest card-shadow" className="mb-4" />
            <h4 className="mb-2 font-headline text-headline-md text-on-surface-variant">Crear nuevo proyecto</h4>
            <p className="max-w-[200px] font-body text-label-md text-on-surface-variant/60">
              Definí tus criterios de aceptación y empezá a trackear.
            </p>
          </button>
        )}
        {resumen.proyectos.length === 0 && !usuario?.esAdmin && (
          <p className="font-body text-body-md text-on-surface-variant">
            Todavía no formás parte de ningún proyecto.
          </p>
        )}
      </div>

      {usuario?.esAdmin && (
        <div className="mt-section-gap">
          <div className="mb-gutter flex items-center justify-between">
            <h3 className="font-headline text-headline-md text-on-surface">Actividad reciente</h3>
            <Link to="/auditoria" className="font-body text-label-md font-bold text-primary hover:underline">
              Ver todo
            </Link>
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th className="px-6 py-4 font-body text-label-md uppercase tracking-wider text-on-surface-variant">
                    Entidad
                  </th>
                  <th className="px-6 py-4 font-body text-label-md uppercase tracking-wider text-on-surface-variant">
                    Acción
                  </th>
                  <th className="px-6 py-4 font-body text-label-md uppercase tracking-wider text-on-surface-variant">
                    Detalle
                  </th>
                  <th className="px-6 py-4 font-body text-label-md uppercase tracking-wider text-on-surface-variant">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {auditoria.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-surface-lavender">
                    <td className="px-6 py-4 font-bold capitalize text-on-surface">{e.entidad}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{etiquetaAccion(e.accion)}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{e.detalle}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{new Date(e.fecha).toLocaleString()}</td>
                  </tr>
                ))}
                {auditoria.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-on-surface-variant/60">
                      Sin eventos de auditoría todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

export default InicioPage;
