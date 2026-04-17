import { query, queryOne, execute } from '../db/database';
import { getSocketServer } from '../socket';
import type { Reminder, Message } from '@chat-app/shared';

interface ReminderRow {
  id: number;
  user_id: number;
  message_id: number;
  remind_at: string;
  is_sent: boolean;
  created_at: string;
  msg_id: number | null;
  msg_channel_id: number | null;
  msg_user_id: number | null;
  msg_username: string | null;
  msg_content: string | null;
  msg_is_edited: boolean | null;
  msg_is_deleted: boolean | null;
  msg_created_at: string | null;
  msg_updated_at: string | null;
}

function rowToReminder(row: ReminderRow): Reminder {
  const reminder: Reminder = {
    id: row.id,
    userId: row.user_id,
    messageId: row.message_id,
    remindAt: row.remind_at,
    isSent: row.is_sent,
    createdAt: row.created_at,
  };

  if (row.msg_id !== null && row.msg_content !== null) {
    const message: Message = {
      id: row.msg_id,
      channelId: row.msg_channel_id!,
      userId: row.msg_user_id,
      username: row.msg_username ?? '',
      avatarUrl: null,
      content: row.msg_content,
      isEdited: row.msg_is_edited === true,
      isDeleted: row.msg_is_deleted === true,
      createdAt: row.msg_created_at!,
      updatedAt: row.msg_updated_at!,
      mentions: [],
      reactions: [],
      parentMessageId: null,
      rootMessageId: null,
      replyCount: 0,
      quotedMessageId: null,
      quotedMessage: null,
    };
    reminder.message = message;
  }

  return reminder;
}

export async function createReminder(
  userId: number,
  messageId: number,
  remindAt: string,
): Promise<Reminder> {
  const msg = await queryOne<{ id: number; is_deleted: boolean }>(
    'SELECT id, is_deleted FROM messages WHERE id = $1',
    [messageId],
  );
  if (!msg) {
    throw new Error('Message not found');
  }

  const result = await queryOne<{ id: number }>(
    'INSERT INTO reminders (user_id, message_id, remind_at) VALUES ($1, $2, $3) RETURNING id',
    [userId, messageId, remindAt],
  );

  const row = await queryOne<ReminderRow>(
    `SELECT
      r.id, r.user_id, r.message_id, r.remind_at, r.is_sent, r.created_at,
      m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
      u.username AS msg_username,
      m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
      m.created_at AS msg_created_at, m.updated_at AS msg_updated_at
    FROM reminders r
    LEFT JOIN messages m ON m.id = r.message_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE r.id = $1`,
    [result!.id],
  );

  return rowToReminder(row!);
}

export async function getReminders(userId: number): Promise<Reminder[]> {
  const rows = await query<ReminderRow>(
    `SELECT
      r.id, r.user_id, r.message_id, r.remind_at, r.is_sent, r.created_at,
      m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
      u.username AS msg_username,
      m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
      m.created_at AS msg_created_at, m.updated_at AS msg_updated_at
    FROM reminders r
    LEFT JOIN messages m ON m.id = r.message_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE r.user_id = $1 AND r.is_sent = false
    ORDER BY r.remind_at ASC`,
    [userId],
  );

  return rows.map(rowToReminder);
}

export async function deleteReminder(userId: number, reminderId: number): Promise<void> {
  const result = await execute(
    'DELETE FROM reminders WHERE id = $1 AND user_id = $2',
    [reminderId, userId],
  );

  if (result.rowCount === 0) {
    throw new Error('Reminder not found');
  }
}

export async function checkAndSendReminders(): Promise<void> {
  const io = getSocketServer();
  if (!io) return;

  const now = new Date().toISOString();
  const dueReminders = await query<ReminderRow>(
    `SELECT
      r.id, r.user_id, r.message_id, r.remind_at, r.is_sent, r.created_at,
      m.id AS msg_id, m.channel_id AS msg_channel_id, m.user_id AS msg_user_id,
      u.username AS msg_username,
      m.content AS msg_content, m.is_edited AS msg_is_edited, m.is_deleted AS msg_is_deleted,
      m.created_at AS msg_created_at, m.updated_at AS msg_updated_at
    FROM reminders r
    LEFT JOIN messages m ON m.id = r.message_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE r.is_sent = false AND r.remind_at <= $1`,
    [now],
  );

  for (const row of dueReminders) {
    await execute(
      'UPDATE reminders SET is_sent = true WHERE id = $1',
      [row.id],
    );

    io.to(`user:${row.user_id}`).emit('notification', {
      type: 'reminder',
      reminderId: row.id,
      messageId: row.message_id,
      messageContent: row.msg_content ?? '',
      remindAt: row.remind_at,
    });
  }
}

export function startReminderScheduler(): NodeJS.Timeout {
  return setInterval(() => {
    void checkAndSendReminders();
  }, 30 * 1000); // 30秒ごとにチェック
}
