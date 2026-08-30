import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
// ✅ relative paths — sidesteps the Jest subpath-imports bug
import logger from './config/logger.js';
import securityMiddleware from './middleware/security.middleware.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) },
  })
);
app.use(securityMiddleware);

app.get('/', (req, res) => {
  logger.info('Hello from Acquisition');

  res.status(200).send('Hello for Acquisition');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({ message: 'Acquisition API is running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use((req, res) => {
  res.status(404).json({error: 'Routes not found!'});
})

export default app;
