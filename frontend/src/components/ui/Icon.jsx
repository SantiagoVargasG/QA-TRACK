// Envoltorio fino sobre Material Symbols Outlined (cargado en index.html) para no repetir
// la clase "material-symbols-outlined" suelta en cada lugar que necesita un ícono.
function Icon({ name, className = '' }) {
  return (
    <span className={`material-symbols-outlined select-none ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

// Ícono en cuadro redondeado con fondo lavanda y símbolo violeta — el patrón de
// iconografía de la marca (KPIs, módulos del sidebar, acciones destacadas). `fondo` es
// configurable porque icon-bg (#EDE9FB) casi no contrasta sobre superficies ya lavanda
// (ej. el propio sidebar, en surface-lavender) — ahí conviene un fondo blanco.
function IconBadge({ name, className = '', size = 'md', fondo = 'bg-icon-bg' }) {
  const tamaños = {
    sm: 'h-8 w-8 rounded-lg text-lg',
    md: 'h-12 w-12 rounded-xl text-2xl',
  };
  return (
    <div className={`flex flex-shrink-0 items-center justify-center text-primary ${fondo} ${tamaños[size]} ${className}`}>
      <Icon name={name} />
    </div>
  );
}

export { IconBadge };
export default Icon;
