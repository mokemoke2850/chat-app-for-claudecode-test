import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import pushRoutes from './routes/push';
import fileRoutes from './routes/files';
import adminRoutes from './routes/admin';
import pinRoutes from './routes/pins';
import bookmarkRoutes from './routes/bookmarks';
import bookmarkTagRoutes from './routes/bookmarkTags';
import dmRoutes from './routes/dm';
import reminderRoutes from './routes/reminders';
import categoryRoutes from './routes/categories';
import templateRoutes from './routes/messageTemplates';
import tagRoutes from './routes/tags';
import inviteRoutes from './routes/invites';
import scheduledMessageRoutes from './routes/scheduledMessages';
import eventRoutes from './routes/events';
import draftRoutes from './routes/drafts';
import taskRoutes from './routes/tasks';
import savedViewRoutes from './routes/savedViews';
import guestLinksRouter, { channelGuestLinksRouter } from './routes/guestLinks';
import calendarRoutes from './routes/calendar';
import threadRoutes from './routes/threads';
import { errorHandler } from './middleware/errorHandler';
import { setupSwagger } from './swagger/setup';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // アバター画像の静的配信
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  setupSwagger(app);

  app.use('/api/auth', authRoutes);
  app.use('/api/channels', channelRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/channels/:channelId/pins', pinRoutes);
  app.use('/api/bookmarks', bookmarkRoutes);
  app.use('/api/bookmark-tags', bookmarkTagRoutes);
  app.use('/api/dm', dmRoutes);
  app.use('/api/reminders', reminderRoutes);
  app.use('/api/channel-categories', categoryRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api', tagRoutes);
  app.use('/api/invites', inviteRoutes);
  app.use('/api/scheduled-messages', scheduledMessageRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/drafts', draftRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/saved-views', savedViewRoutes);
  app.use('/api/channels/:id/guest-links', channelGuestLinksRouter);
  app.use('/api/guest-links', guestLinksRouter);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/threads', threadRoutes);

  app.use(errorHandler);

  return app;
}
