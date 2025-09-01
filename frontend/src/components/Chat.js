import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  IconButton,
  Badge,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardActions,
  Fab,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Send,
  AttachFile,
  EmojiEmotions,
  MoreVert,
  Search,
  Group,
  Person,
  Block,
  Archive,
  Delete,
  Edit,
  Reply,
  ThumbUp,
  ThumbDown,
  Favorite,
  Close,
  Add,
  Videocam,
  Call,
  Info
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { serverURL } from '../helper/Helper';
import socketService from '../services/socketService';
import ChatMessage from './ChatMessage';
import ChatSidebar from './ChatSidebar';
import ChatHeader from './ChatHeader';
import EmojiPicker from './EmojiPicker';
import FileUpload from './FileUpload';

const Chat = () => {
  const { user } = useSelector(state => state);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatData, setNewChatData] = useState({
    participants: [],
    chatType: 'direct',
    name: '',
    description: ''
  });
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load user's chats
  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${serverURL}/api/chat`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setChats(response.data.chats);
      } catch (err) {
        setError('Failed to load chats');
        console.error('Error loading chats:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadChats();
    }
  }, [user]);

  // Load available users for new chat
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await axios.get(`${serverURL}/api/user`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setAvailableUsers(response.data.users.filter(u => u._id !== user._id));
      } catch (err) {
        console.error('Error loading users:', err);
      }
    };

    if (user) {
      loadUsers();
    }
  }, [user]);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery) {
      const filtered = availableUsers.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(availableUsers);
    }
  }, [searchQuery, availableUsers]);

  // Load messages for selected chat
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedChat) return;

      try {
        setLoading(true);
        const response = await axios.get(`${serverURL}/api/chat/${selectedChat._id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setMessages(response.data.chat.messages || []);
        
        // Join chat room for real-time updates
        socketService.joinChatRoom(selectedChat._id);
      } catch (err) {
        setError('Failed to load messages');
        console.error('Error loading messages:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [selectedChat]);

  // Socket event listeners
  useEffect(() => {
    const socket = socketService.connect();

    // New message received
    const handleNewMessage = (data) => {
      if (data.chatId === selectedChat?._id) {
        setMessages(prev => [...prev, data.message]);
      }
      // Update chat list with new message
      setChats(prev => prev.map(chat => 
        chat._id === data.chatId 
          ? { ...chat, lastMessage: data.message, lastActivity: new Date() }
          : chat
      ));
    };

    // Message edited
    const handleMessageEdited = (data) => {
      if (data.chatId === selectedChat?._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? { ...msg, content: data.content, isEdited: true, editedAt: data.editedAt }
            : msg
        ));
      }
    };

    // Message deleted
    const handleMessageDeleted = (data) => {
      if (data.chatId === selectedChat?._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? { ...msg, isDeleted: true, deletedAt: new Date() }
            : msg
        ));
      }
    };

    // User typing in chat
    const handleUserTyping = (data) => {
      if (data.chatId === selectedChat?._id) {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.userId);
          return [...filtered, { userId: data.userId, userName: data.userName }];
        });
      }
    };

    // User stopped typing in chat
    const handleUserStoppedTyping = (data) => {
      if (data.chatId === selectedChat?._id) {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    };

    // New chat created
    const handleNewChat = (data) => {
      setChats(prev => [data.chat, ...prev]);
    };

    // Messages read
    const handleMessagesRead = (data) => {
      if (data.chatId === selectedChat?._id) {
        // Update read receipts in messages
        setMessages(prev => prev.map(msg => ({
          ...msg,
          readBy: msg.readBy || []
        })));
      }
    };

    // Reaction added
    const handleReactionAdded = (data) => {
      if (data.chatId === selectedChat?._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? { ...msg, reactions: [...(msg.reactions || []), data.reaction] }
            : msg
        ));
      }
    };

    // Reaction removed
    const handleReactionRemoved = (data) => {
      if (data.chatId === selectedChat?._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? { 
                ...msg, 
                reactions: (msg.reactions || []).filter(r => r.user !== data.userId)
              }
            : msg
        ));
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('user-typing-chat', handleUserTyping);
    socket.on('user-stopped-typing-chat', handleUserStoppedTyping);
    socket.on('new-chat', handleNewChat);
    socket.on('messages-read', handleMessagesRead);
    socket.on('reaction-added', handleReactionAdded);
    socket.on('reaction-removed', handleReactionRemoved);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('user-typing-chat', handleUserTyping);
      socket.off('user-stopped-typing-chat', handleUserStoppedTyping);
      socket.off('new-chat', handleNewChat);
      socket.off('messages-read', handleMessagesRead);
      socket.off('reaction-added', handleReactionAdded);
      socket.off('reaction-removed', handleReactionRemoved);
    };
  }, [selectedChat]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() && !replyTo) return;

    try {
      const messageData = {
        content: newMessage,
        replyTo: replyTo?._id
      };

      const response = await axios.post(
        `${serverURL}/api/chat/${selectedChat._id}/messages`,
        messageData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setNewMessage('');
      setReplyTo(null);
      setMessages(prev => [...prev, response.data.message]);
    } catch (err) {
      setError('Failed to send message');
      console.error('Error sending message:', err);
    }
  };

  // Handle typing
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (selectedChat) {
      socketService.emitChatTyping(selectedChat._id, user._id, user.name);
      
      // Clear typing indicator after 3 seconds
      setTimeout(() => {
        socketService.emitChatStoppedTyping(selectedChat._id, user._id);
      }, 3000);
    }
  };

  // Create new chat
  const createNewChat = async () => {
    try {
      const response = await axios.post(
        `${serverURL}/api/chat`,
        newChatData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setChats(prev => [response.data.chat, ...prev]);
      setSelectedChat(response.data.chat);
      setShowNewChatDialog(false);
      setNewChatData({
        participants: [],
        chatType: 'direct',
        name: '',
        description: ''
      });
    } catch (err) {
      setError('Failed to create chat');
      console.error('Error creating chat:', err);
    }
  };

  // Add emoji to message
  const addEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await axios.post(
        `${serverURL}/api/media/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const messageData = {
        content: '',
        messageType: 'file',
        mediaUrl: uploadResponse.data.url,
        fileName: file.name,
        fileSize: file.size
      };

      const response = await axios.post(
        `${serverURL}/api/chat/${selectedChat._id}/messages`,
        messageData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setMessages(prev => [...prev, response.data.message]);
      setShowFileUpload(false);
    } catch (err) {
      setError('Failed to upload file');
      console.error('Error uploading file:', err);
    }
  };

  // Edit message
  const editMessage = async (messageId, newContent) => {
    try {
      await axios.put(
        `${serverURL}/api/chat/${selectedChat._id}/messages/${messageId}`,
        { content: newContent },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setMessages(prev => prev.map(msg => 
        msg._id === messageId 
          ? { ...msg, content: newContent, isEdited: true, editedAt: new Date() }
          : msg
      ));
      setEditingMessage(null);
    } catch (err) {
      setError('Failed to edit message');
      console.error('Error editing message:', err);
    }
  };

  // Delete message
  const deleteMessage = async (messageId) => {
    try {
      await axios.delete(
        `${serverURL}/api/chat/${selectedChat._id}/messages/${messageId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setMessages(prev => prev.map(msg => 
        msg._id === messageId 
          ? { ...msg, isDeleted: true, deletedAt: new Date() }
          : msg
      ));
    } catch (err) {
      setError('Failed to delete message');
      console.error('Error deleting message:', err);
    }
  };

  // Add reaction
  const addReaction = async (messageId, emoji) => {
    try {
      await axios.post(
        `${serverURL}/api/chat/${selectedChat._id}/messages/${messageId}/reactions`,
        { emoji },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
    } catch (err) {
      setError('Failed to add reaction');
      console.error('Error adding reaction:', err);
    }
  };

  // Mark messages as read
  const markAsRead = async () => {
    if (!selectedChat) return;

    try {
      await axios.post(
        `${serverURL}/api/chat/${selectedChat._id}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 80px)', bgcolor: 'background.default' }}>
      {/* Chat Sidebar */}
      <ChatSidebar
        chats={chats}
        selectedChat={selectedChat}
        onChatSelect={setSelectedChat}
        onNewChat={() => setShowNewChatDialog(true)}
        loading={loading}
      />

      {/* Main Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <ChatHeader
              chat={selectedChat}
              onBack={() => setSelectedChat(null)}
            />

            {/* Messages Area */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatMessage
                      key={message._id}
                      message={message}
                      currentUser={user}
                      onReply={setReplyTo}
                      onEdit={setEditingMessage}
                      onDelete={deleteMessage}
                      onReaction={addReaction}
                      editing={editingMessage === message._id}
                      onSaveEdit={editMessage}
                      onCancelEdit={() => setEditingMessage(null)}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}

              {/* Typing Indicators */}
              {typingUsers.length > 0 && (
                <Box sx={{ mt: 1, ml: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Reply Preview */}
            {replyTo && (
              <Box sx={{ p: 1, bgcolor: 'action.hover', borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    Replying to {replyTo.sender.name}
                  </Typography>
                  <IconButton size="small" onClick={() => setReplyTo(null)}>
                    <Close />
                  </IconButton>
                </Box>
                <Typography variant="body2" noWrap>
                  {replyTo.content}
                </Typography>
              </Box>
            )}

            {/* Message Input */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                <IconButton onClick={() => setShowFileUpload(true)}>
                  <AttachFile />
                </IconButton>
                <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <EmojiEmotions />
                </IconButton>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  variant="outlined"
                  size="small"
                />
                <IconButton 
                  onClick={sendMessage}
                  disabled={!newMessage.trim() && !replyTo}
                  color="primary"
                >
                  <Send />
                </IconButton>
              </Box>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <Box sx={{ position: 'absolute', bottom: 80, right: 16, zIndex: 1000 }}>
                  <EmojiPicker onEmojiSelect={addEmoji} />
                </Box>
              )}
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="h6" color="text.secondary">
              Select a chat to start messaging
            </Typography>
          </Box>
        )}
      </Box>

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onClose={() => setShowNewChatDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start New Chat</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Chat Type</InputLabel>
            <Select
              value={newChatData.chatType}
              onChange={(e) => setNewChatData(prev => ({ ...prev, chatType: e.target.value }))}
            >
              <MenuItem value="direct">Direct Message</MenuItem>
              <MenuItem value="group">Group Chat</MenuItem>
            </Select>
          </FormControl>

          {newChatData.chatType === 'group' && (
            <>
              <TextField
                fullWidth
                label="Group Name"
                value={newChatData.name}
                onChange={(e) => setNewChatData(prev => ({ ...prev, name: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                value={newChatData.description}
                onChange={(e) => setNewChatData(prev => ({ ...prev, description: e.target.value }))}
                sx={{ mb: 2 }}
              />
            </>
          )}

          <TextField
            fullWidth
            label="Search Users"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 2 }}
          />

          <List>
            {filteredUsers.map((user) => (
              <ListItem
                key={user._id}
                button
                onClick={() => {
                  if (newChatData.chatType === 'direct') {
                    setNewChatData(prev => ({ ...prev, participants: [user._id] }));
                  } else {
                    setNewChatData(prev => ({
                      ...prev,
                      participants: prev.participants.includes(user._id)
                        ? prev.participants.filter(id => id !== user._id)
                        : [...prev.participants, user._id]
                    }));
                  }
                }}
                selected={newChatData.participants.includes(user._id)}
              >
                <ListItemAvatar>
                  <Avatar src={user.profile?.profilePicture} />
                </ListItemAvatar>
                <ListItemText
                  primary={user.name}
                  secondary={user.email}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewChatDialog(false)}>Cancel</Button>
          <Button 
            onClick={createNewChat}
            disabled={newChatData.participants.length === 0 || (newChatData.chatType === 'group' && !newChatData.name)}
            variant="contained"
          >
            Create Chat
          </Button>
        </DialogActions>
      </Dialog>

      {/* File Upload Dialog */}
      <FileUpload
        open={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        onUpload={handleFileUpload}
      />

      {/* Error Snackbar */}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Chat;
