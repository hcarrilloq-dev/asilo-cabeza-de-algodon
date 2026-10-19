'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { leerSesion, puede } from '@/lib/sesion';
import FormResidente from '@/components/FormResidente';
import Confirmar from '@/components/Confirmar';
import { fecha } from '@/lib/formato';
import SeccionFamiliares from '@/components/SeccionFamiliares';
import SeccionHistorial from '@/components/SeccionHistorial';

const SEXO = { F: 'Femenino', M: 'Masculino' };

export default function ExpedienteResidente() {
  const { id } = useParams();
  const params = useSearchParams();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(params.get('nuevo') ? 'Interno registrado correctamente.' : '');
  const [editando, setEditando] = useState(false);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [cambio, setCambio] = useState(null); // estado al que se quiere cambiar
  const [rol, setRol] = useState(null);

  const cargar = () => api(`/residentes/${id}`).then(setR).catch((e) => setError(e.message));

  useEffect(() => {
    const s = leerSesion();
    setPuedeEditar(!!s && puede(s.usuario, 'editarResidentes'));
    setRol(s ? s.usuario.rol : null);
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function guardar(datos) {
    await api(`/residentes/${id}`, { metodo: 'PUT', datos });
    await cargar();
    setEditando(false);
    setAviso('Cambios guardados.');
  }

  async function cambiarEstado(estado, motivo) {
    setCambio(null);
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
          <p><Link href="/panel/residentes">Internos</Link></p>
          <h1>{r.nombres} {r.apellidos}</h1>
          <p>{r.codigo} <span className={`etiqueta ${r.estado}`}>{r.estado}</span></p>
        </div>
        {(puedeEditar || rol === 'MedicoGeneral') && (
          <div className="acciones">
            {rol === 'MedicoGeneral' && r.estado === 'Activo' && (
              <Link className="boton" href={`/panel/solicitudes/nueva?residente=${r.id}`}>Referir a especialista</Link>
            )}
            {rol === 'Administrador' && <Link className="boton secundario" href={`/panel/caja/cuentas?residente=${r.id}`}>Estado de cuenta</Link>}
            <button className="boton secundario" onClick={() => { setAviso(''); setEditando(true); }}>Editar datos</button>
            {r.estado === 'Activo' && <button className="boton peligro" onClick={() => setCambio('Egresado')}>Registrar egreso</button>}
            {r.estado !== 'Activo' && <button className="boton secundario" onClick={() => setCambio('Activo')}>Reactivar</button>}
          </div>
        )}
      </div>

      {aviso && <div className="mensaje exito" role="status" style={{ marginBottom: '1rem' }}>{aviso}</div>}
      {error && <div className="mensaje error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

      <section className="caja">
        <dl className="detalle">
          <div><dt>DPI</dt><dd>{v(r.dpi)}</dd></div>
          <div><dt>Fecha de nacimiento</dt><dd>{fecha(r.fecha_nacimiento)}</dd></div>
          <div><dt>Sexo</dt><dd>{SEXO[r.sexo]}</dd></div>
          <div><dt>Fecha de ingreso</dt><dd>{fecha(r.fecha_ingreso)}</dd></div>
          <div><dt>Habitación</dt><dd>{v(r.habitacion)}</dd></div>
          <div><dt>Tipo de sangre</dt><dd>{v(r.tipo_sangre)}</dd></div>
          <div className="ancho sensible"><dt>Psicopatologías</dt><dd>{v(r.psicopatologias)}</dd></div>
          <div className="ancho"><dt>Medicamentos de cajón</dt><dd>{v(r.medicamentos_cajon)}</dd></div>
          <div className="ancho"><dt>Alergias</dt><dd>{v(r.alergias)}</dd></div>
          <div className="ancho"><dt>Condiciones médicas</dt><dd>{v(r.condiciones_medicas)}</dd></div>
          <div className="ancho"><dt>Observaciones</dt><dd>{v(r.observaciones)}</dd></div>
        </dl>
      </section>

      {rol && <SeccionFamiliares residenteId={r.id} puedeEditar={rol === 'Administrador'} />}
      {rol && <SeccionHistorial residenteId={r.id} />}

      <Confirmar
        abierto={!!cambio}
        titulo={cambio === 'Egresado' ? 'Registrar egreso' : 'Reactivar interno'}
        mensaje={cambio === 'Egresado'
          ? `${r.nombres} ${r.apellidos} dejará de aparecer en la lista de internos activos. Su ficha y su historial se conservan.`
          : `${r.nombres} ${r.apellidos} volverá a la lista de internos activos.`}
        textoConfirmar={cambio === 'Egresado' ? 'Registrar egreso' : 'Reactivar'}
        pedirMotivo
        onConfirmar={(motivo) => cambiarEstado(cambio, motivo)}
        onCancelar={() => setCambio(null)}
      />
    </>
  );
}
