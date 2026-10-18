import './globals.css';

export const metadata = {
  title: 'Asilo Cabeza de Algodón',
  description: 'Sistema de gestión del Asilo de Ancianos Cabeza de Algodón',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
