'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { leerSesion } from '@/lib/sesion';

export default function Inicio() {
  const router = useRouter();
  useEffect(() => {
    router.replace(leerSesion() ? '/panel' : '/login');
  }, [router]);
  return null;
}
