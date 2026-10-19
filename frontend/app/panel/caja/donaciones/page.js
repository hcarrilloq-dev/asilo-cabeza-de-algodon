'use client';
import RegistroCaja from '@/components/RegistroCaja';
import MenuCaja from '@/components/MenuCaja';

export default function Donaciones() {
  return (
    <>
      <div className="encabezado"><div><h1>Donaciones</h1><p>Aportes de empresas internacionales, nacionales, gobierno y personas particulares.</p></div></div>
      <MenuCaja />
      <RegistroCaja
        ruta="/caja/donaciones"
        inicial={{ tipo_donante: '', donante: '', monto: '', descripcion: '' }}
        campos={[
          { nombre: 'tipo_donante', etiqueta: 'Tipo de donante', opciones: ['Empresa internacional', 'Empresa nacional', 'Gobierno', 'Particular'] },
          { nombre: 'donante', etiqueta: 'Donante', max: 150 },
          { nombre: 'monto', etiqueta: 'Monto (Q)', inputMode: 'decimal' },
          { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date' },
          { nombre: 'descripcion', etiqueta: 'Descripción', max: 300 },
        ]}
        columnas={[['numero_recibo', 'Recibo'], ['fecha', 'Fecha'], ['tipo_donante', 'Tipo'], ['donante', 'Donante'], ['descripcion', 'Descripción'], ['monto', 'Monto']]}
        textoBoton="Registrar donación"
        textoExito={(r) => `Donación registrada. Recibo ${r.numero_recibo}.`}
      />
    </>
  );
}
