/**
 * Pruebas de la API sin base de datos real: la capa de datos se simula (mock),
 * así se pueden ejecutar en cualquier computadora con "npm test".
 */
process.env.JWT_SECRET = 'clave_de_pruebas';

jest.mock('../src/config/db', () => {
  const consultar = jest.fn();
  return { consultar, obtenerPool: jest.fn(), transaccion: jest.fn((fn) => fn(consultar)) };
});

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { consultar } = require('../src/config/db');
const app = require('../src/app');

const tokenDe = (rol, id = 1) => jwt.sign({ id, rol, nombre: 'Prueba' }, process.env.JWT_SECRET);
let hashCorrecto;

beforeAll(async () => {
  hashCorrecto = await bcrypt.hash('Asilo2026', 4);
});
beforeEach(() => {
  consultar.mockReset();
  consultar.mockResolvedValue([]);
});

describe('Salud del servicio', () => {
  test('GET /api/salud responde ok', async () => {
    const res = await request(app).get('/api/salud');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
  });
});

describe('Inicio de sesión', () => {
  const usuarioBD = (activo = true) => [{
    id: 1, nombres: 'Admin', apellidos: 'General', email: 'admin@asilo.com',
    password_hash: hashCorrecto, activo, rol: 'Administrador',
  }];

  test('credenciales correctas devuelven token y rol', async () => {
    consultar.mockResolvedValueOnce(usuarioBD());
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@asilo.com', password: 'Asilo2026' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.rol).toBe('Administrador');
    expect(res.body.usuario.password_hash).toBeUndefined();
  });

  test('contraseña incorrecta devuelve 401 con mensaje genérico', async () => {
    consultar.mockResolvedValueOnce(usuarioBD());
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@asilo.com', password: 'Otra2026' });
    expect(res.status).toBe(401);
    expect(res.body.mensaje).toBe('Correo o contraseña incorrectos.');
  });

  test('correo inexistente devuelve el mismo mensaje genérico', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nadie@asilo.com', password: 'Asilo2026' });
    expect(res.status).toBe(401);
    expect(res.body.mensaje).toBe('Correo o contraseña incorrectos.');
  });

  test('usuario desactivado no puede entrar', async () => {
    consultar.mockResolvedValueOnce(usuarioBD(false));
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@asilo.com', password: 'Asilo2026' });
    expect(res.status).toBe(403);
  });

  test('campos vacíos devuelven 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('Límite de intentos (H-19 y observación de la regresión)', () => {
  const usuarioBD = (email) => [{
    id: 1, nombres: 'A', apellidos: 'B', email, password_hash: hashCorrecto, activo: true, rol: 'Administrador',
  }];

  test('los ingresos correctos no cuentan para el bloqueo', async () => {
    for (let i = 0; i < 12; i += 1) {
      consultar.mockResolvedValueOnce(usuarioBD('correcto@asilo.com'));
      const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', '10.9.9.9')
        .send({ email: 'correcto@asilo.com', password: 'Asilo2026' });
      expect(res.status).toBe(200);
    }
  });

  test('10 intentos fallidos bloquean solo esa cuenta, no a los demás de la misma conexión', async () => {
    let ultimo;
    for (let i = 0; i < 11; i += 1) {
      ultimo = await request(app).post('/api/auth/login').set('X-Forwarded-For', '10.8.8.8')
        .send({ email: 'olvidadizo@asilo.com', password: 'Incorrecta1' });
    }
    expect(ultimo.status).toBe(429);
    expect(ultimo.body.mensaje).toMatch(/esta cuenta/);
    // Otra persona en la misma conexión sigue entrando
    consultar.mockResolvedValueOnce(usuarioBD('companera@asilo.com'));
    const otra = await request(app).post('/api/auth/login').set('X-Forwarded-For', '10.8.8.8')
      .send({ email: 'companera@asilo.com', password: 'Asilo2026' });
    expect(otra.status).toBe(200);
  });

  test('muchas cuentas distintas fallando desde una conexión se bloquean a los 50 intentos', async () => {
    let ultimo;
    for (let i = 0; i < 51; i += 1) {
      ultimo = await request(app).post('/api/auth/login').set('X-Forwarded-For', '10.7.7.7')
        .send({ email: `intruso${i}@asilo.com`, password: 'Incorrecta1' });
    }
    expect(ultimo.status).toBe(429);
    expect(ultimo.body.mensaje).toMatch(/esta conexión/);
  });
});

describe('Control de acceso por roles', () => {
  test('sin token no se puede ver residentes', async () => {
    const res = await request(app).get('/api/residentes');
    expect(res.status).toBe(401);
  });

  test('token falso es rechazado', async () => {
    const res = await request(app).get('/api/residentes').set('Authorization', 'Bearer token-falso');
    expect(res.status).toBe(401);
  });

  test('Médico general no puede gestionar usuarios', async () => {
    const res = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenDe('MedicoGeneral')}`);
    expect(res.status).toBe(403);
  });

  test('no existe registro público de usuarios', async () => {
    const res = await request(app).post('/api/usuarios').send({
      nombres: 'X', apellidos: 'Y', email: 'x@y.com', password: 'Asilo2026', rol: 'Administrador',
    });
    expect(res.status).toBe(401);
  });

  test('Familiar no puede ver la lista de residentes', async () => {
    const res = await request(app).get('/api/residentes').set('Authorization', `Bearer ${tokenDe('Familiar')}`);
    expect(res.status).toBe(403);
  });

  test('Médico especialista puede ver residentes pero no registrarlos', async () => {
    const token = tokenDe('MedicoEspecialista');
    const lista = await request(app).get('/api/residentes').set('Authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    const alta = await request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`).send({});
    expect(alta.status).toBe(403);
  });
});

describe('Roles sin acceso a la ficha clínica', () => {
  test.each(['Fundacion', 'Laboratorio', 'Farmacia', 'Familiar'])('%s no puede ver residentes ni psicopatologías', async (rol) => {
    const lista = await request(app).get('/api/residentes').set('Authorization', `Bearer ${tokenDe(rol)}`);
    expect(lista.status).toBe(403);
    const uno = await request(app).get('/api/residentes/1').set('Authorization', `Bearer ${tokenDe(rol)}`);
    expect(uno.status).toBe(403);
  });
});

describe('Entradas inválidas no detienen el servidor (PT-05)', () => {
  test('contraseña numérica responde 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@asilo.com', password: 12345678 });
    expect(res.status).toBe(400);
  });

  test('cuerpo que no es JSON responde 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('esto no es json');
    expect(res.status).toBe(400);
    const salud = await request(app).get('/api/salud');
    expect(salud.status).toBe(200);
  });

  test('correo como objeto responde 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: '' }, password: 'x' });
    expect(res.status).toBe(400);
  });

  test('identificador no numérico responde 400', async () => {
    const res = await request(app).get('/api/residentes/abc').set('Authorization', `Bearer ${tokenDe('Administrador')}`);
    expect(res.status).toBe(400);
  });

  test('el token incluye fecha de expiración', async () => {
    consultar.mockResolvedValueOnce([{
      id: 1, nombres: 'A', apellidos: 'B', email: 'admin@asilo.com', password_hash: hashCorrecto, activo: true, rol: 'Administrador',
    }]);
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@asilo.com', password: 'Asilo2026' });
    process.env.JWT_EXPIRES = '8h';
    const datos = jwt.decode(res.body.token);
    expect(datos.exp).toBeGreaterThan(datos.iat);
  });
});

describe('Residentes', () => {
  const token = tokenDe('MedicoGeneral');

  test('registro con datos inválidos devuelve 400', async () => {
    const res = await request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`)
      .send({ nombres: 'Juan', apellidos: '', fecha_nacimiento: '1990-01-01', sexo: 'M' });
    expect(res.status).toBe(400);
    expect(res.body.errores.length).toBeGreaterThan(0);
  });

  test('registro válido devuelve 201 con código generado', async () => {
    consultar.mockResolvedValueOnce([{ id: 1 }]).mockResolvedValueOnce([{ id: 1, codigo: 'RES-0001' }]);
    const res = await request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`)
      .send({ nombres: 'Juan', apellidos: 'Pérez', fecha_nacimiento: '1948-03-15', sexo: 'M' });
    expect(res.status).toBe(201);
    expect(res.body.codigo).toBe('RES-0001');
  });

  test('residente inexistente devuelve 404', async () => {
    const res = await request(app).get('/api/residentes/999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('estado inválido devuelve 400', async () => {
    const res = await request(app).patch('/api/residentes/1/estado').set('Authorization', `Bearer ${token}`)
      .send({ estado: 'Eliminado' });
    expect(res.status).toBe(400);
  });

  test('texto con inyección SQL se trata como texto', async () => {
    consultar.mockResolvedValueOnce([{ id: 2 }]).mockResolvedValueOnce([{ id: 2, codigo: 'RES-0002' }]);
    const res = await request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`)
      .send({ nombres: "' OR '1'='1", apellidos: '<script>alert(1)</script>', fecha_nacimiento: '1948-03-15', sexo: 'M' });
    expect(res.status).toBe(201);
    const params = consultar.mock.calls[0][1];
    expect(params.nombres).toBe("' OR '1'='1");
  });

  test('texto demasiado largo devuelve 400', async () => {
    const res = await request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`)
      .send({ nombres: 'A'.repeat(81), apellidos: 'Pérez', fecha_nacimiento: '1948-03-15', sexo: 'M' });
    expect(res.status).toBe(400);
  });

  test('dos altas simultáneas obtienen códigos distintos (H-18)', async () => {
    consultar.mockImplementation(async (texto, params) => {
      if (texto.includes('INSERT INTO residentes')) return [{ id: params.nombres === 'Ana' ? 7 : 8 }];
      if (texto.includes('UPDATE residentes')) return [{ id: params.id, codigo: `RES-000${params.id}` }];
      return [];
    });
    const datos = (nombres) => ({ nombres, apellidos: 'Pérez', fecha_nacimiento: '1948-03-15', sexo: 'F' });
    const [a, b] = await Promise.all([
      request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`).send(datos('Ana')),
      request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`).send(datos('Eva')),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.codigo).not.toBe(b.body.codigo);
    const insert = consultar.mock.calls.find(([t]) => t.includes('INSERT INTO residentes'))[0];
    expect(insert).not.toMatch(/MAX\(id\)/);
  });

  test('fecha de ingreso vacía usa la fecha de hoy sin error (H-17)', async () => {
    consultar.mockResolvedValueOnce([{ id: 3 }]).mockResolvedValueOnce([{ id: 3, codigo: 'RES-0003' }]);
    const res = await request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`)
      .send({ nombres: 'Juan', apellidos: 'Pérez', fecha_nacimiento: '1948-03-15', sexo: 'M', fecha_ingreso: '' });
    expect(res.status).toBe(201);
    expect(consultar.mock.calls[0][0]).toMatch(/TRY_CAST\(@fechaIngreso AS DATE\)/);
  });

  test('DPI duplicado devuelve 409', async () => {
    consultar.mockRejectedValueOnce(Object.assign(new Error('duplicado'), { number: 2627 }));
    const res = await request(app).post('/api/residentes').set('Authorization', `Bearer ${token}`)
      .send({ nombres: 'Juan', apellidos: 'Pérez', fecha_nacimiento: '1948-03-15', sexo: 'M', dpi: '1234567890101' });
    expect(res.status).toBe(409);
  });
});
