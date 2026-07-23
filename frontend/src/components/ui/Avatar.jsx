import iniciales from '../../utils/iniciales';

const TAMAÑOS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
};

// Avatar con iniciales (nunca una foto: el modelo de usuario no guarda ninguna) sobre
// fondo surface-container-high, salvo variant="overflow" para el "+N" al final de un
// avatar-stack, que usa primary-container/blanco para destacarse del resto.
function Avatar({ nombre, variant = 'default', size = 'md', className = '' }) {
  const estilo =
    variant === 'overflow'
      ? 'bg-primary-container text-white'
      : 'bg-surface-container-high text-on-surface-variant';
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 border-surface-container-lowest font-body font-bold ${TAMAÑOS[size]} ${estilo} ${className}`}
      title={nombre}
    >
      {variant === 'overflow' ? nombre : iniciales(nombre)}
    </div>
  );
}

export default Avatar;
