// Superficie elevada base del sistema de diseño (tarjetas de KPI, de proyecto, tablas).
function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-xl bg-surface-container-lowest card-shadow ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Card;
