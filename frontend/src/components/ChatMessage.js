import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Button,
  Chip,
  Tooltip,
  Badge,
  Link
} from '@mui/material';
import {
  MoreVert,
  Edit,
  Delete,
  Reply,
  ThumbUp,
  ThumbDown,
  Favorite,
  AttachFile,
  Image,
  VideoFile,
  Description,
  Download,
  PlayArrow,
  Pause
} from '@mui/icons-material';
import { format } from 'date-fns';

const ChatMessage = ({
  message,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  editing,
  onSaveEdit,
  onCancelEdit
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editContent, setEditContent] = useState(message.content);
  const [showReactions, setShowReactions] = useState(false);

  const isOwnMessage = message.sender._id === currentUser._id;
  const isDeleted = message.isDeleted;
  const isEdited = message.isEdited;

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    setEditContent(message.content);
    onEdit(message._id);
    handleMenuClose();
  };

  const handleSaveEdit = () => {
    onSaveEdit(message._id, editContent);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    onCancelEdit();
  };

  const handleDelete = () => {
    onDelete(message._id);
    handleMenuClose();
  };

  const handleReply = () => {
    onReply(message);
    handleMenuClose();
  };

  const handleReaction = (emoji) => {
    onReaction(message._id, emoji);
    setShowReactions(false);
  };

  const renderMessageContent = () => {
    if (isDeleted) {
      return (
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          This message was deleted
        </Typography>
      );
    }

    switch (message.messageType) {
      case 'image':
        return (
          <Box>
            <img
              src={message.mediaUrl}
              alt="Shared image"
              style={{
                maxWidth: '300px',
                maxHeight: '300px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => window.open(message.mediaUrl, '_blank')}
            />
            {message.content && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {message.content}
              </Typography>
            )}
          </Box>
        );

      case 'file':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachFile />
            <Box>
              <Typography variant="body2" fontWeight="bold">
                {message.fileName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(message.fileSize / 1024 / 1024).toFixed(2)} MB
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => window.open(message.mediaUrl, '_blank')}>
              <Download />
            </IconButton>
          </Box>
        );

      case 'video':
        return (
          <Box>
            <video
              controls
              style={{
                maxWidth: '300px',
                maxHeight: '300px',
                borderRadius: '8px'
              }}
            >
              <source src={message.mediaUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            {message.content && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {message.content}
              </Typography>
            )}
          </Box>
        );

      case 'link':
        return (
          <Box>
            <Link href={message.content} target="_blank" rel="noopener noreferrer">
              {message.content}
            </Link>
          </Box>
        );

      default:
        return (
          <Typography variant="body2">
            {message.content}
          </Typography>
        );
    }
  };

  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    const reactionGroups = message.reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    }, {});

    return (
      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
        {Object.entries(reactionGroups).map(([emoji, reactions]) => (
          <Chip
            key={emoji}
            label={`${emoji} ${reactions.length}`}
            size="small"
            variant="outlined"
            onClick={() => handleReaction(emoji)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>
    );
  };

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;

    return (
      <Box sx={{ 
        bgcolor: 'action.hover', 
        p: 1, 
        borderRadius: 1, 
        mb: 1,
        borderLeft: 3,
        borderColor: 'primary.main'
      }}>
        <Typography variant="caption" color="text.secondary">
          Replying to {message.replyTo.sender.name}
        </Typography>
        <Typography variant="body2" noWrap>
          {message.replyTo.content}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
        mb: 2,
        position: 'relative'
      }}
    >
      {!isOwnMessage && (
        <Avatar
          src={message.sender.profile?.profilePicture}
          sx={{ mr: 1, width: 32, height: 32 }}
        >
          {message.sender.name?.charAt(0)}
        </Avatar>
      )}

      <Box sx={{ maxWidth: '70%' }}>
        {!isOwnMessage && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {message.sender.name}
          </Typography>
        )}

        <Paper
          elevation={1}
          sx={{
            p: 1.5,
            bgcolor: isOwnMessage ? 'primary.main' : 'background.paper',
            color: isOwnMessage ? 'primary.contrastText' : 'text.primary',
            borderRadius: 2,
            position: 'relative',
            '&:hover': {
              '& .message-actions': {
                opacity: 1
              }
            }
          }}
        >
          {/* Reply Preview */}
          {renderReplyPreview()}

          {/* Message Content */}
          {editing ? (
            <Box>
              <TextField
                fullWidth
                multiline
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                variant="outlined"
                size="small"
                autoFocus
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button size="small" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="small" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </Box>
            </Box>
          ) : (
            renderMessageContent()
          )}

          {/* Reactions */}
          {renderReactions()}

          {/* Message Actions */}
          <Box
            className="message-actions"
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              opacity: 0,
              transition: 'opacity 0.2s',
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: 2,
              display: 'flex',
              gap: 0.5
            }}
          >
            <Tooltip title="React">
              <IconButton
                size="small"
                onClick={() => setShowReactions(!showReactions)}
              >
                <ThumbUp fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Reply">
              <IconButton size="small" onClick={handleReply}>
                <Reply fontSize="small" />
              </IconButton>
            </Tooltip>

            {isOwnMessage && !isDeleted && (
              <>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={handleEdit}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Delete">
                  <IconButton size="small" onClick={handleDelete}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}

            <Tooltip title="More">
              <IconButton size="small" onClick={handleMenuOpen}>
                <MoreVert fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Quick Reactions */}
          {showReactions && (
            <Box
              sx={{
                position: 'absolute',
                bottom: -40,
                right: 0,
                bgcolor: 'background.paper',
                borderRadius: 1,
                boxShadow: 2,
                p: 0.5,
                display: 'flex',
                gap: 0.5
              }}
            >
              {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                <IconButton
                  key={emoji}
                  size="small"
                  onClick={() => handleReaction(emoji)}
                  sx={{ fontSize: '1.2rem' }}
                >
                  {emoji}
                </IconButton>
              ))}
            </Box>
          )}
        </Paper>

        {/* Message Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {format(new Date(message.createdAt), 'HH:mm')}
          </Typography>
          
          {isEdited && (
            <Typography variant="caption" color="text.secondary" fontStyle="italic">
              edited
            </Typography>
          )}

          {isOwnMessage && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {message.readBy && message.readBy.length > 1 && (
                <Typography variant="caption" color="text.secondary">
                  ✓✓
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Message Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleReaction('👍')}>
          <ThumbUp sx={{ mr: 1 }} /> Like
        </MenuItem>
        <MenuItem onClick={() => handleReaction('❤️')}>
          <Favorite sx={{ mr: 1 }} /> Love
        </MenuItem>
        <MenuItem onClick={handleReply}>
          <Reply sx={{ mr: 1 }} /> Reply
        </MenuItem>
        {isOwnMessage && !isDeleted && (
          <>
            <MenuItem onClick={handleEdit}>
              <Edit sx={{ mr: 1 }} /> Edit
            </MenuItem>
            <MenuItem onClick={handleDelete}>
              <Delete sx={{ mr: 1 }} /> Delete
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
};

export default ChatMessage;
