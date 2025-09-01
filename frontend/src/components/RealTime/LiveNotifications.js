import React, { useState, useEffect } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  Avatar,
  Typography,
  IconButton,
  Slide,
  Fade,
  Paper,
  Chip,
  Button
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Favorite as LikeIcon,
  Comment as CommentIcon,
  PersonAdd as FollowIcon,
  Article as PostIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material';
import { useRealTimeNotifications } from '../../hooks/useRealTimeFeatures';
import { formatDistanceToNow } from 'date-fns';

const NotificationContainer = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  top: theme.spacing(12),
  right: theme.spacing(3),
  zIndex: 1500,
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: theme.spacing(2),
  padding: theme.spacing(2),
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  maxWidth: '400px',
  minWidth: '320px',
}));

const NotificationItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  backgroundColor: 'rgba(248, 250, 252, 0.8)',
  marginBottom: theme.spacing(1),
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(102, 126, 234, 0.08)',
    transform: 'translateX(4px)',
  },
  '&:last-child': {
    marginBottom: 0,
  },
}));

const NotificationIcon = styled(Box)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: '1.2rem',
}));

const LiveNotifications = ({ maxVisible = 5, autoHide = true, position = 'top-right' }) => {
  const { notifications, markAsRead } = useRealTimeNotifications();
  const [visibleNotifications, setVisibleNotifications] = useState([]);
  const [toastNotification, setToastNotification] = useState(null);

  // Listen for real-time notifications
  useEffect(() => {
    const handleRealtimeNotification = (event) => {
      const notification = event.detail;
      
      // Add to visible notifications
      setVisibleNotifications(prev => {
        const newNotifications = [notification, ...prev.slice(0, maxVisible - 1)];
        return newNotifications;
      });

      // Show toast notification
      setToastNotification(notification);

      // Auto-hide after 5 seconds if enabled
      if (autoHide) {
        setTimeout(() => {
          setVisibleNotifications(prev => 
            prev.filter(n => n.id !== notification.id)
          );
        }, 5000);
      }
    };

    window.addEventListener('realtime-notification', handleRealtimeNotification);
    
    return () => {
      window.removeEventListener('realtime-notification', handleRealtimeNotification);
    };
  }, [maxVisible, autoHide]);

  const getNotificationIcon = (type) => {
    const iconProps = { fontSize: 'small' };
    
    switch (type) {
      case 'like':
        return { icon: <LikeIcon {...iconProps} />, color: '#f44336' };
      case 'comment':
        return { icon: <CommentIcon {...iconProps} />, color: '#2196f3' };
      case 'follow':
        return { icon: <FollowIcon {...iconProps} />, color: '#4caf50' };
      case 'new_post':
        return { icon: <PostIcon {...iconProps} />, color: '#ff9800' };
      case 'share':
        return { icon: <ShareIcon {...iconProps} />, color: '#9c27b0' };
      case 'bookmark':
        return { icon: <BookmarkIcon {...iconProps} />, color: '#607d8b' };
      default:
        return { icon: <NotificationIcon {...iconProps} />, color: '#667eea' };
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    markAsRead([notification.id]);
    
    // Remove from visible notifications
    setVisibleNotifications(prev => 
      prev.filter(n => n.id !== notification.id)
    );

    // Handle navigation based on notification type
    if (notification.data?.blog) {
      window.location.href = `/blogs/${notification.data.blog}`;
    } else if (notification.data?.user) {
      window.location.href = `/user-details/${notification.data.user}`;
    }
  };

  const handleDismiss = (notificationId) => {
    setVisibleNotifications(prev => 
      prev.filter(n => n.id !== notificationId)
    );
  };

  const handleDismissAll = () => {
    setVisibleNotifications([]);
  };

  const handleCloseToast = () => {
    setToastNotification(null);
  };

  return (
    <>
      {/* Persistent Notification Panel */}
      {visibleNotifications.length > 0 && (
        <Slide direction="left" in={true}>
          <NotificationContainer>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                Live Notifications
              </Typography>
              <Button
                size="small"
                onClick={handleDismissAll}
                sx={{ fontSize: '0.75rem' }}
              >
                Dismiss All
              </Button>
            </Box>

            {visibleNotifications.map((notification, index) => {
              const { icon, color } = getNotificationIcon(notification.type);
              
              return (
                <Fade in={true} key={notification.id} style={{ transitionDelay: `${index * 100}ms` }}>
                  <NotificationItem onClick={() => handleNotificationClick(notification)}>
                    <NotificationIcon sx={{ backgroundColor: color }}>
                      {icon}
                    </NotificationIcon>
                    
                    <Box flex={1}>
                      <Typography variant="body2" fontWeight={600} mb={0.5}>
                        {notification.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" mb={1} display="block">
                        {notification.message}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={notification.type}
                          size="small"
                          sx={{ 
                            backgroundColor: color,
                            color: 'white',
                            fontSize: '0.7rem',
                            height: '20px'
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(new Date(notification.createdAt || Date.now()), { addSuffix: true })}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(notification.id);
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </NotificationItem>
                </Fade>
              );
            })}
          </NotificationContainer>
        </Slide>
      )}

      {/* Toast Notification */}
      <Snackbar
        open={!!toastNotification}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: 8 }}
      >
        {toastNotification && (
          <Alert
            onClose={handleCloseToast}
            severity="info"
            sx={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              '& .MuiAlert-icon': {
                color: getNotificationIcon(toastNotification.type).color,
              },
            }}
            icon={getNotificationIcon(toastNotification.type).icon}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                {toastNotification.title}
              </Typography>
              <Typography variant="body2">
                {toastNotification.message}
              </Typography>
            </Box>
          </Alert>
        )}
      </Snackbar>
    </>
  );
};

export default LiveNotifications;