import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import pushRoutes from './routes/push';
import { errorHandler } from './middleware/errorHandler';
import { setupSwagger } from './swagger/setup';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }));

  app.use(express.json());
  app.use(cookieParser());

  setupSwagger(app);

  app.use('/api/auth', authRoutes);
  app.use('/api/channels', channelRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/push', pushRoutes);

  app.use(errorHandler);

  return app;
}
