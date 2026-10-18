'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { guardarSesion, leerSesion } from '@/lib/sesion';
import Algodon from '@/components/Algodon';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (leerSesion()) router.replace('/panel');
  }, [router]);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Escriba su correo y su contraseña.');
      return;
    }
    setEnviando(true);
    try {
      const { token, usuario } = await api('/auth/login', { metodo: 'POST', datos: { email, password } });
      guardarSesion(token, usuario);
      router.replace('/panel');
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <section className="login-marca">
        <Algodon className="login-algodon" color="#ffffff" />
        <div>
          <Algodon color="#ffffff" className="login-logo" />
        </div>
        <div>
          <h1>Asilo de Ancianos Cabeza de Algodón</h1>
          <p>Expedientes, atención médica, citas y pagos de cada residente, en un solo lugar.</p>
        </div>
      </section>

      <section className="login-form">
        <form onSubmit={entrar} noValidate>
          <h2>Iniciar sesión</h2>
          <p className="ayuda">Use el correo y la contraseña que le asignó el administrador.</p>

          {error && <div className="mensaje error" role="alert">{error}</div>}

          <div className="campo">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="boton" type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
