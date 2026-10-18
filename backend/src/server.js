require('dotenv').config();
const app = require('./app');
const { obtenerPool } = require('./config/db');

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el archivo .env. Revise el README.');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 4000;

obtenerPool()
  .then(() => {
    console.log('Conectado a SQL Server.');
    app.listen(PORT, () => console.log(`API lista en http://localhost:${PORT}/api`));
  })
  .catch((err) => {
    console.error('No se pudo conectar a SQL Server:', err.message);
    console.error('Revise DB_SERVER, DB_USER, DB_PASSWORD en .env y que TCP/IP esté habilitado (ver README).');
    process.exit(1);
  });
