const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const residentesRoutes = require('./routes/residentes.routes');
const catalogosRoutes = require('./routes/catalogos.routes');
const familiaresRoutes = require('./routes/familiares.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');
const atencionRoutes = require('./routes/atencion.routes');
const cajaRoutes = require('./routes/caja.routes');
const portalRoutes = require('./routes/portal.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const reportesRoutes = require('./routes/reportes.routes');
const { rutaNoEncontrada, manejadorErrores } = require('./middleware/errores');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/salud', (req, res) => res.json({ estado: 'ok', servicio: 'asilo-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/residentes', residentesRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api', familiaresRoutes);
app.use('/api', atencionRoutes);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
