const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const residentesRoutes = require('./routes/residentes.routes');
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

app.use(rutaNoEncontrada);
app.use(manejadorErrores);

module.exports = app;
