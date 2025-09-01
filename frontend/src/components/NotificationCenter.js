import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Avatar,
  Divider,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Notifications as NotificationsIcon,
  Favorite as LikeIcon,
  Comment as CommentIcon,
  PersonAdd as FollowIcon,
  Article as PostIcon,
  MarkEmailRead as MarkReadIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { serverURL } from '../helper/Helper';
import socketService from '../services/socketService';
import { formatDistanceToNow } from 'date-fns';

const NotificationMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: theme.spacing(2),
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    maxWidth: '400px',
    width: '400px',
    maxHeight: '500px',
  },
}));

const NotificationItem = styled(ListItem)(({ theme, isRead }) => ({
  backgroundColor: isRead ? 'transparent' : 'rgba(102, 126, 234, 0.05)',
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5, 1),
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.08)',
    transform: 'translateX(4px)',
  },
}));

const NotificationCenter = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const user = useSelector(state => state.user);
  const open = Boolean(anchorEl);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      setupRealTimeNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${serverURL}/api/user/notifications/${user._id}?limit=20`);
      const { notifications: fetchedNotifications, pagination } = response.data;
      
      setNotifications(fetchedNotifications || []);
      setUnreadCount(pagination.unreadCount || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeNotifications = () => {
    const socket = socketService.connect();

    const handleNewNotification = (data) => {
      setNotifications(prev => [data, ...prev.slice(0, 19)]);
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('BLOGGY', {
          body: data.message,
          icon: '/favicon.ico'
        });
      }
    };

    socketService.onNewNotification = (callback) => {
      socket.on('new-notification', callback);
    };

    socketService.onNewNotification(handleNewNotification);

    return () => {
      socket.off('new-notification', handleNewNotification);
    };
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    if (notifications.length === 0) {
      fetchNotifications();
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const markAsRead = async (notificationIds = null) => {
    try {
      await axios.put(`${serverURL}/api/user/notifications/${user._id}/read`, {
        notificationIds
      });
      
      if (notificationIds) {
        setNotifications(prev => 
          prev.map(notification => 
            notificationIds.includes(notification._id) 
              ? { ...notification, read: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
      } else {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const markAllAsRead = () => {
    markAsRead();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <LikeIcon color="error" />;
      case 'comment':
        return <CommentIcon color="primary" />;
      case 'follow':
        return <FollowIcon color="success" />;
      case 'new_post':
        return <PostIcon color="info" />;
      default:
        return <NotificationsIcon color="action" />;
    }
  };

  const formatNotificationTime = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{
          color: 'white',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'scale(1.1)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <NotificationMenu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {/* Header */}
        <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={markAllAsRead}
              startIcon={<MarkReadIcon />}
              sx={{ fontSize: '0.75rem' }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        <Divider />

        {/* Notifications List */}
        {loading ? (
          <Box p={3} textAlign="center">
            <Typography color="text.secondary">Loading notifications...</Typography>
          </Box>
        ) : notifications.length > 0 ? (
          <List sx={{ maxHeight: '400px', overflow: 'auto', p: 0 }}>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                isRead={notification.read}
                onClick={() => {
                  if (!notification.read) {
                    markAsRead([notification._id]);
                  }
                }}
              >
                <ListItemAvatar>
                  {notification.from?.profile?.profilePicture ? (
                    <Avatar src={notification.from.profile.profilePicture} />
                  ) : (
                    <Avatar sx={{ backgroundColor: 'primary.main' }}>
                      {getNotificationIcon(notification.type)}
                    </Avatar>
                  )}
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={notification.read ? 400 : 600}>
                      {notification.message}
                    </Typography>
                  }
                  secondary={
                    <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                      <Chip
                        label={notification.type}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: '20px' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatNotificationTime(notification.createdAt)}
                      </Typography>
                    </Box>
                  }
                />
                {!notification.read && (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'primary.main',
                      ml: 1
                    }}
                  />
                )}
              </NotificationItem>
            ))}
          </List>
        ) : (
          <Box p={4} textAlign="center">
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography color="text.secondary">
              No notifications yet
            </Typography>
          </Box>
        )}

        {notifications.length > 0 && (
          <>
            <Divider />
            <Box p={2} textAlign="center">
              <Button size="small" color="primary">
                View All Notifications
              </Button>
            </Box>
          </>
        )}
      </NotificationMenu>
    </>
  );
};

export default NotificationCenter;