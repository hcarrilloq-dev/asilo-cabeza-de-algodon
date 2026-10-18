'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { leerSesion } from '@/lib/sesion';
import FormResidente from '@/components/FormResidente';

const SEXO = { F: 'Femenino', M: 'Masculino' };

export default function ExpedienteResidente() {
  const { id } = useParams();
  const params = useSearchParams();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(params.get('nuevo') ? 'Residente registrado correctamente.' : '');
  const [editando, setEditando] = useState(false);
  const [puedeEditar, setPuedeEditar] = useState(false);

  const cargar = () => api(`/residentes/${id}`).then(setR).catch((e) => setError(e.message));

  useEffect(() => {
    const s = leerSesion();
    setPuedeEditar(!!s && ['Administrador', 'Recepcion'].includes(s.usuario.rol));
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function guardar(datos) {
    await api(`/residentes/${id}`, { metodo: 'PUT', datos });
    await cargar();
    setEditando(false);
    setAviso('Cambios guardados.');
  }

  async function cambiarEstado(estado) {
    const motivo = window.prompt(`Motivo del cambio a "${estado}":`);
    if (motivo === null) return;
    try {
      await api(`/residentes/${id}/estado`, { metodo: 'PATCH', datos: { estado, motivo } });
      await cargar();
      setAviso(`Estado cambiado a ${estado}.`);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !r) return <><div className="mensaje error">{error}</div><p><Link href="/panel/residentes">Volver a residentes</Link></p></>;
  if (!r) return <p className="cargando">Cargando expediente…</p>;

  if (editando) {
    return (
      <>
        <div className="encabezado"><div><h1>Editar expediente</h1><p>{r.codigo}</p></div></div>
        <FormResidente inicial={r} textoBoton="Guardar cambios" onGuardar={guardar} onCancelar={() => setEditando(false)} />
      </>
    );
  }

  const v = (x) => x || 'No registrado';

  return (
    <>
      <div className="encabezado">
        <div>
          <p><Link href="/panel/residentes">Residentes</Link></p>
          <h1>{r.nombres} {r.apellidos}</h1>
          <p>{r.codigo} <span className={`etiqueta ${r.estado}`}>{r.estado}</span></p>
        </div>
        {puedeEditar && (
          <div className="acciones">
            <button className="boton" onClick={() => { setAviso(''); setEditando(true); }}>Editar datos</button>
            {r.estado === 'Activo' && <button className="boton peligro" onClick={() => cambiarEstado('Egresado')}>Registrar egreso</button>}
            {r.estado !== 'Activo' && <button className="boton secundario" onClick={() => cambiarEstado('Activo')}>Reactivar</button>}
          </div>
        )}
      </div>

      {aviso && <div className="mensaje exito" role="status" style={{ marginBottom: '1rem' }}>{aviso}</div>}
      {error && <div className="mensaje error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

      <section className="caja">
        <dl className="detalle">
          <div><dt>DPI</dt><dd>{v(r.dpi)}</dd></div>
          <div><dt>Fecha de nacimiento</dt><dd>{r.fecha_nacimiento}</dd></div>
          <div><dt>Sexo</dt><dd>{SEXO[r.sexo]}</dd></div>
          <div><dt>Fecha de ingreso</dt><dd>{r.fecha_ingreso}</dd></div>
          <div><dt>Habitación</dt><dd>{v(r.habitacion)}</dd></div>
          <div><dt>Tipo de sangre</dt><dd>{v(r.tipo_sangre)}</dd></div>
          <div className="ancho"><dt>Alergias</dt><dd>{v(r.alergias)}</dd></div>
          <div className="ancho"><dt>Condiciones médicas</dt><dd>{v(r.condiciones_medicas)}</dd></div>
          <div className="ancho"><dt>Observaciones</dt><dd>{v(r.observaciones)}</dd></div>
        </dl>
      </section>
    </>
  );
}
