const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'AsiloCabezaAlgodon',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

if (process.env.DB_INSTANCE) {
  config.options.instanceName = process.env.DB_INSTANCE;
} else {
  config.port = Number(process.env.DB_PORT) || 1433;
}

let poolPromise = null;

function obtenerPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

/**
 * Ejecuta una consulta parametrizada (protege contra inyección SQL).
 * @param {string} texto   Consulta con parámetros @nombre
 * @param {object} params  { nombre: valor }
 */
async function consultar(texto, params = {}) {
  const pool = await obtenerPool();
  const request = pool.request();
  for (const [nombre, valor] of Object.entries(params)) {
    request.input(nombre, valor === undefined ? null : valor);
  }
  const resultado = await request.query(texto);
  return resultado.recordset || [];
}

module.exports = { sql, obtenerPool, consultar };
