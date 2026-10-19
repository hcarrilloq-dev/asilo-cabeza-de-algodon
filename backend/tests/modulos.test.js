/**
 * Reglas de negocio de los módulos de atención y caja (PT-03, PT-04, PT-08, PT-09, PT-10).
 * La base de datos se simula: cada prueba indica qué devolvería cada consulta.
 */
process.env.JWT_SECRET = 'clave_de_pruebas';
delete process.env.SMTP_HOST;

jest.mock('../src/config/db', () => {
  const consultar = jest.fn();
  return { consultar, obtenerPool: jest.fn(), transaccion: jest.fn((fn) => fn(consultar)) };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { consultar } = require('../src/config/db');
const app = require('../src/app');

const token = (rol, id = 1) => `Bearer ${jwt.sign({ id, rol, nombre: 'Prueba' }, process.env.JWT_SECRET)}`;

beforeEach(() => {
  consultar.mockReset();
  consultar.mockResolvedValue([]);
});

describe('Pagos (PT-03 y PT-09)', () => {
  const pagar = (monto) => request(app).post('/api/caja/pagos').set('Authorization', token('Administrador'))
    .send({ cargo_id: 1, monto, metodo: 'Efectivo' });

  test.each([[-500], [0], [10.555], ['abc'], [null]])('rechaza el monto %p', async (monto) => {
    const res = await pagar(monto);
    expect(res.status).toBe(400);
  });

  test('rechaza un pago mayor que el saldo del cargo', async () => {
    consultar
      .mockResolvedValueOnce([])                                                     // clave no repetida
      .mockResolvedValueOnce([{ id: 1, residente_id: 1, familiar_id: 2, monto: 100, estado: 'Pendiente', pagado: 0 }]);
    const res = await pagar(150);
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toMatch(/mayor que el saldo/);
  });

  test('un pago repetido (doble clic) no se registra dos veces', async () => {
    consultar.mockResolvedValueOnce([{ id: 7, numero_recibo: 'REC-000007' }]);       // la clave ya existe
    const res = await request(app).post('/api/caja/pagos').set('Authorization', token('Administrador'))
      .send({ cargo_id: 1, monto: 50, metodo: 'Efectivo', clave_operacion: 'clave-12345678' });
    expect(res.status).toBe(200);
    expect(res.body.repetido).toBe(true);
    expect(consultar).toHaveBeenCalledTimes(1);
  });

  test('pago válido devuelve recibo y deja el cargo en Parcial', async () => {
    consultar
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, residente_id: 1, familiar_id: 2, monto: 100, estado: 'Pendiente', pagado: 0 }])
      .mockResolvedValueOnce([{ n: 1 }])
      .mockResolvedValueOnce([{ id: 1, numero_recibo: 'REC-000001' }]);
    const res = await pagar(40);
    expect(res.status).toBe(201);
    expect(res.body.estado_cargo).toBe('Parcial');
  });

  test('solo el Administrador maneja la caja', async () => {
    for (const rol of ['Fundacion', 'Familiar', 'MedicoGeneral', 'Farmacia']) {
      const res = await request(app).get('/api/caja/cargos').set('Authorization', token(rol));
      expect(res.status).toBe(403);
    }
  });
});

describe('Cargos, donaciones y gastos (PT-09)', () => {
  test.each([[-1], [101], [50.555]])('rechaza descuento de %p %%', async (descuento) => {
    const res = await request(app).post('/api/caja/cargos').set('Authorization', token('Administrador'))
      .send({ residente_id: 1, concepto: 'Pañales', monto_base: 100, descuento_pct: descuento });
    expect(res.status).toBe(400);
  });

  test('donación con tipo de donante inválido', async () => {
    const res = await request(app).post('/api/caja/donaciones').set('Authorization', token('Administrador'))
      .send({ tipo_donante: 'Otro', donante: 'X', monto: 100 });
    expect(res.status).toBe(400);
  });

  test('gasto con monto negativo', async () => {
    const res = await request(app).post('/api/caja/gastos').set('Authorization', token('Administrador'))
      .send({ categoria: 'Luz', descripcion: 'Factura', monto: -20 });
    expect(res.status).toBe(400);
  });

  test('periodo de cuotas inválido', async () => {
    const res = await request(app).post('/api/caja/cuotas/generar').set('Authorization', token('Administrador'))
      .send({ periodo: '2026-13' });
    expect(res.status).toBe(400);
  });
});

describe('Flujo médico (PT-08)', () => {
  test('solo el médico general crea solicitudes', async () => {
    const res = await request(app).post('/api/solicitudes').set('Authorization', token('Administrador'))
      .send({ residente_id: 1, especialidad_id: 2, enfermero_id: 1, motivo: 'Dolor de pecho' });
    expect(res.status).toBe(403);
  });

  test('solicitud sin enfermero acompañante es rechazada', async () => {
    const res = await request(app).post('/api/solicitudes').set('Authorization', token('MedicoGeneral'))
      .send({ residente_id: 1, especialidad_id: 2, motivo: 'Dolor de pecho' });
    expect(res.status).toBe(400);
  });

  test('la solicitud se guarda aunque el correo no se pueda enviar (PT-10)', async () => {
    consultar
      .mockResolvedValueOnce([{ id: 5 }])                                            // médico vinculado
      .mockResolvedValueOnce([{ id: 1, nombres: 'Juan', apellidos: 'Pérez', estado: 'Activo' }])
      .mockResolvedValueOnce([{ nombre: 'Cardiología' }])
      .mockResolvedValueOnce([{ id: 1 }])                                            // enfermero
      .mockResolvedValueOnce([{ nombre: 'Carlos Herrera' }])
      .mockResolvedValueOnce([{ id: 10 }])                                           // solicitud creada
      .mockResolvedValueOnce([{ id: 3, email: 'familia@correo.com' }])               // familiar responsable
      .mockResolvedValueOnce([{ id: 99 }])                                           // notificación encolada
      .mockResolvedValueOnce([{ id: 99, estado: 'Pendiente', intentos: 0 }]);        // lectura para enviar
    const res = await request(app).post('/api/solicitudes').set('Authorization', token('MedicoGeneral'))
      .send({ residente_id: 1, especialidad_id: 2, enfermero_id: 1, motivo: 'Dolor de pecho' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
    expect(res.body.correo).toBe('Pendiente');
  });

  test('la fundación no puede asignar una cita en el pasado', async () => {
    const res = await request(app).post('/api/solicitudes/1/asignar').set('Authorization', token('Fundacion'))
      .send({ medico_id: 1, fecha_hora: '2020-01-01T10:00' });
    expect(res.status).toBe(400);
  });

  test('solo la fundación asigna citas', async () => {
    const res = await request(app).post('/api/solicitudes/1/asignar').set('Authorization', token('MedicoGeneral'))
      .send({ medico_id: 1, fecha_hora: '2030-01-01T10:00' });
    expect(res.status).toBe(403);
  });

  test('no se puede cerrar la visita sin diagnóstico', async () => {
    const res = await request(app).post('/api/visitas/1/cerrar').set('Authorization', token('MedicoEspecialista'))
      .send({ diagnostico: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toBe('No se puede cerrar la visita sin diagnóstico.');
  });

  test.each([
    [{ medicamento_id: 1, cantidad: 10, frecuencia: 'cada 8 h', tiempo_aplicacion: '7 días' }, 'sin dosis'],
    [{ medicamento_id: 1, cantidad: 0, dosis: '1 tableta', frecuencia: 'cada 8 h', tiempo_aplicacion: '7 días' }, 'cantidad cero'],
    [{ medicamento_id: 1, cantidad: -3, dosis: '1 tableta', frecuencia: 'cada 8 h', tiempo_aplicacion: '7 días' }, 'cantidad negativa'],
  ])('rechaza receta %#', async (datos) => {
    const res = await request(app).post('/api/visitas/1/medicamentos').set('Authorization', token('MedicoEspecialista')).send(datos);
    expect(res.status).toBe(400);
  });

  test('otro médico no puede modificar la visita', async () => {
    consultar.mockResolvedValueOnce([{ id: 1, estado: 'Abierta', medico_usuario_id: 77 }]);
    const res = await request(app).put('/api/visitas/1').set('Authorization', token('MedicoEspecialista', 3))
      .send({ diagnostico: 'Hipertensión' });
    expect(res.status).toBe(403);
  });

  test('una visita cerrada no se puede modificar', async () => {
    consultar.mockResolvedValueOnce([{ id: 1, estado: 'Cerrada', medico_usuario_id: 3 }]);
    const res = await request(app).post('/api/visitas/1/examenes').set('Authorization', token('MedicoEspecialista', 3))
      .send({ tipo_examen: 'Hematología' });
    expect(res.status).toBe(409);
  });

  test('el laboratorio no ve el diagnóstico ni la ficha', async () => {
    consultar
      .mockResolvedValueOnce([{ id: 1, estado: 'Abierta', motivo: 'm', diagnostico: 'secreto', residente_id: 1, medico_usuario_id: 3 }])
      .mockResolvedValueOnce([{ id: 4, tipo_examen: 'Glucosa' }]);
    const res = await request(app).get('/api/visitas/1').set('Authorization', token('Laboratorio'));
    expect(res.status).toBe(200);
    expect(res.body.diagnostico).toBeUndefined();
    expect(res.body.ficha).toBeUndefined();
    expect(res.body.medicamentos).toEqual([]);
  });

  test('resultado de laboratorio sin precio es rechazado', async () => {
    const res = await request(app).post('/api/laboratorio/examenes/1/resultado').set('Authorization', token('Laboratorio'))
      .send({ resultado: 'Normal' });
    expect(res.status).toBe(400);
  });

  test('la farmacia no puede registrar resultados de laboratorio', async () => {
    const res = await request(app).post('/api/laboratorio/examenes/1/resultado').set('Authorization', token('Farmacia'))
      .send({ resultado: 'Normal', precio: 50 });
    expect(res.status).toBe(403);
  });

  test('la fundación no ve el historial médico', async () => {
    const res = await request(app).get('/api/residentes/1/historial').set('Authorization', token('Fundacion'));
    expect(res.status).toBe(403);
  });
});

describe('Familiares', () => {
  test('teléfono con letras es rechazado', async () => {
    const res = await request(app).post('/api/familiares').set('Authorization', token('Administrador'))
      .send({ nombres: 'Rosa', apellidos: 'López', telefono: '5555abcd' });
    expect(res.status).toBe(400);
  });

  test('correo inválido es rechazado', async () => {
    const res = await request(app).post('/api/familiares').set('Authorization', token('Administrador'))
      .send({ nombres: 'Rosa', apellidos: 'López', telefono: '55551234', email: 'rosa@' });
    expect(res.status).toBe(400);
  });
});
