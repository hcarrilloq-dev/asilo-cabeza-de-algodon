'use client';
import RegistroCaja from '@/components/RegistroCaja';
import MenuCaja from '@/components/MenuCaja';

export default function Gastos() {
  return (
    <>
      <div className="encabezado"><div><h1>Gastos</h1><p>Salidas del asilo: luz, agua, alimentación, mantenimiento y otros.</p></div></div>
      <MenuCaja />
      <RegistroCaja
        ruta="/caja/gastos"
        inicial={{ categoria: '', descripcion: '', monto: '', comprobante: '' }}
        campos={[
          { nombre: 'categoria', etiqueta: 'Categoría', opciones: ['Luz', 'Agua', 'Telefono e internet', 'Alimentacion', 'Mantenimiento', 'Salarios', 'Insumos', 'Otro'] },
          { nombre: 'descripcion', etiqueta: 'Descripción', max: 300 },
          { nombre: 'monto', etiqueta: 'Monto (Q)', inputMode: 'decimal' },
          { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date' },
          { nombre: 'comprobante', etiqueta: 'No. de factura', max: 30 },
        ]}
        columnas={[['fecha', 'Fecha'], ['categoria', 'Categoría'], ['descripcion', 'Descripción'], ['comprobante', 'Factura'], ['monto', 'Monto']]}
        textoBoton="Registrar gasto"
        textoExito="Gasto registrado."
      />
    </>
  );
}
