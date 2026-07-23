import { NavLink } from 'react-router-dom';
import Icon, { IconBadge } from './ui/Icon';

// Traduce el valor guardado en Modulo.icono (vocabulario propio del formulario de alta,
// ver pages/DashboardPage.jsx) al nombre de símbolo de Material Symbols para mostrarlo.
const ICONO_MODULO = {
  carpeta: 'folder',
  documento: 'description',
  engranaje: 'settings',
  grafico: 'bar_chart',
  usuarios: 'group',
  caja: 'inventory_2',
  etiqueta: 'sell',
  campana: 'notifications',
};

function ItemNav({ to, icono, children, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-3 font-body text-label-md transition-colors ${
          isActive
            ? 'bg-secondary-container font-bold text-white'
            : 'text-on-surface-variant hover:bg-surface-container-high'
        }`
      }
    >
      <Icon name={icono} className="flex-shrink-0" />
      {/* min-w-0 es necesario para que truncate funcione dentro de un flex item: por
          default un hijo de flex no encoge por debajo del ancho de su contenido. */}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </NavLink>
  );
}

// Sidebar con los dos bloques que pide la identidad de marca: (1) general del tenant,
// siempre visible, y (2) del proyecto activo, visible solo con un proyecto seleccionado —
// con sus módulos reales primero y las acciones del proyecto después. Misma navegación que
// el Layout anterior (mismas rutas, mismos gates de esAdmin), solo re-skinneada.
function Sidebar({ usuario, proyectoActual, modulos }) {
  return (
    <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 flex-col gap-1 overflow-y-auto bg-surface-lavender py-4 md:flex">
      {/* shrink-0 en cada hijo directo es obligatorio acá: por default un hijo de flex
          puede encogerse (flex-shrink:1), y "truncate" le quita además su alto mínimo
          automático (overflow:hidden) — sin shrink-0, cuando el contenido no entra en
          los h-[calc(100vh-4rem)] de la pantalla, flexbox aplasta el elemento en vez de
          dejar que este contenedor scrollee (overflow-y-auto). Ver el bug reportado con
          pantallas más bajas / muchos módulos. */}
      <p className="shrink-0 px-6 pb-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
        General
      </p>
      <nav className="flex shrink-0 flex-col gap-1 px-2">
        <ItemNav to="/" icono="home" end>
          Inicio
        </ItemNav>
        {usuario?.esAdmin && (
          <>
            <ItemNav to="/usuarios" icono="group">
              Usuarios
            </ItemNav>
            <ItemNav to="/roles" icono="admin_panel_settings">
              Roles
            </ItemNav>
            <ItemNav to="/auditoria" icono="history_edu">
              Auditoría
            </ItemNav>
          </>
        )}
      </nav>

      {proyectoActual && (
        <>
          <NavLink
            to="/proyecto"
            title={proyectoActual.nombre}
            className={({ isActive }) =>
              // truncate por sí solo no alcanza acá: NavLink renderiza un <a>, que es
              // inline por default, y text-overflow:ellipsis no aplica de forma
              // confiable sobre elementos inline — de ahí que un nombre de proyecto
              // largo se desbordara y se superpusiera con los módulos de abajo.
              `mt-6 block shrink-0 truncate px-6 pb-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                isActive ? 'text-primary' : 'text-on-surface-variant/60 hover:text-primary'
              }`
            }
          >
            {proyectoActual.nombre}
          </NavLink>
          <nav className="flex shrink-0 flex-col gap-1 px-2">
            {modulos.length === 0 && (
              <p className="px-4 py-2 font-body text-label-md text-on-surface-variant/60">Sin módulos todavía</p>
            )}
            {modulos.map((m) => (
              <NavLink
                key={m.id}
                to={`/modulos/${m.id}`}
                title={m.nombre}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 font-body text-label-md transition-colors ${
                    isActive
                      ? 'bg-secondary-container font-bold text-white'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`
                }
              >
                <IconBadge name={ICONO_MODULO[m.icono] || 'folder'} size="sm" fondo="bg-surface-container-lowest" />
                <span className="min-w-0 flex-1 truncate">{m.nombre}</span>
              </NavLink>
            ))}
          </nav>

          <p className="mt-6 shrink-0 px-6 pb-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60">
            Acciones del proyecto
          </p>
          <nav className="flex shrink-0 flex-col gap-1 px-2">
            <ItemNav to="/reportar-prueba" icono="add_circle">
              Reportar prueba
            </ItemNav>
            {usuario?.esAdmin && (
              <>
                <ItemNav to={`/proyectos/${proyectoActual.id}/equipo`} icono="settings">
                  Configurar equipo
                </ItemNav>
                <ItemNav to={`/proyectos/${proyectoActual.id}/webhooks`} icono="webhook">
                  Webhooks
                </ItemNav>
              </>
            )}
          </nav>
        </>
      )}
    </aside>
  );
}

export default Sidebar;
