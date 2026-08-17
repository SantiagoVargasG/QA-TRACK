const VARIANTES = {
  // Botón primario de marca: píldora con degradado diagonal y glow — para la acción
  // principal de cada pantalla (crear proyecto, reportar prueba, etc.).
  primary:
    'diagonal-gradient text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95',
  secondary:
    'bg-surface-container-high text-on-surface hover:bg-outline-variant/40 active:scale-95',
  ghost: 'text-primary hover:bg-primary/5 active:scale-95',
  danger: 'text-error hover:bg-error/5 active:scale-95',
  // Borde violeta sin relleno — para acciones secundarias de "agregar" que no deben
  // competir en peso visual con el botón primario de la pantalla (ej. "Agregar HU").
  outline: 'border-[1.5px] border-primary bg-transparent text-primary hover:bg-primary/5 active:scale-95',
};

// Botón base del sistema de diseño: siempre tipo píldora (rounded-full), variantes de
// color/énfasis controladas por `variant`. No incluye lógica de navegación — para links
// estilizados como botón, usar react-router <Link> con las mismas clases de VARIANTES.
function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-body text-label-md font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
