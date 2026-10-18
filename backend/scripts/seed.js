/**
 * Crea los usuarios de prueba (uno por rol) usando las credenciales del archivo .env.
 * Uso: npm run seed
 * Se puede ejecutar varias veces: si el usuario ya existe, lo omite.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { consultar, obtenerPool } = require('../src/config/db');
const { esPasswordSegura } = require('../src/validators/validaciones');

const password = process.env.SEED_PASSWORD;
const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@cabezadealgodon.com').toLowerCase();
const dominio = adminEmail.split('@')[1];

const usuarios = [
  { nombres: 'Administrador', apellidos: 'General', email: adminEmail, rol: 'Administrador' },
  { nombres: 'Rosa', apellidos: 'Méndez', email: `recepcion@${dominio}`, rol: 'Recepcion' },
  { nombres: 'Carlos', apellidos: 'Herrera', email: `medico@${dominio}`, rol: 'Medico' },
  { nombres: 'Ana', apellidos: 'López', email: `enfermeria@${dominio}`, rol: 'Enfermeria' },
  { nombres: 'Jorge', apellidos: 'Pérez', email: `contabilidad@${dominio}`, rol: 'Contabilidad' },
];

async function main() {
  if (!esPasswordSegura(password)) {
    console.error('SEED_PASSWORD en .env debe tener 8+ caracteres, una mayúscula, una minúscula y un número.');
    process.exit(1);
  }
  await obtenerPool();
  const hash = await bcrypt.hash(password, 10);

  for (const u of usuarios) {
    const existe = await consultar('SELECT id FROM usuarios WHERE email = @email', { email: u.email });
    if (existe.length) {
      console.log(`- ${u.email} ya existe, se omite.`);
      continue;
    }
    await consultar(
      `INSERT INTO usuarios (nombres, apellidos, email, password_hash, rol_id)
       SELECT @nombres, @apellidos, @email, @hash, id FROM roles WHERE nombre = @rol`,
      { ...u, hash }
    );
    console.log(`+ ${u.email} (${u.rol}) creado.`);
  }
  console.log('\nListo. Todos los usuarios de prueba usan la contraseña definida en SEED_PASSWORD.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al crear usuarios de prueba:', err.message);
  process.exit(1);
});
