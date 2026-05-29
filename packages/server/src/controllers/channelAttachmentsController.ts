import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import * as channelService from '../services/channelService';
import * as attachmentsService from '../services/channelAttachmentsService';

type MimeTypeFilter = 'image' | 'pdf' | 'other' | undefined;

export async function getChannelAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const channelId = Number(req.params.id);
    if (isNaN(channelId)) {
      next(createError('Invalid channelId', 400));
      return;
    }

    const channel = await channelService.getChannelById(channelId);
    if (!channel) {
      next(createError('Channel not found', 404));
      return;
    }

    const typeParam = req.query.type as string | undefined;
    let mimeTypeFilter: MimeTypeFilter;
    if (typeParam === 'image' || typeParam === 'pdf' || typeParam === 'other') {
      mimeTypeFilter = typeParam;
    }

    const attachments = await attachmentsService.getChannelAttachments(channelId, mimeTypeFilter);
    res.json({ attachments });
  } catch (err) {
    next(err);
  }
}
