import Modal from './Modal';
import Icon from './Icon';

// Confirmación antes de una acción destructiva (ej. desactivar un usuario) — mismo
// formato que el resto de los modales del sistema de diseño, reutilizable donde haga
// falta un "¿Estás seguro?" en vez de ejecutar la acción directo al click.
function ConfirmDialog({ open, titulo, mensaje, textoConfirmar = 'Confirmar', onCancelar, onConfirmar, cargando }) {
  return (
    <Modal open={open} onClose={onCancelar}>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-error-container">
        <Icon name="warning" className="text-error" />
      </div>
      <h3 className="mb-2 font-headline text-headline-md text-on-surface">{titulo}</h3>
      <p className="mb-8 font-body text-body-md text-on-surface-variant">{mensaje}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 rounded-xl border border-outline-variant px-6 py-3 font-body text-label-md font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={cargando}
          className="flex-1 rounded-xl bg-error px-6 py-3 font-body text-label-md font-bold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
        >
          {cargando ? 'Procesando…' : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
