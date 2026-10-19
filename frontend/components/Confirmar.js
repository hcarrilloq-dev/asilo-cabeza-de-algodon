'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Ventana de confirmación para acciones que no se pueden deshacer fácilmente.
 * Reemplaza los cuadros del navegador (alert / prompt).
 */
export default function Confirmar({ abierto, titulo, mensaje, textoConfirmar, pedirMotivo = false, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState('');
  const refDialogo = useRef(null);

  useEffect(() => {
    const d = refDialogo.current;
    if (!d) return;
    if (abierto && !d.open) { setMotivo(''); d.showModal(); }
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog ref={refDialogo} className="dialogo" onCancel={(e) => { e.preventDefault(); onCancelar(); }}>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); onConfirmar(motivo.trim()); }}>
        <h2>{titulo}</h2>
        <p>{mensaje}</p>
        {pedirMotivo && (
          <div className="campo">
            <label htmlFor="motivo-confirmar">Motivo</label>
            <textarea id="motivo-confirmar" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} required />
          </div>
        )}
        <div className="acciones">
          <button className="boton peligro" type="submit" disabled={pedirMotivo && !motivo.trim()}>{textoConfirmar}</button>
          <button className="boton secundario" type="button" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </dialog>
  );
}
