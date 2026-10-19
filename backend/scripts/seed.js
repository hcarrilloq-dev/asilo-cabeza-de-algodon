/**
 * Crea los usuarios de prueba (uno por rol) con la contraseña de SEED_PASSWORD (.env)
 * y los vincula con su registro de médico, enfermero o familiar.
 * Uso: npm run seed   (se puede ejecutar varias veces; omite lo que ya existe)
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { consultar, obtenerPool } = require('../src/config/db');
const { esPasswordSegura } = require('../src/validators/validaciones');

const password = process.env.SEED_PASSWORD;
const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@cabezadealgodon.com').toLowerCase();
const dominio = adminEmail.split('@')[1];

const USUARIOS = [
  { nombres: 'Administrador', apellidos: 'General', email: adminEmail, rol: 'Administrador' },
  { nombres: 'Carlos', apellidos: 'Herrera', email: `medico.general@${dominio}`, rol: 'MedicoGeneral',
    medico: { tipo: 'General', especialidad: 'Medicina general', colegiado: 'COL-10001' } },
  { nombres: 'Lucía', apellidos: 'Ramírez', email: `especialista@${dominio}`, rol: 'MedicoEspecialista',
    vincularMedico: 'COL-11021' },
  { nombres: 'Ana', apellidos: 'López', email: `enfermeria@${dominio}`, rol: 'Enfermeria', enfermero: { turno: 'Matutino' } },
  { nombres: 'Fundación', apellidos: 'Médica', email: `fundacion@${dominio}`, rol: 'Fundacion' },
  { nombres: 'Laboratorio', apellidos: 'Clínico', email: `laboratorio@${dominio}`, rol: 'Laboratorio' },
  { nombres: 'Farmacia', apellidos: 'Fundación', email: `farmacia@${dominio}`, rol: 'Farmacia' },
  { nombres: 'María', apellidos: 'Gómez', email: `familiar@${dominio}`, rol: 'Familiar', familiar: { telefono: '55530001' } },
];

async function idUsuario(email) {
  const f = await consultar('SELECT id FROM usuarios WHERE email = @email', { email });
  return f[0] ? f[0].id : null;
}

async function main() {
  if (!esPasswordSegura(password)) {
    console.error('SEED_PASSWORD en .env debe tener 8+ caracteres, una mayúscula, una minúscula y un número.');
    process.exit(1);
  }
  await obtenerPool();
  const hash = await bcrypt.hash(password, 10);

  for (const u of USUARIOS) {
    let id = await idUsuario(u.email);
    if (id) {
      console.log(`- ${u.email} ya existe, se omite.`);
    } else {
      const filas = await consultar(
        `INSERT INTO usuarios (nombres, apellidos, email, password_hash, rol_id)
         OUTPUT INSERTED.id
         SELECT @nombres, @apellidos, @email, @hash, id FROM roles WHERE nombre = @rol`,
        { nombres: u.nombres, apellidos: u.apellidos, email: u.email, hash, rol: u.rol }
      );
      if (!filas.length) throw new Error(`El rol ${u.rol} no existe. ¿Ejecutó database/script.sql versión 2?`);
      id = filas[0].id;
      console.log(`+ ${u.email} (${u.rol}) creado.`);
    }

    if (u.medico) {
      await consultar(
        `IF NOT EXISTS (SELECT 1 FROM medicos WHERE usuario_id = @id)
           INSERT INTO medicos (nombres, apellidos, colegiado, especialidad_id, tipo, usuario_id)
           SELECT @nombres, @apellidos, @colegiado, id, @tipo, @id FROM especialidades WHERE nombre = @especialidad`,
        { id, nombres: u.nombres, apellidos: u.apellidos, ...u.medico }
      );
    }
    if (u.vincularMedico) {
      await consultar('UPDATE medicos SET usuario_id = @id WHERE colegiado = @colegiado AND usuario_id IS NULL',
        { id, colegiado: u.vincularMedico });
    }
    if (u.enfermero) {
      await consultar(
        `IF NOT EXISTS (SELECT 1 FROM enfermeros WHERE usuario_id = @id)
           INSERT INTO enfermeros (nombres, apellidos, turno, usuario_id) VALUES (@nombres, @apellidos, @turno, @id)`,
        { id, nombres: u.nombres, apellidos: u.apellidos, turno: u.enfermero.turno }
      );
    }
    if (u.familiar) {
      await consultar(
        `IF NOT EXISTS (SELECT 1 FROM familiares WHERE usuario_id = @id)
           INSERT INTO familiares (nombres, apellidos, telefono, email, usuario_id) VALUES (@nombres, @apellidos, @telefono, @email, @id)`,
        { id, nombres: u.nombres, apellidos: u.apellidos, telefono: u.familiar.telefono, email: u.email }
      );
    }
  }
  console.log('\nListo. Todos los usuarios de prueba usan la contraseña definida en SEED_PASSWORD.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error al crear usuarios de prueba:', err.message);
  process.exit(1);
});
