export default function Aviso({ aviso, onCerrar }) {
  if (!aviso) return null;
  const { tipo, texto, lista = [] } = aviso;
  return (
    <div className={`mensaje ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {lista.length > 1 ? <>Revise los datos:<ul>{lista.map((x) => <li key={x}>{x}</li>)}</ul></> : texto}
      {onCerrar && <button type="button" className="cerrar-aviso" onClick={onCerrar} aria-label="Cerrar mensaje">×</button>}
    </div>
  );
}
