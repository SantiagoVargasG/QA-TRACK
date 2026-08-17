// Modal base del sistema de diseño: overlay translúcido + tarjeta centrada. Cierra al
// clickear el overlay (nunca al clickear el contenido, por eso el stopPropagation).
function Modal({ open, onClose, children, maxWidth = 'max-w-md' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 w-full ${maxWidth} rounded-xl bg-surface-container-lowest p-8 card-shadow`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;
