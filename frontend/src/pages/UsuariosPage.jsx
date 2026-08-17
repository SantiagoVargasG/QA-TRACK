import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import PasswordInput from '../components/PasswordInput';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { CAMPO_INPUT as CLASE_INPUT } from '../components/ui/campoClassName';

const FORM_VACIO = { nombre: '', email: '', password: '', esAdmin: false };

function Pill({ activo, si = 'Sí', no = 'No' }) {
  return activo ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 font-label-md text-[12px] text-green-700">
      {si}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-surface-variant px-3 py-1 font-label-md text-[12px] text-outline">
      {no}
    </span>
  );
}

function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [usuarioAConfirmar, setUsuarioAConfirmar] = useState(null);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  async function cargar() {
    const data = await apiFetch('/usuarios');
    setUsuarios(data);
  }

  useEffect(() => {
    cargar().catch((err) => setError(err.message));
  }, []);

  function actualizarCampo(campo) {
    return (e) => {
      const valor = campo === 'esAdmin' ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [campo]: valor }));
    };
  }

  function abrirModalCrear() {
    setForm(FORM_VACIO);
    setError('');
    setModalCrearAbierto(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await apiFetch('/usuarios', { method: 'POST', body: form });
      setForm(FORM_VACIO);
      setModalCrearAbierto(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function confirmarDesactivar() {
    setProcesandoAccion(true);
    try {
      await apiFetch(`/usuarios/${usuarioAConfirmar}`, { method: 'DELETE' });
      await cargar();
      setUsuarioAConfirmar(null);
    } catch (err) {
      setError(err.message);
      setUsuarioAConfirmar(null);
    } finally {
      setProcesandoAccion(false);
    }
  }

  async function activar(id) {
    try {
      await apiFetch(`/usuarios/${id}`, { method: 'PUT', body: { activo: true } });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="mb-8 font-headline text-headline-lg text-on-surface">Usuarios</h1>

      {error && !modalCrearAbierto && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 font-body text-body-md text-red-700">{error}</p>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="font-headline text-headline-md text-[18px] text-on-surface">Lista de usuarios</h2>
          <Button variant="primary" onClick={abrirModalCrear}>
            <Icon name="person_add" />
            Nuevo usuario
          </Button>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-icon-bg">
                <th className="px-6 py-4 font-label-md text-[11px] uppercase tracking-widest text-outline-variant">
                  Nombre
                </th>
                <th className="px-6 py-4 font-label-md text-[11px] uppercase tracking-widest text-outline-variant">
                  Email
                </th>
                <th className="px-6 py-4 font-label-md text-[11px] uppercase tracking-widest text-outline-variant">
                  Admin
                </th>
                <th className="px-6 py-4 font-label-md text-[11px] uppercase tracking-widest text-outline-variant">
                  Activo
                </th>
                <th className="px-6 py-4 font-label-md text-[11px] uppercase tracking-widest text-outline-variant">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="odd:bg-surface-container-lowest even:bg-surface-container-low/40 hover:bg-surface-container-high transition-colors">
                  <td className="px-6 py-4 font-body text-body-md text-on-surface">{u.nombre}</td>
                  <td className="px-6 py-4 font-body text-body-md text-on-surface-variant">{u.email}</td>
                  <td className="px-6 py-4">
                    <Pill activo={u.esAdmin} />
                  </td>
                  <td className="px-6 py-4">
                    <Pill activo={u.activo} />
                  </td>
                  <td className="px-6 py-4">
                    {u.activo ? (
                      <button
                        type="button"
                        onClick={() => setUsuarioAConfirmar(u.id)}
                        className="font-label-md font-bold text-error transition-all hover:underline"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => activar(u.id)}
                        className="font-label-md font-bold text-primary transition-all hover:underline"
                      >
                        Activar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center font-body text-body-md text-on-surface-variant/60">
                    Sin usuarios todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={modalCrearAbierto}
        onClose={() => {
          setModalCrearAbierto(false);
          setError('');
        }}
      >
        <h3 className="mb-6 font-headline text-headline-md text-on-surface">Nuevo usuario</h3>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 font-body text-body-md text-red-700">{error}</p>}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            className={CLASE_INPUT}
            placeholder="Nombre"
            value={form.nombre}
            onChange={actualizarCampo('nombre')}
            required
          />
          <input
            type="email"
            className={CLASE_INPUT}
            placeholder="Email"
            value={form.email}
            onChange={actualizarCampo('email')}
            required
          />
          <PasswordInput
            minLength={8}
            placeholder="Contraseña (mín. 8 caracteres)"
            value={form.password}
            onChange={actualizarCampo('password')}
            autoComplete="new-password"
            className={CLASE_INPUT}
            required
          />
          <label className="flex items-center gap-2 font-body text-body-md text-on-surface-variant">
            <input type="checkbox" checked={form.esAdmin} onChange={actualizarCampo('esAdmin')} />
            Administrador del tenant
          </label>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setModalCrearAbierto(false);
                setError('');
              }}
              className="flex-1 rounded-xl border border-outline-variant px-6 py-3 font-body text-label-md font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              Cancelar
            </button>
            <Button type="submit" variant="primary" disabled={cargando} className="flex-1">
              {cargando ? 'Creando…' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={usuarioAConfirmar !== null}
        titulo="¿Estás seguro?"
        mensaje="¿Estás seguro de que deseas desactivar este usuario? No podrá acceder a la plataforma hasta que sea reactivado."
        textoConfirmar="Confirmar"
        cargando={procesandoAccion}
        onCancelar={() => setUsuarioAConfirmar(null)}
        onConfirmar={confirmarDesactivar}
      />
    </div>
  );
}

export default UsuariosPage;
