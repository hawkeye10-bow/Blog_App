import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Badge,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Divider
} from '@mui/material';
import {
  ArrowBack,
  MoreVert,
  Search,
  Videocam,
  Call,
  Info,
  Group,
  Person,
  Block,
  Archive,
  Delete,
  Edit,
  Add,
  Remove
} from '@mui/icons-material';
import { useSelector } from 'react-redux';

const ChatHeader = ({ chat, onBack }) => {
  const { user: currentUser } = useSelector(state => state);
  const [anchorEl, setAnchorEl] = useState(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showParticipantsDialog, setShowParticipantsDialog] = useState(false);
  const [showAddParticipantDialog, setShowAddParticipantDialog] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getChatDisplayName = () => {
    if (chat.chatType === 'group') {
      return chat.name || 'Group Chat';
    } else {
      const otherParticipant = chat.participants?.find(p => p.user?._id !== currentUser?._id);
      return otherParticipant?.user?.name || 'Unknown User';
    }
  };

  const getChatAvatar = () => {
    if (chat.chatType === 'group') {
      return chat.avatar || null;
    } else {
      const otherParticipant = chat.participants?.find(p => p.user?._id !== currentUser?._id);
      return otherParticipant?.user?.profile?.profilePicture || null;
    }
  };

  const getOnlineParticipants = () => {
    return chat.participants?.filter(p => p.isOnline) || [];
  };

  const isUserAdmin = () => {
    const userParticipant = chat.participants?.find(p => p.user?._id === currentUser?._id);
    return userParticipant?.role === 'admin';
  };

  const handleArchive = () => {
    // Implement archive functionality
    handleMenuClose();
  };

  const handleBlock = () => {
    // Implement block functionality
    handleMenuClose();
  };

  const handleDelete = () => {
    // Implement delete functionality
    handleMenuClose();
  };

  const handleVideoCall = () => {
    // Implement video call functionality
    handleMenuClose();
  };

  const handleVoiceCall = () => {
    // Implement voice call functionality
    handleMenuClose();
  };

  const handleSearch = () => {
    // Implement search functionality
    handleMenuClose();
  };

  const handleAddParticipant = async () => {
    try {
      // Load available users
      const response = await fetch('/api/user', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setAvailableUsers(data.users.filter(u => 
        u._id !== currentUser._id && 
        !chat.participants.some(p => p.user._id === u._id)
      ));
      setShowAddParticipantDialog(true);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleRemoveParticipant = (participantId) => {
    // Implement remove participant functionality
  };

  return (
    <>
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'background.paper'
      }}>
        {/* Back Button */}
        <IconButton onClick={onBack}>
          <ArrowBack />
        </IconButton>

        {/* Chat Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Badge
            overlap="circular"
            anchorOrigin={{ bottom: 'right', right: 'bottom' }}
            badgeContent={
              getOnlineParticipants().length > 0 ? (
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
              src={getChatAvatar()}
              sx={{ width: 40, height: 40 }}
            >
              {chat.chatType === 'group' ? (
                <Group />
              ) : (
                getChatDisplayName()?.charAt(0)
              )}
            </Avatar>
          </Badge>

          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {getChatDisplayName()}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {chat.chatType === 'group' && (
                <Typography variant="caption" color="text.secondary">
                  {chat.participants?.length || 0} members
                </Typography>
              )}
              {getOnlineParticipants().length > 0 && (
                <Typography variant="caption" color="success.main">
                  {getOnlineParticipants().length} online
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {chat.chatType === 'direct' && (
            <>
              <Tooltip title="Voice Call">
                <IconButton onClick={handleVoiceCall}>
                  <Call />
                </IconButton>
              </Tooltip>
              <Tooltip title="Video Call">
                <IconButton onClick={handleVideoCall}>
                  <Videocam />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Tooltip title="Search">
            <IconButton onClick={handleSearch}>
              <Search />
            </IconButton>
          </Tooltip>

          <Tooltip title="More">
            <IconButton onClick={handleMenuOpen}>
              <MoreVert />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { setShowInfoDialog(true); handleMenuClose(); }}>
          <Info sx={{ mr: 1 }} /> Chat Info
        </MenuItem>
        
        {chat.chatType === 'group' && (
          <MenuItem onClick={() => { setShowParticipantsDialog(true); handleMenuClose(); }}>
            <Group sx={{ mr: 1 }} /> Participants
          </MenuItem>
        )}

        <MenuItem onClick={handleSearch}>
          <Search sx={{ mr: 1 }} /> Search Messages
        </MenuItem>

        <Divider />

        {chat.chatType === 'direct' && (
          <MenuItem onClick={handleBlock}>
            <Block sx={{ mr: 1 }} /> Block User
          </MenuItem>
        )}

        <MenuItem onClick={handleArchive}>
          <Archive sx={{ mr: 1 }} /> Archive Chat
        </MenuItem>

        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} /> Delete Chat
        </MenuItem>
      </Menu>

      {/* Chat Info Dialog */}
      <Dialog open={showInfoDialog} onClose={() => setShowInfoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chat Info</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar
              src={getChatAvatar()}
              sx={{ width: 60, height: 60 }}
            >
              {chat.chatType === 'group' ? <Group /> : getChatDisplayName()?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h6">{getChatDisplayName()}</Typography>
              <Typography variant="body2" color="text.secondary">
                {chat.chatType === 'group' ? 'Group Chat' : 'Direct Message'}
              </Typography>
            </Box>
          </Box>

          {chat.chatType === 'group' && chat.description && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {chat.description}
            </Typography>
          )}

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Created: {new Date(chat.createdAt).toLocaleDateString()}
          </Typography>

          <Typography variant="subtitle2">
            Last Activity: {new Date(chat.lastActivity).toLocaleString()}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInfoDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Participants Dialog */}
      <Dialog open={showParticipantsDialog} onClose={() => setShowParticipantsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Participants ({chat.participants?.length || 0})
        </DialogTitle>
        <DialogContent>
          <List>
            {chat.participants?.map((participant) => (
              <ListItem key={participant.user._id}>
                <ListItemAvatar>
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ bottom: 'right', right: 'bottom' }}
                    badgeContent={
                      participant.isOnline ? (
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
                    <Avatar src={participant.user.profile?.profilePicture}>
                      {participant.user.name?.charAt(0)}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={participant.user.name}
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={participant.role}
                        size="small"
                        color={participant.role === 'admin' ? 'primary' : 'default'}
                      />
                      {participant.isOnline && (
                        <Typography variant="caption" color="success.main">
                          Online
                        </Typography>
                      )}
                    </Box>
                  }
                />
                {isUserAdmin() && participant.user._id !== currentUser._id && (
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveParticipant(participant.user._id)}
                    color="error"
                  >
                    <Remove />
                  </IconButton>
                )}
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          {isUserAdmin() && (
            <Button onClick={handleAddParticipant} startIcon={<Add />}>
              Add Participant
            </Button>
          )}
          <Button onClick={() => setShowParticipantsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Participant Dialog */}
      <Dialog open={showAddParticipantDialog} onClose={() => setShowAddParticipantDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Participant</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select User</InputLabel>
            <Select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              {availableUsers.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={user.profile?.profilePicture} sx={{ width: 24, height: 24 }}>
                      {user.name?.charAt(0)}
                    </Avatar>
                    <Typography>{user.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddParticipantDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              // Implement add participant functionality
              setShowAddParticipantDialog(false);
            }}
            disabled={!selectedUser}
            variant="contained"
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ChatHeader;
