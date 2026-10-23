/**
 * Pruebas de integración CONTRA LA BASE DE DATOS REAL (recomendación del SQA, H-14 y H-17).
 * No usan simulaciones: necesitan SQL Server encendido, el script ejecutado, `npm run seed`
 * y el archivo .env configurado. Se ejecutan aparte con:  npm run test:integracion
 * Los registros de prueba se marcan con "PRUEBA-INT" y se borran al terminar.
 */
require('dotenv').config();
const request = require('supertest');
const app = require('../../src/app');
const { consultar, obtenerPool } = require('../../src/config/db');

jest.setTimeout(60000);
const MARCA = 'PRUEBA-INT';
let token;

const interno = (n) => ({ nombres: `${MARCA} ${n}`, apellidos: 'Integración', fecha_nacimiento: '1950-06-15', sexo: 'F' });
const conToken = (r) => r.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  const res = await request(app).post('/api/auth/login')
    .send({ email: process.env.SEED_ADMIN_EMAIL || 'admin@cabezadealgodon.com', password: process.env.SEED_PASSWORD });
  if (res.status !== 200) throw new Error(`No se pudo iniciar sesión como administrador: ${res.status} ${res.body.mensaje}`);
  token = res.body.token;
});

afterAll(async () => {
  await consultar(`DELETE c FROM cargos c JOIN residentes r ON r.id = c.residente_id WHERE r.nombres LIKE @m`, { m: `${MARCA}%` });
  await consultar('DELETE FROM residentes WHERE nombres LIKE @m', { m: `${MARCA}%` });
  await consultar('DELETE FROM donaciones WHERE donante LIKE @m', { m: `${MARCA}%` });
  await consultar('DELETE FROM gastos WHERE descripcion LIKE @m', { m: `${MARCA}%` });
  await (await obtenerPool()).close();
});

describe('H-17: fechas opcionales vacías en la base real', () => {
  const hoy = new Date();
  const hoyISO = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  test('interno sin fecha de ingreso queda con la fecha de hoy', async () => {
    const res = await conToken(request(app).post('/api/residentes')).send({ ...interno('fecha vacía'), fecha_ingreso: '' });
    expect(res.status).toBe(201);
    const ficha = await conToken(request(app).get(`/api/residentes/${res.body.id}`));
    expect(ficha.body.fecha_ingreso).toBe(hoyISO);
  });

  test('donación sin fecha', async () => {
    const res = await conToken(request(app).post('/api/caja/donaciones'))
      .send({ tipo_donante: 'Particular', donante: `${MARCA} donante`, monto: 10, fecha: '' });
    expect(res.status).toBe(201);
  });

  test('gasto sin fecha', async () => {
    const res = await conToken(request(app).post('/api/caja/gastos'))
      .send({ categoria: 'Otro', descripcion: `${MARCA} gasto`, monto: 1, fecha: '' });
    expect(res.status).toBe(201);
  });

  test('cargo sin fecha de vencimiento', async () => {
    const alta = await conToken(request(app).post('/api/residentes')).send(interno('cargo'));
    const res = await conToken(request(app).post('/api/caja/cargos'))
      .send({ residente_id: alta.body.id, concepto: `${MARCA} cargo`, monto_base: 100, descuento_pct: 0, fecha_vencimiento: '' });
    expect(res.status).toBe(201);
  });
});

describe('H-18: altas simultáneas de internos en la base real', () => {
  test('20 altas a la vez se registran todas con códigos distintos', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 20 }, (_, i) => conToken(request(app).post('/api/residentes')).send(interno(`simultáneo ${i}`)))
    );
    const estados = respuestas.map((r) => r.status);
    expect(estados.every((s) => s === 201)).toBe(true);
    const codigos = new Set(respuestas.map((r) => r.body.codigo));
    expect(codigos.size).toBe(20);
    respuestas.forEach((r) => expect(r.body.codigo).toMatch(/^RES-\d{4,}$/));
  });
});
