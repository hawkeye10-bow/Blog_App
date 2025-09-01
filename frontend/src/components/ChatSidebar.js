import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Badge,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
  Chip,
  Tooltip,
  Fab,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Search,
  Add,
  Group,
  Person,
  MoreVert,
  Archive,
  Delete,
  Block,
  Videocam,
  Call,
  Info
} from '@mui/icons-material';
import { format } from 'date-fns';

import { useSelector } from 'react-redux';

const ChatSidebar = ({ chats, selectedChat, onChatSelect, onNewChat, loading }) => {
  const { user: currentUser } = useSelector(state => state);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState(chats);

  // Filter chats based on search query
  React.useEffect(() => {
    if (searchQuery) {
      const filtered = chats.filter(chat => {
        if (chat.chatType === 'group') {
          return chat.name?.toLowerCase().includes(searchQuery.toLowerCase());
        } else {
          // For direct chats, search in participant names
          return chat.participants?.some(participant => 
            participant.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            participant.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
      });
      setFilteredChats(filtered);
    } else {
      setFilteredChats(chats);
    }
  }, [searchQuery, chats]);

  const getChatDisplayName = (chat) => {
    if (chat.chatType === 'group') {
      return chat.name || 'Group Chat';
    } else {
      // For direct chats, show the other participant's name
      const otherParticipant = chat.participants?.find(p => p.user?._id !== currentUser?._id);
      return otherParticipant?.user?.name || 'Unknown User';
    }
  };

  const getChatAvatar = (chat) => {
    if (chat.chatType === 'group') {
      return chat.avatar || null;
    } else {
      const otherParticipant = chat.participants?.find(p => p.user?._id !== currentUser?._id);
      return otherParticipant?.user?.profile?.profilePicture || null;
    }
  };

  const getLastMessage = (chat) => {
    if (!chat.lastMessage) return 'No messages yet';
    
    const message = chat.lastMessage;
    if (message.isDeleted) return 'This message was deleted';
    
    switch (message.messageType) {
      case 'image':
        return '📷 Image';
      case 'file':
        return `📎 ${message.fileName}`;
      case 'video':
        return '🎥 Video';
      case 'link':
        return '🔗 Link';
      default:
        return message.content || 'No content';
    }
  };

  const getUnreadCount = (chat) => {
    return chat.unreadCount || 0;
  };

  const getLastActivity = (chat) => {
    if (!chat.lastActivity) return '';
    
    const now = new Date();
    const lastActivity = new Date(chat.lastActivity);
    const diffInHours = (now - lastActivity) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return format(lastActivity, 'HH:mm');
    } else if (diffInHours < 24) {
      return format(lastActivity, 'HH:mm');
    } else if (diffInHours < 168) { // 7 days
      return format(lastActivity, 'EEE');
    } else {
      return format(lastActivity, 'MMM dd');
    }
  };

  const isOnline = (chat) => {
    if (chat.chatType === 'group') {
      return chat.participants?.some(p => p.isOnline);
    } else {
      const otherParticipant = chat.participants?.find(p => p.user?._id !== currentUser?._id);
      return otherParticipant?.isOnline || false;
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        width: 320, 
        borderRight: 1, 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: 320, 
      borderRight: 1, 
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.paper'
    }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight="bold">
          Messages
        </Typography>
      </Box>

      {/* Search */}
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          variant="outlined"
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* Chat List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {filteredChats.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchQuery ? 'No chats found' : 'No chats yet'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredChats.map((chat) => {
              const isSelected = selectedChat?._id === chat._id;
              const unreadCount = getUnreadCount(chat);
              
              return (
                <ListItem
                  key={chat._id}
                  button
                  selected={isSelected}
                  onClick={() => onChatSelect(chat)}
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover'
                    },
                    '&.Mui-selected': {
                      bgcolor: 'primary.light',
                      '&:hover': {
                        bgcolor: 'primary.light'
                      }
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ bottom: 'right', right: 'bottom' }}
                      badgeContent={
                        isOnline(chat) ? (
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: 'success.main',
                              border: 2,
                              borderColor: 'background.paper'
                            }}
                          />
                        ) : null
                      }
                    >
                      <Avatar
                        src={getChatAvatar(chat)}
                        sx={{ width: 48, height: 48 }}
                      >
                        {chat.chatType === 'group' ? (
                          <Group />
                        ) : (
                          getChatDisplayName(chat)?.charAt(0)
                        )}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>

                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography
                          variant="subtitle2"
                          fontWeight={unreadCount > 0 ? 'bold' : 'normal'}
                          noWrap
                          sx={{ flex: 1 }}
                        >
                          {getChatDisplayName(chat)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getLastActivity(chat)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography
                          variant="body2"
                          color={unreadCount > 0 ? 'text.primary' : 'text.secondary'}
                          fontWeight={unreadCount > 0 ? 'bold' : 'normal'}
                          noWrap
                          sx={{ flex: 1 }}
                        >
                          {getLastMessage(chat)}
                        </Typography>
                        {unreadCount > 0 && (
                          <Badge
                            badgeContent={unreadCount}
                            color="primary"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    }
                  />

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {chat.chatType === 'group' && (
                      <Chip
                        label={`${chat.participants?.length || 0} members`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* New Chat Button */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Fab
          color="primary"
          size="medium"
          onClick={onNewChat}
          sx={{ width: '100%' }}
        >
          <Add sx={{ mr: 1 }} />
          New Chat
        </Fab>
      </Box>
    </Box>
  );
};

export default ChatSidebar;
