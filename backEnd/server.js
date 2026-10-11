const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const { apiRateLimit, corsOptions } = require('./middleware/apiSecurity');
const { errorHandler, notFoundHandler } = require('./middleware/requestValidation');

dotenv.config({ path: path.join(__dirname, '.env') });

const startServer = async () => {
  await connectDB();

  if (process.env.RUN_EMPLOYEE_MIGRATION === 'true') {
    await require('./utils/migrateEmployees')();
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in backEnd/.env.');
  }

  // ── Scheduled jobs ───────────────────────────────────────────────────────────
  const { scheduleAutoLunchCheckout } = require('./jobs/autoLunchCheckout');
  scheduleAutoLunchCheckout();

  const app = express();
  const trustedProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS, 10) || 0;
  if (trustedProxyHops > 0) app.set('trust proxy', trustedProxyHops);

  app.use(helmet());
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));
  app.use(mongoSanitize({ replaceWith: '_' }));
  app.use('/api', apiRateLimit);

  if (process.env.NODE_ENV === 'development') {
    app.use((req, _res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  app.use('/api/auth',       require('./routes/authRoutes'));
  app.use('/api/face',       require('./routes/faceRoutes'));
  app.use('/api/employees',  require('./routes/employeeRoutes'));
  app.use('/api/dashboard',  require('./routes/dashboardRoutes'));
  app.use('/api/users',      require('./routes/userRoutes'));
  app.use('/api/attendance', require('./routes/attendanceRoutes'));
  app.use('/api/reports',    require('./routes/reportsRoutes'));
  app.use('/api/shift',      require('./routes/shiftRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/leaves',       require('./routes/leaveRoutes'));

  app.get('/api/health', (_req, res) => {
    const connected = require('mongoose').connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      success: connected,
      message: 'Smart Attendance API is running',
      database: connected ? 'connected' : 'disconnected',
      ts: new Date().toISOString(),
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () =>
    console.log(`🚀 Server on http://localhost:${PORT} [${process.env.NODE_ENV}]`)
  );

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Stop the existing backend or set PORT to an unused port.`);
    } else {
      console.error('❌ Failed to start HTTP server:', err);
    }
    process.exit(1);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
