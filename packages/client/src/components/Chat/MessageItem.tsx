import { useState } from 'react';
import {
  Box, Avatar, Typography, IconButton, Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import type { Message, User } from '@chat-app/shared';
import { useSocket } from '../../contexts/SocketContext';
import RichEditor from './RichEditor';

interface Props {
  message: Message;
  currentUserId: number;
  users: User[];
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface DeltaOp {
  insert?: string | { mention?: { value: string } };
  attributes?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    'code-block'?: boolean;
  };
}

function renderContent(content: string): React.ReactNode {
  try {
    const delta = JSON.parse(content) as { ops?: DeltaOp[] };
    const ops = delta.ops ?? [];

    return ops.map((op, i) => {
      // Mention blot
      if (typeof op.insert === 'object' && op.insert?.mention) {
        return (
          <Box key={i} component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
            @{op.insert.mention.value}
          </Box>
        );
      }

      if (typeof op.insert !== 'string') return null;

      const text = op.insert;
      const a = op.attributes;

      // Code block — render as pre
      if (a?.['code-block']) {
        return (
          <Box
            key={i}
            component="pre"
            sx={{ display: 'inline', background: 'action.hover', px: 0.5, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.85em' }}
          >
            {text}
          </Box>
        );
      }

      let node: React.ReactNode = text;
      if (a?.bold) node = <strong key={`b${i}`}>{node}</strong>;
      if (a?.italic) node = <em key={`i${i}`}>{node}</em>;
      if (a?.underline) node = <u key={`u${i}`}>{node}</u>;
      if (a?.strike) node = <s key={`s${i}`}>{node}</s>;
      if (a?.code) node = (
        <Box key={`c${i}`} component="code" sx={{ background: 'action.hover', px: 0.5, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.85em' }}>
          {node}
        </Box>
      );

      return <span key={i}>{node}</span>;
    });
  } catch {
    return content;
  }
}

export default function MessageItem({ message, currentUserId, users }: Props) {
  const [editing, setEditing] = useState(false);
  const socket = useSocket();
  const isOwn = message.userId === currentUserId;

  const handleEdit = (content: string, mentionedUserIds: number[]) => {
    socket?.emit('edit_message', { messageId: message.id, content, mentionedUserIds });
    setEditing(false);
  };

  const handleDelete = () => {
    socket?.emit('delete_message', message.id);
  };

  if (message.isDeleted) {
    return (
      <Box sx={{ display: 'flex', gap: 1.5, px: 2, py: 0.5, opacity: 0.5 }}>
        <Avatar sx={{ width: 36, height: 36, mt: 0.5 }}>{message.username[0].toUpperCase()}</Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary">{message.username}</Typography>
          <Typography variant="body2" fontStyle="italic" color="text.secondary">
            This message was deleted.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex', gap: 1.5, px: 2, py: 0.5,
        '&:hover .msg-actions': { opacity: 1 },
        position: 'relative',
      }}
    >
      <Avatar sx={{ width: 36, height: 36, mt: 0.5 }}>{message.username[0].toUpperCase()}</Avatar>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold">{message.username}</Typography>
          <Typography variant="caption" color="text.secondary">{formatTime(message.createdAt)}</Typography>
          {message.isEdited && (
            <Typography variant="caption" color="text.secondary">(edited)</Typography>
          )}
        </Box>

        {editing ? (
          <Box sx={{ mt: 0.5 }}>
            <RichEditor
              users={users}
              onSend={handleEdit}
              onCancel={() => setEditing(false)}
              initialContent={message.content}
            />
          </Box>
        ) : (
          <Box sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {renderContent(message.content)}
          </Box>
        )}
      </Box>

      {isOwn && !editing && (
        <Box
          className="msg-actions"
          sx={{ opacity: 0, transition: 'opacity 0.15s', display: 'flex', gap: 0.5, alignItems: 'flex-start' }}
        >
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => setEditing(true)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={handleDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {editing && (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
          <Tooltip title="Cancel">
            <IconButton size="small" onClick={() => setEditing(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

    </Box>
  );
}
