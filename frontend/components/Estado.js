// Etiqueta de color según el estado
const COLOR = {
  Activo: 'si', Pendiente: 'aviso', Asignada: 'info', Atendida: 'si', Cancelada: 'no', Pagada: 'si', Programada: 'info',
  Realizada: 'si', Abierta: 'aviso', Cerrada: 'si', Solicitado: 'aviso', Completado: 'si', Indicado: 'aviso',
  Entregado: 'si', Parcial: 'info', Cancelado: 'si', Vencido: 'peligro', Enviada: 'si', Fallida: 'peligro',
  Urgente: 'peligro', Normal: 'no', Egresado: 'aviso', Fallecido: 'no',
};
export default function Estado({ valor }) {
  return <span className={`etiqueta ${COLOR[valor] || 'no'}`}>{valor}</span>;
}
