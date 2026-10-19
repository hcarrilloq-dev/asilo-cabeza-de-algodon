// Formatos de presentación: montos en quetzales y fechas sin segundos
const fmtQ = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

export const dinero = (n) => fmtQ.format(Number(n) || 0);

export function fecha(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  // Fechas sin hora (AAAA-MM-DD) se muestran tal cual, sin desfase de zona horaria
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, dd] = valor.split('-');
    return `${dd}/${m}/${a}`;
  }
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

export function fechaHora(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  // SQL Server guarda la hora local sin zona; el driver la entrega como UTC, por eso se muestra en UTC
  return d.toLocaleString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

export const hoyISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Clave única por formulario: evita registrar dos veces el mismo pago si se da doble clic. */
export const nuevaClave = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
