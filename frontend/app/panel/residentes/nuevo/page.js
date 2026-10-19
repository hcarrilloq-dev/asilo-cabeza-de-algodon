'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import FormResidente from '@/components/FormResidente';

export default function NuevoResidente() {
  const router = useRouter();

  async function guardar(datos) {
    const { id } = await api('/residentes', { metodo: 'POST', datos });
    router.push(`/panel/residentes/${id}?nuevo=1`);
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Registrar interno</h1>
          <p>Los campos con <span className="requerido">*</span> son obligatorios.</p>
        </div>
      </div>
      <FormResidente textoBoton="Registrar interno" onGuardar={guardar} onCancelar={() => router.push('/panel/residentes')} />
    </>
  );
}
