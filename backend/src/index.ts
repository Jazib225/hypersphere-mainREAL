import express from 'express';
import cors from 'cors';
import config from './config';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger, logger } from './middleware/logger';
import paymentRoutes from './routes/payments';
import transferRoutes from './routes/transfers';
import merchantRoutes from './routes/merchants';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/payments', paymentRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/merchants', merchantRoutes);

// Error handling
app.use(errorHandler);

// Start server
const PORT = parseInt(config.PORT, 10);

app.listen(PORT, () => {
  logger.info(`🚀 Hypersphere Backend running on port ${PORT}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info('Endpoints:');
  logger.info('  POST   /api/payments/incoming');
  logger.info('  POST   /api/payments/:id/bridge');
  logger.info('  GET    /api/payments/:id');
  logger.info('  POST   /api/transfers/:id/mint');
  logger.info('  POST   /api/merchants');
  logger.info('  GET    /api/merchants');
  logger.info('  GET    /api/merchants/:id');
  logger.info('  PUT    /api/merchants/:id');
  logger.info('  POST   /api/merchants/:id/payout');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

