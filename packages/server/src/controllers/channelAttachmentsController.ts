import { Request, Response, NextFunction } from 'express';
import * as channelService from '../services/channelService';
import * as attachmentsService from '../services/channelAttachmentsService';

type MimeTypeFilter = 'image' | 'pdf' | 'other' | undefined;

export function getChannelAttachments(req: Request, res: Response, next: NextFunction): void {
  try {
    const channelId = Number(req.params.id);
    if (isNaN(channelId)) {
      res.status(400).json({ error: 'Invalid channelId' });
      return;
    }

    const channel = channelService.getChannelById(channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const typeParam = req.query.type as string | undefined;
    let mimeTypeFilter: MimeTypeFilter;
    if (typeParam === 'image' || typeParam === 'pdf' || typeParam === 'other') {
      mimeTypeFilter = typeParam;
    }

    const attachments = attachmentsService.getChannelAttachments(channelId, mimeTypeFilter);
    res.json({ attachments });
  } catch (err) {
    next(err);
  }
}
