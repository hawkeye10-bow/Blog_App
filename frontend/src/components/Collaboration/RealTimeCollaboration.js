import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  CircularProgress,
  Paper,
  Tooltip,
  Badge,
  Grid
} from '@mui/material';
import {
  Group as GroupIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PersonAdd as InviteIcon,
  RemoveCircle as RemoveIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  Sync as SyncIcon,
  Warning as WarningIcon,
  CheckCircle as OnlineIcon,
  RadioButtonUnchecked as OfflineIcon
} from '@mui/material';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import socketService from '../../services/socketService.js';
import axios from 'axios';
import { serverURL } from '../../helper/Helper.js';

const RealTimeCollaboration = ({ blogId, onCollaborationChange }) => {
  const { id } = useParams();
  const currentUser = useSelector(state => state.user);
  const [collaborators, setCollaborators] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [activeUsers, setActiveUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [lastActivity, setLastActivity] = useState(new Map());
  
  const typingTimeoutRef = useRef(new Map());
  const activityTimeoutRef = useRef(new Map());

  const blogIdToUse = blogId || id;

  useEffect(() => {
    if (blogIdToUse && currentUser) {
      fetchCollaborationData();
      setupSocketListeners();
    }
    
    return () => {
      cleanupSocketListeners();
    };
  }, [blogIdToUse, currentUser]);

  const setupSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Join collaboration room
    socket.emit('join-blog-collaboration', blogIdToUse);

    // Listen for collaboration updates
    socket.on('collaborator_joined', (data) => {
      if (data.blogId === blogIdToUse) {
        setActiveUsers(prev => new Set([...prev, data.userId]));
        setLastActivity(prev => new Map(prev.set(data.userId, Date.now())));
        
        setMessage({ 
          type: 'info', 
          text: `${data.userName} joined the collaboration` 
        });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    });

    socket.on('collaborator_left', (data) => {
      if (data.blogId === blogIdToUse) {
        setActiveUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        
        setMessage({ 
          type: 'info', 
          text: `${data.userName} left the collaboration` 
        });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    });

    socket.on('user_typing', (data) => {
      if (data.blogId === blogIdToUse && data.userId !== currentUser._id) {
        setTypingUsers(prev => new Map(prev.set(data.userId, data.userName)));
        
        // Clear typing indicator after 3 seconds
        if (typingTimeoutRef.current.has(data.userId)) {
          clearTimeout(typingTimeoutRef.current.get(data.userId));
        }
        
        const timeoutId = setTimeout(() => {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        }, 3000);
        
        typingTimeoutRef.current.set(data.userId, timeoutId);
      }
    });

    socket.on('user_stopped_typing', (data) => {
      if (data.blogId === blogIdToUse && data.userId !== currentUser._id) {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }
    });

    socket.on('content_change', (data) => {
      if (data.blogId === blogIdToUse && data.userId !== currentUser._id) {
        // Update last activity for the user
        setLastActivity(prev => new Map(prev.set(data.userId, Date.now())));
        
        // Emit content change event for parent component
        if (onCollaborationChange) {
          onCollaborationChange({
            type: 'content_change',
            userId: data.userId,
            userName: data.userName,
            content: data.content,
            timestamp: data.timestamp
          });
        }
      }
    });

    socket.on('collaboration_invite_sent', (data) => {
      if (data.blogId === blogIdToUse) {
        setMessage({ 
          type: 'success', 
          text: `Invitation sent to ${data.email}` 
        });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    });

    socket.on('collaboration_invite_accepted', (data) => {
      if (data.blogId === blogIdToUse) {
        setMessage({ 
          type: 'success', 
          text: `${data.userName} accepted the collaboration invitation` 
        });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        fetchCollaborationData(); // Refresh data
      }
    });

    socket.on('collaboration_invite_declined', (data) => {
      if (data.blogId === blogIdToUse) {
        setMessage({ 
          type: 'info', 
          text: `${data.userName} declined the collaboration invitation` 
        });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        fetchCollaborationData(); // Refresh data
      }
    });
  };

  const cleanupSocketListeners = () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.off('collaborator_joined');
    socket.off('collaborator_left');
    socket.off('user_typing');
    socket.off('user_stopped_typing');
    socket.off('content_change');
    socket.off('collaboration_invite_sent');
    socket.off('collaboration_invite_accepted');
    socket.off('collaboration_invite_declined');

    // Clear all timeouts
    typingTimeoutRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    activityTimeoutRef.current.forEach(timeoutId => clearTimeout(timeoutId));
  };

  const fetchCollaborationData = async () => {
    setIsLoading(true);
    try {
      const [collaboratorsRes, invitesRes] = await Promise.all([
        axios.get(`${serverURL}/api/blog/${blogIdToUse}/collaborators`),
        axios.get(`${serverURL}/api/blog/${blogIdToUse}/collaboration-invites`)
      ]);

      setCollaborators(collaboratorsRes.data.collaborators || []);
      setPendingInvites(invitesRes.data.invites || []);
      
      // Set active users based on current collaborators
      const activeUserIds = new Set(
        collaboratorsRes.data.collaborators
          .filter(c => c.isActive)
          .map(c => c.user._id)
      );
      setActiveUsers(activeUserIds);
      
      if (onCollaborationChange) {
        onCollaborationChange({
          type: 'data_loaded',
          collaborators: collaboratorsRes.data.collaborators,
          invites: invitesRes.data.invites
        });
      }
    } catch (error) {
      console.error('Error fetching collaboration data:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to load collaboration data' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteCollaborator = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const response = await axios.post(`${serverURL}/api/blog/${blogIdToUse}/collaboration-invite`, {
        email: inviteEmail.trim(),
        invitedBy: currentUser._id
      });

      if (response.data.success) {
        setInviteEmail('');
        setInviteDialog(false);
        setMessage({ type: 'success', text: 'Invitation sent successfully!' });
        
        // Emit real-time update
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('collaboration_invite_sent', {
            blogId: blogIdToUse,
            email: inviteEmail.trim()
          });
        }

        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        fetchCollaborationData(); // Refresh data
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to send invitation' 
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId) => {
    if (!window.confirm('Are you sure you want to remove this collaborator?')) return;

    try {
      const response = await axios.delete(`${serverURL}/api/blog/${blogIdToUse}/collaborators/${collaboratorId}`);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Collaborator removed successfully!' });
        
        // Emit real-time update
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('collaborator_removed', {
            blogId: blogIdToUse,
            userId: collaboratorId
          });
        }

        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        fetchCollaborationData(); // Refresh data
      }
    } catch (error) {
      console.error('Error removing collaborator:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to remove collaborator' 
      });
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      const response = await axios.delete(`${serverURL}/api/blog/${blogIdToUse}/collaboration-invites/${inviteId}`);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Invitation cancelled successfully!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        fetchCollaborationData(); // Refresh data
      }
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to cancel invitation' 
      });
    }
  };

  const emitTypingIndicator = (isTyping) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    if (isTyping) {
      socket.emit('user_typing', {
        blogId: blogIdToUse,
        userId: currentUser._id,
        userName: currentUser.name
      });
    } else {
      socket.emit('user_stopped_typing', {
        blogId: blogIdToUse,
        userId: currentUser._id
      });
    }
  };

  const emitContentChange = (content) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('content_change', {
      blogId: blogIdToUse,
      userId: currentUser._id,
      userName: currentUser.name,
      content,
      timestamp: new Date()
    });
  };

  const getOnlineStatus = (userId) => {
    return activeUsers.has(userId);
  };

  const getLastActivityTime = (userId) => {
    const lastActive = lastActivity.get(userId);
    if (!lastActive) return 'Unknown';
    
    const now = Date.now();
    const diff = now - lastActive;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Real-Time Collaboration
      </Typography>

      {message.text && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 3 }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      {/* Active Collaborators */}
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              Active Collaborators ({collaborators.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<InviteIcon />}
              onClick={() => setInviteDialog(true)}
              size="small"
            >
              Invite Collaborator
            </Button>
          </Box>

          {collaborators.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No collaborators yet. Invite authors to collaborate on this blog!
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {collaborators.map((collaborator) => (
                <Grid item xs={12} sm={6} md={4} key={collaborator._id}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={
                          <Avatar sx={{ width: 12, height: 12, bgcolor: getOnlineStatus(collaborator.user._id) ? 'success.main' : 'grey.400' }}>
                            {getOnlineStatus(collaborator.user._id) ? <OnlineIcon sx={{ fontSize: 8 }} /> : <OfflineIcon sx={{ fontSize: 8 }} />}
                          </Avatar>
                        }
                      >
                        <Avatar src={collaborator.user.profile?.profilePicture}>
                          {collaborator.user.name?.charAt(0)}
                        </Avatar>
                      </Badge>
                      
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {collaborator.user.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {collaborator.role} • {getLastActivityTime(collaborator.user._id)}
                        </Typography>
                        {typingUsers.has(collaborator.user._id) && (
                          <Chip 
                            label="Typing..." 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>

                      {currentUser._id === collaborator.user._id && (
                        <Chip label="You" size="small" color="primary" />
                      )}

                      {currentUser.role === 'admin' && currentUser._id !== collaborator.user._id && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveCollaborator(collaborator.user._id)}
                        >
                          <RemoveIcon />
                        </IconButton>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Pending Invitations ({pendingInvites.length})
            </Typography>
            
            <List>
              {pendingInvites.map((invite) => (
                <React.Fragment key={invite._id}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'warning.main' }}>
                        <InviteIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={invite.email}
                      secondary={`Invited by ${invite.invitedBy.name} • ${new Date(invite.createdAt).toLocaleDateString()}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleCancelInvite(invite._id)}
                      >
                        Cancel
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Collaboration Controls */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Collaboration Controls
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Real-time typing indicators and content synchronization are active.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                All collaborators can see who's currently editing and receive live updates.
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  onClick={fetchCollaborationData}
                  size="small"
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ViewIcon />}
                  size="small"
                >
                  View History
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog 
        open={inviteDialog} 
        onClose={() => setInviteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Invite Collaborator</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Send an invitation to collaborate on this blog. The user will receive an email with collaboration details.
          </Typography>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter collaborator's email address"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleInviteCollaborator}
            variant="contained"
            disabled={!inviteEmail.trim() || isInviting}
            startIcon={isInviting ? <CircularProgress size={20} /> : <InviteIcon />}
          >
            {isInviting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RealTimeCollaboration;
