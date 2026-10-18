'use client';
import { useState } from 'react';

const VACIO = {
  nombres: '', apellidos: '', dpi: '', fecha_nacimiento: '', sexo: '', fecha_ingreso: '',
  tipo_sangre: '', habitacion: '', alergias: '', condiciones_medicas: '', observaciones: '',
};
const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function FormResidente({ inicial, textoBoton, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(() => {
    const base = { ...VACIO };
    if (inicial) Object.keys(base).forEach((k) => { base[k] = inicial[k] ?? ''; });
    return base;
  });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await onGuardar(datos);
    } catch (err) {
      setError({ mensaje: err.message, lista: err.errores || [] });
      setGuardando(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form className="formulario caja" onSubmit={enviar} noValidate>
      {error && (
        <div className="mensaje error" role="alert">
          {error.lista.length > 1 ? (
            <>Revise los siguientes datos:<ul>{error.lista.map((x) => <li key={x}>{x}</li>)}</ul></>
          ) : error.mensaje}
        </div>
      )}

      <fieldset>
        <legend>Datos personales</legend>
        <div className="campo">
          <label htmlFor="nombres">Nombres <span className="requerido">*</span></label>
          <input id="nombres" name="nombres" value={datos.nombres} onChange={cambiar} maxLength={80} />
        </div>
        <div className="campo">
          <label htmlFor="apellidos">Apellidos <span className="requerido">*</span></label>
          <input id="apellidos" name="apellidos" value={datos.apellidos} onChange={cambiar} maxLength={80} />
        </div>
        <div className="campo">
          <label htmlFor="dpi">DPI</label>
          <input id="dpi" name="dpi" value={datos.dpi} onChange={cambiar} inputMode="numeric" maxLength={13} />
          <small>13 dígitos, sin espacios</small>
        </div>
        <div className="campo">
          <label htmlFor="fecha_nacimiento">Fecha de nacimiento <span className="requerido">*</span></label>
          <input id="fecha_nacimiento" name="fecha_nacimiento" type="date" value={datos.fecha_nacimiento} onChange={cambiar} max={hoy} />
        </div>
        <div className="campo">
          <label htmlFor="sexo">Sexo <span className="requerido">*</span></label>
          <select id="sexo" name="sexo" value={datos.sexo} onChange={cambiar}>
            <option value="">Seleccione…</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>Ingreso y salud</legend>
        <div className="campo">
          <label htmlFor="fecha_ingreso">Fecha de ingreso</label>
          <input id="fecha_ingreso" name="fecha_ingreso" type="date" value={datos.fecha_ingreso} onChange={cambiar} max={hoy} />
          <small>Si la deja vacía se usa la fecha de hoy</small>
        </div>
        <div className="campo">
          <label htmlFor="habitacion">Habitación</label>
          <input id="habitacion" name="habitacion" value={datos.habitacion} onChange={cambiar} maxLength={10} />
        </div>
        <div className="campo">
          <label htmlFor="tipo_sangre">Tipo de sangre</label>
          <select id="tipo_sangre" name="tipo_sangre" value={datos.tipo_sangre} onChange={cambiar}>
            <option value="">No registrado</option>
            {TIPOS_SANGRE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="campo ancho">
          <label htmlFor="alergias">Alergias</label>
          <textarea id="alergias" name="alergias" value={datos.alergias} onChange={cambiar} maxLength={300} />
        </div>
        <div className="campo ancho">
          <label htmlFor="condiciones_medicas">Condiciones médicas</label>
          <textarea id="condiciones_medicas" name="condiciones_medicas" value={datos.condiciones_medicas} onChange={cambiar} maxLength={500} />
        </div>
        <div className="campo ancho">
          <label htmlFor="observaciones">Observaciones</label>
          <textarea id="observaciones" name="observaciones" value={datos.observaciones} onChange={cambiar} maxLength={500} />
        </div>
      </fieldset>

      <div className="acciones">
        <button className="boton" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : textoBoton}</button>
        <button className="boton secundario" type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
