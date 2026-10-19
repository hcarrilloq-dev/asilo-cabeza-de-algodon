const v = require('../src/validators/validaciones');

const HOY = new Date('2026-10-18T12:00:00');
const residenteValido = {
  nombres: 'María', apellidos: 'García', fecha_nacimiento: '1945-05-10', sexo: 'F',
};

describe('Validación de contraseñas', () => {
  test('acepta una contraseña segura', () => expect(v.esPasswordSegura('Asilo2026')).toBe(true));
  test('rechaza menos de 8 caracteres', () => expect(v.esPasswordSegura('Ab1')).toBe(false));
  test('rechaza sin mayúscula', () => expect(v.esPasswordSegura('asilo2026')).toBe(false));
  test('rechaza sin número', () => expect(v.esPasswordSegura('AsiloCabeza')).toBe(false));
});

describe('Validación de correo y DPI', () => {
  test('correo válido', () => expect(v.esEmailValido('admin@asilo.com')).toBe(true));
  test('correo inválido', () => expect(v.esEmailValido('admin@asilo')).toBe(false));
  test('DPI de 13 dígitos', () => expect(v.esDpiValido('1234567890101')).toBe(true));
  test('DPI con letras', () => expect(v.esDpiValido('12345678901AB')).toBe(false));
});

describe('Validación de login', () => {
  test('exige correo y contraseña', () => expect(v.validarLogin({})).toHaveLength(2));
  test('datos completos no generan errores', () =>
    expect(v.validarLogin({ email: 'a@b.com', password: 'x' })).toHaveLength(0));
});

describe('Validación de residentes', () => {
  test('residente válido', () => expect(v.validarResidente(residenteValido, HOY)).toEqual([]));

  test('exige nombres y apellidos', () => {
    const errores = v.validarResidente({ ...residenteValido, nombres: '', apellidos: ' ' }, HOY);
    expect(errores).toContain('Los nombres son obligatorios.');
    expect(errores).toContain('Los apellidos son obligatorios.');
  });

  test('rechaza menores de 60 años', () => {
    const errores = v.validarResidente({ ...residenteValido, fecha_nacimiento: '1980-01-01' }, HOY);
    expect(errores).toContain('El interno debe tener 60 años o más.');
  });

  test('rechaza fecha de ingreso futura', () => {
    const errores = v.validarResidente({ ...residenteValido, fecha_ingreso: '2030-01-01' }, HOY);
    expect(errores).toContain('La fecha de ingreso no puede ser futura.');
  });

  test('rechaza nacimiento en el futuro', () => {
    const errores = v.validarResidente({ ...residenteValido, fecha_nacimiento: '2027-01-01' }, HOY);
    expect(errores).toContain('La fecha de nacimiento no puede ser futura.');
  });

  test('rechaza 300 años de edad', () => {
    const errores = v.validarResidente({ ...residenteValido, fecha_nacimiento: '1726-01-01' }, HOY);
    expect(errores).toContain('La fecha de nacimiento no es realista.');
  });

  test('rechaza 31 de septiembre', () => {
    const errores = v.validarResidente({ ...residenteValido, fecha_nacimiento: '1950-09-31' }, HOY);
    expect(errores[0]).toMatch(/no es válida/);
  });

  test('rechaza ingreso anterior al nacimiento', () => {
    const errores = v.validarResidente({ ...residenteValido, fecha_nacimiento: '1945-05-10', fecha_ingreso: '1940-01-01' }, HOY);
    expect(errores).toContain('La fecha de ingreso no puede ser anterior a la fecha de nacimiento.');
  });

  test('rechaza campos de texto con números u objetos', () => {
    const errores = v.validarResidente({ ...residenteValido, psicopatologias: 123 }, HOY);
    expect(errores[0]).toMatch(/debe ser texto/);
  });

  test('rechaza fecha inexistente', () => {
    const errores = v.validarResidente({ ...residenteValido, fecha_nacimiento: '1945-02-30' }, HOY);
    expect(errores[0]).toMatch(/no es válida/);
  });

  test('rechaza DPI inválido y sexo inválido', () => {
    const errores = v.validarResidente({ ...residenteValido, dpi: '123', sexo: 'X' }, HOY);
    expect(errores).toHaveLength(2);
  });
});

describe('Cálculo de edad', () => {
  test('aún no cumple años este año', () => expect(v.calcularEdad('1946-12-01', HOY)).toBe(79));
  test('ya cumplió años este año', () => expect(v.calcularEdad('1946-01-01', HOY)).toBe(80));
});
