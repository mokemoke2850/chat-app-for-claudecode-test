import { useState } from 'react';
import { Box, Avatar, Typography, IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
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
  insert?: string | { mention?: { value: string }; image?: string };
  attributes?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    'code-block'?: boolean;
    color?: string;
    background?: string;
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

      // Image blot
      if (typeof op.insert === 'object' && op.insert?.image) {
        return (
          <Box
            key={i}
            component="img"
            src={op.insert.image}
            alt="Attached image"
            sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: 1, display: 'block', mt: 0.5 }}
          />
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
            sx={{
              display: 'inline',
              background: 'action.hover',
              px: 0.5,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.85em',
            }}
          >
            {text}
          </Box>
        );
      }

      // Build inline style for color / background
      const inlineStyle: React.CSSProperties = {};
      if (a?.color) inlineStyle.color = a.color;
      if (a?.background) inlineStyle.backgroundColor = a.background;

      let node: React.ReactNode = text;
      if (a?.bold) node = <strong key={`b${i}`}>{node}</strong>;
      if (a?.italic) node = <em key={`i${i}`}>{node}</em>;
      if (a?.underline) node = <u key={`u${i}`}>{node}</u>;
      if (a?.strike) node = <s key={`s${i}`}>{node}</s>;
      if (a?.code)
        node = (
          <Box
            key={`c${i}`}
            component="code"
            sx={{
              background: 'action.hover',
              px: 0.5,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.85em',
            }}
          >
            {node}
          </Box>
        );

      if (Object.keys(inlineStyle).length > 0) {
        node = (
          <span key={`style${i}`} style={inlineStyle}>
            {node}
          </span>
        );
      }

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

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#message-${message.id}`;
    navigator.clipboard.writeText(url);
  };

  if (message.isDeleted) {
    return (
      <Box sx={{ display: 'flex', gap: 1.5, px: 2, py: 0.5, opacity: 0.5 }}>
        <Avatar sx={{ width: 36, height: 36, mt: 0.5 }}>{message.username[0].toUpperCase()}</Avatar>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {message.username}
          </Typography>
          <Typography variant="body2" fontStyle="italic" color="text.secondary">
            This message was deleted.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      id={`message-${message.id}`}
      data-own={isOwn ? 'true' : 'false'}
      sx={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        gap: 1.5,
        px: 2,
        py: 0.5,
        '&:hover .msg-actions': { opacity: 1 },
        position: 'relative',
        alignItems: 'flex-start',
      }}
    >
      <Avatar sx={{ width: 36, height: 36, flexShrink: 0 }}>
        {message.username[0].toUpperCase()}
      </Avatar>

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOwn ? 'flex-end' : 'flex-start',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: isOwn ? 'row-reverse' : 'row',
            alignItems: 'baseline',
            gap: 1,
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {message.username}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(message.createdAt)}
          </Typography>
          {message.isEdited && (
            <Typography variant="caption" color="text.secondary">
              (edited)
            </Typography>
          )}
        </Box>

        {editing ? (
          <Box sx={{ mt: 0.5, width: '100%' }}>
            <RichEditor
              users={users}
              onSend={handleEdit}
              onCancel={() => setEditing(false)}
              initialContent={message.content}
            />
          </Box>
        ) : (
          <Box
            sx={{
              maxWidth: '75%',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              borderRadius: isOwn ? '12px 12px 0 12px' : '12px 12px 12px 0',
              px: 1.5,
              py: 0.75,
              mt: 0.25,
              bgcolor: isOwn ? 'primary.main' : 'grey.100',
              color: isOwn ? 'primary.contrastText' : 'text.primary',
            }}
          >
            {renderContent(message.content)}
          </Box>
        )}
      </Box>

      {!editing && (
        <Box
          className="msg-actions"
          sx={{
            opacity: 0,
            transition: 'opacity 0.15s',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          <Tooltip title="リンクをコピー">
            <IconButton size="small" aria-label="リンクをコピー" onClick={handleCopyLink}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isOwn && (
            <>
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
            </>
          )}
        </Box>
      )}

      {editing && (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', flexShrink: 0 }}>
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
