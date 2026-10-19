'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Carga datos de la API y permite recargarlos. ruta = null no carga nada. */
export function useDatos(ruta) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const recargar = useCallback(() => {
    if (!ruta) return Promise.resolve();
    return api(ruta).then((d) => { setDatos(d); setError(''); }).catch((e) => setError(e.message));
  }, [ruta]);
  useEffect(() => { recargar(); }, [recargar]);
  return { datos, error, recargar, setDatos };
}

/** Estado de envío de un formulario: evita doble envío y guarda el mensaje de resultado. */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: 'exito'|'error', texto, lista }
  async function enviar(accion, textoExito) {
    if (enviando) return false;
    setEnviando(true);
    setAviso(null);
    try {
      const r = await accion();
      if (textoExito) setAviso({ tipo: 'exito', texto: typeof textoExito === 'function' ? textoExito(r) : textoExito });
      return r || true;
    } catch (e) {
      setAviso({ tipo: 'error', texto: e.message, lista: e.errores || [] });
      return false;
    } finally {
      setEnviando(false);
    }
  }
  return { enviando, aviso, setAviso, enviar };
}
