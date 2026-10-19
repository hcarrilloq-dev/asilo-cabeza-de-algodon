'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { leerSesion, NOMBRE_ROL } from '@/lib/sesion';

const ROLES = Object.keys(NOMBRE_ROL);
const NUEVO = { nombres: '', apellidos: '', email: '', password: '', rol: 'MedicoGeneral' };

export default function Usuarios() {
  const router = useRouter();
  const [lista, setLista] = useState(null);
  const [form, setForm] = useState(NUEVO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState('');
  const [miId, setMiId] = useState(null);

  const cargar = () => api('/usuarios').then(setLista).catch((e) => setError({ mensaje: e.message, lista: [] }));

  useEffect(() => {
    const s = leerSesion();
    if (!s || s.usuario.rol !== 'Administrador') { router.replace('/panel'); return; }
    setMiId(s.usuario.id);
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crear(e) {
    e.preventDefault();
    setError(null);
    try {
      await api('/usuarios', { metodo: 'POST', datos: form });
      setAviso(`Usuario ${form.email} creado.`);
      setForm(NUEVO);
      setMostrarForm(false);
      cargar();
    } catch (err) {
      setError({ mensaje: err.message, lista: err.errores || [] });
    }
  }

  async function cambiarEstado(u) {
    setError(null);
    try {
      await api(`/usuarios/${u.id}/estado`, { metodo: 'PATCH', datos: { activo: !u.activo } });
      setAviso(`Usuario ${u.email} ${u.activo ? 'desactivado' : 'activado'}.`);
      cargar();
    } catch (err) {
      setError({ mensaje: err.message, lista: [] });
    }
  }

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Usuarios</h1>
          <p>Solo el administrador puede crear cuentas y asignar roles.</p>
        </div>
        {!mostrarForm && <button className="boton" onClick={() => { setAviso(''); setMostrarForm(true); }}>Crear usuario</button>}
      </div>

      {aviso && <div className="mensaje exito" role="status" style={{ marginBottom: '1rem' }}>{aviso}</div>}
      {error && (
        <div className="mensaje error" role="alert" style={{ marginBottom: '1rem' }}>
          {error.lista.length > 1 ? <ul>{error.lista.map((x) => <li key={x}>{x}</li>)}</ul> : error.mensaje}
        </div>
      )}

      {mostrarForm && (
        <form className="formulario caja" onSubmit={crear} noValidate style={{ marginBottom: '1.5rem' }}>
          <fieldset>
            <legend>Nuevo usuario</legend>
            <div className="campo"><label htmlFor="nombres">Nombres</label><input id="nombres" name="nombres" value={form.nombres} onChange={cambiar} /></div>
            <div className="campo"><label htmlFor="apellidos">Apellidos</label><input id="apellidos" name="apellidos" value={form.apellidos} onChange={cambiar} /></div>
            <div className="campo"><label htmlFor="email">Correo</label><input id="email" name="email" type="email" value={form.email} onChange={cambiar} /></div>
            <div className="campo">
              <label htmlFor="password">Contraseña inicial</label>
              <input id="password" name="password" type="password" value={form.password} onChange={cambiar} autoComplete="new-password" />
              <small>8 caracteres o más, con mayúscula, minúscula y número</small>
            </div>
            <div className="campo">
              <label htmlFor="rol">Rol</label>
              <select id="rol" name="rol" value={form.rol} onChange={cambiar}>
                {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
              </select>
            </div>
          </fieldset>
          <div className="acciones">
            <button className="boton" type="submit">Crear usuario</button>
            <button className="boton secundario" type="button" onClick={() => { setMostrarForm(false); setError(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {!lista && !error && <p className="cargando">Cargando usuarios…</p>}
      {lista && (
        <div className="tabla-envoltura">
          <table>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td>{u.apellidos}, {u.nombres}</td>
                  <td>{u.email}</td>
                  <td>{NOMBRE_ROL[u.rol] || u.rol}</td>
                  <td><span className={`etiqueta ${u.activo ? 'si' : 'no'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td>{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-GT') : 'Nunca'}</td>
                  <td>
                    {u.id !== miId && (
                      <button className={`boton chico ${u.activo ? 'peligro' : 'secundario'}`} onClick={() => cambiarEstado(u)}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
