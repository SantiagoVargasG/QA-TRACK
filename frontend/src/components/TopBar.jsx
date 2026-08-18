import Logo from './Logo';
import Icon from './ui/Icon';
import Avatar from './ui/Avatar';

const OPCION_GESTIONAR = '__gestionar__';

// "nº de HUs o integrantes" (PRD del rediseño): se muestra lo que venga en cada proyecto,
// sin asumir que ambos campos estén siempre disponibles (totalHistorias solo lo trae el
// resumen de /dashboard, no la lista liviana de /proyectos).
function etiquetaProyecto(p) {
  const partes = [p.nombre];
  if (p.totalHistorias !== undefined) partes.push(`${p.totalHistorias} HU${p.totalHistorias === 1 ? '' : 's'}`);
  if (p.totalIntegrantes !== undefined) {
    partes.push(`${p.totalIntegrantes} integrante${p.totalIntegrantes === 1 ? '' : 's'}`);
  }
  return partes.join(' · ');
}

// Barra superior del sistema de diseño: presentacional (recibe los datos ya resueltos vía
// props), la fuente real de esos datos la decide quien la use (ver Layout.jsx). El selector
// de proyecto es "enriquecido" (nombre + HUs + integrantes) y "Gestionar proyectos" vive
// como última opción del propio dropdown, no como un link aparte.
function TopBar({ proyectos, proyectoActualId, onCambiarProyecto, onGestionarProyectos, usuario, onLogout }) {
  function onSelect(e) {
    const valor = e.target.value;
    if (valor === OPCION_GESTIONAR) {
      onGestionarProyectos();
      return;
    }
    onCambiarProyecto(valor || null);
  }

  // Proyectos sueltos (sin proyectoBaseId) se listan igual que siempre, sin optgroup —
  // retrocompatibilidad exacta cuando ningún proyecto usa el agrupador. Las sub-vistas de
  // un mismo Proyecto Base se agrupan bajo un <optgroup> nativo con su nombre, sin
  // necesitar un componente de selector nuevo.
  const sueltos = proyectos.filter((p) => !p.proyectoBaseNombre);
  const gruposPorBase = new Map();
  proyectos.forEach((p) => {
    if (!p.proyectoBaseNombre) return;
    if (!gruposPorBase.has(p.proyectoBaseNombre)) gruposPorBase.set(p.proyectoBaseNombre, []);
    gruposPorBase.get(p.proyectoBaseNombre).push(p);
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-6 card-shadow">
      <div className="flex items-center gap-6">
        <Logo size="sm" />
        <label className="hidden items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 md:flex">
          <Icon name="folder" className="text-lg text-on-surface-variant" />
          <select
            value={proyectoActualId || ''}
            onChange={onSelect}
            className="border-none bg-transparent py-0.5 pr-6 font-body text-label-md font-semibold text-on-surface-variant focus:outline-none focus:ring-0"
          >
            <option value="">Seleccionar proyecto…</option>
            {sueltos.map((p) => (
              <option key={p.id} value={p.id}>
                {etiquetaProyecto(p)}
              </option>
            ))}
            {[...gruposPorBase.entries()].map(([nombreBase, subVistas]) => (
              <optgroup key={nombreBase} label={nombreBase}>
                {subVistas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaProyecto(p)}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={OPCION_GESTIONAR}>Gestionar proyectos…</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden font-body text-label-md text-on-surface-variant sm:inline">{usuario?.nombre}</span>
        <Avatar nombre={usuario?.nombre} />
        <button
          type="button"
          onClick={onLogout}
          className="font-body text-label-md font-bold text-error hover:opacity-80"
        >
          Salir
        </button>
      </div>
    </header>
  );
}

export default TopBar;
