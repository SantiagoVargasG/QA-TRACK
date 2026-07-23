import { useId, useState } from 'react';

function IconOjo({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M9.9 4.24A10.4 10.4 0 0 1 12 4c6.5 0 10 7 10 7a17.5 17.5 0 0 1-2.16 3.19M6.5 6.6C3.4 8.5 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.1-1.4" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

// Input de contraseña reutilizable con ícono de mostrar/ocultar. Cada instancia mantiene su
// propio estado de visibilidad (no hay uno global) para que alternar un campo no afecte a otros.
function PasswordInput({ id, value, onChange, placeholder, required, minLength, autoComplete, className = '' }) {
  const [visible, setVisible] = useState(false);
  const idGenerado = useId();
  const inputId = id || idGenerado;

  return (
    <div className="relative">
      <input
        id={inputId}
        type={visible ? 'text' : 'password'}
        className={`w-full rounded border border-gray-300 px-3 py-2 pr-10 text-sm ${className}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
      >
        <IconOjo visible={visible} />
      </button>
    </div>
  );
}

export default PasswordInput;
