import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import socketService from '../services/socketService';
import apiService from '../services/apiService';

export const useRealTimeFeatures = (blogId = null) => {
  const user = useSelector(state => state.user);
  const [realTimeData, setRealTimeData] = useState({
    currentViewers: 0,
    activeUsers: [],
    typingUsers: [],
    recentActivity: [],
    liveStats: {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0
    }
  });
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [isCollaborating, setIsCollaborating] = useState(false);

  // Initialize real-time features
  useEffect(() => {
    if (user?._id) {
      socketService.setCurrentUser(user._id, user.name);
      setupEventListeners();
      
      return () => {
        socketService.disconnect();
      };
    }
  }, [user]);

  // Join blog room when blogId changes
  useEffect(() => {
    if (blogId && user?._id) {
      socketService.joinBlogRoom(blogId, user._id);
      
      return () => {
        socketService.leaveBlogRoom(blogId, user._id);
      };
    }
  }, [blogId, user]);

  // Setup event listeners for real-time updates
  const setupEventListeners = useCallback(() => {
    const socket = socketService.connect();

    // Connection status
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Heartbeat acknowledgment
    socket.on('heartbeat-ack', (data) => {
      // Connection is alive
    });

    // Blog view updates
    const handleBlogViewUpdate = (data) => {
      if (!blogId || data.blogId === blogId) {
        setRealTimeData(prev => ({
          ...prev,
          currentViewers: data.currentViewers,
          liveStats: {
            ...prev.liveStats,
            views: data.views
          }
        }));
      }
    };

    // Viewer joined/left
    const handleViewerJoined = (data) => {
      if (data.blogId === blogId) {
        setRealTimeData(prev => ({
          ...prev,
          currentViewers: data.viewerCount
        }));
      }
    };

    const handleViewerLeft = (data) => {
      if (data.blogId === blogId) {
        setRealTimeData(prev => ({
          ...prev,
          currentViewers: data.viewerCount
        }));
      }
    };

    // Engagement updates
    const handleEngagementUpdate = (data) => {
      if (!blogId || data.blogId === blogId) {
        setRealTimeData(prev => ({
          ...prev,
          recentActivity: [data, ...prev.recentActivity.slice(0, 19)],
          liveStats: {
            ...prev.liveStats,
            [data.action]: (prev.liveStats[data.action] || 0) + 1
          }
        }));
      }
    };

    // Blog like updates
    const handleBlogLikeUpdate = (data) => {
      if (data.blogId === blogId) {
        setRealTimeData(prev => ({
          ...prev,
          liveStats: {
            ...prev.liveStats,
            likes: data.likeCount
          }
        }));
      }
    };

    // Blog share updates
    const handleBlogShare = (data) => {
      if (data.blogId === blogId) {
        setRealTimeData(prev => ({
          ...prev,
          liveStats: {
            ...prev.liveStats,
            shares: data.shareCount
          }
        }));
      }
    };

    // User presence updates
    const handleUserPresenceUpdate = (data) => {
      setRealTimeData(prev => ({
        ...prev,
        activeUsers: prev.activeUsers.map(user => 
          user.userId === data.userId 
            ? { ...user, ...data }
            : user
        )
      }));
    };

    // Typing indicators
    const handleUserTyping = (data) => {
      setRealTimeData(prev => ({
        ...prev,
        typingUsers: [
          ...prev.typingUsers.filter(u => u.userId !== data.userId),
          data
        ]
      }));

      // Auto-remove after 3 seconds
      setTimeout(() => {
        setRealTimeData(prev => ({
          ...prev,
          typingUsers: prev.typingUsers.filter(u => u.userId !== data.userId)
        }));
      }, 3000);
    };

    const handleUserStoppedTyping = (data) => {
      setRealTimeData(prev => ({
        ...prev,
        typingUsers: prev.typingUsers.filter(u => u.userId !== data.userId)
      }));
    };

    // Collaboration updates
    const handleCollaboratorJoined = (data) => {
      if (data.blogId === blogId) {
        setCollaborators(prev => [
          ...prev.filter(c => c.userId !== data.userId),
          { userId: data.userId, userName: data.userName, joinedAt: data.timestamp }
        ]);
      }
    };

    const handleCollaboratorLeft = (data) => {
      if (data.blogId === blogId) {
        setCollaborators(prev => prev.filter(c => c.userId !== data.userId));
      }
    };

    const handleCollaborationUpdate = (data) => {
      if (data.blogId === blogId) {
        window.dispatchEvent(new CustomEvent('collaboration-update', {
          detail: data
        }));
      }
    };

    // New notifications
    const handleNewNotification = (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }
    };

    // Register event listeners
    socketService.onViewerJoined(handleViewerJoined);
    socketService.onViewerLeft(handleViewerLeft);
    socketService.onBlogLikeUpdated(handleBlogLikeUpdate);
    socketService.onBlogShared(handleBlogShare);
    socket.on('engagement-updated', handleEngagementUpdate);
    socket.on('user-presence-updated', handleUserPresenceUpdate);
    socketService.onUserTyping(handleUserTyping);
    socketService.onUserStoppedTyping(handleUserStoppedTyping);
    socketService.onCollaboratorJoined(handleCollaboratorJoined);
    socketService.onCollaboratorLeft(handleCollaboratorLeft);
    socketService.onCollaborationUpdate(handleCollaborationUpdate);
    socketService.onNewNotification(handleNewNotification);

    return () => {
      socket.off('engagement-updated', handleEngagementUpdate);
      socket.off('user-presence-updated', handleUserPresenceUpdate);
    };
  }, [blogId]);

  // Track blog view
  const trackView = useCallback(async (targetBlogId, additionalData = {}) => {
    if (!user?._id) return;
    
    try {
      const viewData = {
        userId: user._id,
        ...additionalData
      };
      
      await apiService.post(`/api/realtime/blog/${targetBlogId || blogId}/view`, viewData);
      
      // Also emit via socket for immediate feedback
      socketService.trackPageView(
        targetBlogId || blogId,
        user._id,
        additionalData.duration || 0,
        additionalData.scrollDepth || 0,
        additionalData.referrer || document.referrer
      );
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }, [user, blogId]);

  // Track engagement
  const trackEngagement = useCallback(async (action, targetBlogId = null, metadata = {}) => {
    if (!user?._id) return;
    
    try {
      await apiService.post(`/api/realtime/blog/${targetBlogId || blogId}/engage`, {
        userId: user._id,
        action,
        metadata: {
          ...metadata,
          timestamp: new Date(),
          url: window.location.href
        }
      });
    } catch (error) {
      console.error('Error tracking engagement:', error);
    }
  }, [user, blogId]);

  // Start typing indicator
  const startTyping = useCallback((action = 'typing') => {
    if (!user?._id) return;
    
    socketService.emitUserTyping(user._id, user.name, action);
  }, [user]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!user?._id) return;
    
    socketService.emitUserStoppedTyping(user._id);
  }, [user]);

  // Join blog collaboration
  const joinCollaboration = useCallback((targetBlogId) => {
    if (!user?._id) return;
    
    socketService.joinCollaboration(targetBlogId || blogId, user._id, user.name);
    setIsCollaborating(true);
  }, [user, blogId]);

  // Leave blog collaboration
  const leaveCollaboration = useCallback((targetBlogId) => {
    if (!user?._id) return;
    
    socketService.leaveCollaboration(targetBlogId || blogId, user._id, user.name);
    setIsCollaborating(false);
  }, [user, blogId]);

  // Send content change for collaboration
  const sendContentChange = useCallback((content, operation = 'edit', position = 0) => {
    if (!user?._id || !blogId) return;
    
    socketService.emitContentChange(blogId, user._id, user.name, content, operation, position);
  }, [user, blogId]);

  // Get real-time statistics
  const getRealTimeStats = useCallback(async (targetBlogId) => {
    try {
      const response = await apiService.get(`/api/realtime/blog/${targetBlogId || blogId}/stats`);
      return response.data.stats;
    } catch (error) {
      console.error('Error getting real-time stats:', error);
      return null;
    }
  }, [blogId]);

  // Mark notifications as read
  const markNotificationsAsRead = useCallback((notificationIds = null) => {
    if (notificationIds) {
      setNotifications(prev => 
        prev.map(notification => 
          notificationIds.includes(notification.id) 
            ? { ...notification, read: true }
            : notification
        )
      );
    } else {
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
    }
  }, []);

  // Send notification
  const sendNotification = useCallback(async (recipientId, type, title, message, data = {}) => {
    try {
      socketService.sendNotification(recipientId, type, title, message, user._id, data.blogId);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, []);

  return {
    realTimeData,
    isConnected,
    notifications,
    collaborators,
    isCollaborating,
    trackView,
    trackEngagement,
    startTyping,
    stopTyping,
    joinCollaboration,
    leaveCollaboration,
    sendContentChange,
    getRealTimeStats,
    markNotificationsAsRead,
    sendNotification
  };
};

export const useRealTimeBlogView = (blogId) => {
  const { trackView, trackEngagement, realTimeData, isConnected } = useRealTimeFeatures(blogId);
  const [viewStartTime] = useState(Date.now());
  const [scrollDepth, setScrollDepth] = useState(0);
  const hasTrackedView = useRef(false);
  const user = useSelector(state => state.user);

  // Track initial view
  useEffect(() => {
    if (blogId && user?._id && !hasTrackedView.current) {
      trackView(blogId);
      hasTrackedView.current = true;
    }
  }, [blogId, user, trackView]);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const currentScrollDepth = Math.round((scrollTop + windowHeight) / documentHeight * 100);
      
      setScrollDepth(prev => Math.max(prev, currentScrollDepth));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track view completion on unmount
  useEffect(() => {
    return () => {
      if (blogId && hasTrackedView.current) {
        const timeOnPage = Math.round((Date.now() - viewStartTime) / 1000);
        trackView(blogId, {
          timeOnPage,
          scrollDepth,
          completed: true
        });
      }
    };
  }, [blogId, trackView, viewStartTime, scrollDepth]);

  return {
    currentViewers: realTimeData.currentViewers,
    liveStats: realTimeData.liveStats,
    trackEngagement: (action, metadata) => trackEngagement(action, blogId, metadata)
  };
};

export const useRealTimeCollaboration = (blogId) => {
  const { joinCollaboration, leaveCollaboration, sendContentChange, realTimeData } = useRealTimeFeatures(blogId);
  const [collaborators, setCollaborators] = useState([]);
  const [isCollaborating, setIsCollaborating] = useState(false);

  useEffect(() => {
    if (blogId) {
      joinCollaboration(blogId);
      setIsCollaborating(true);

      // Listen for collaboration events
      const handleCollaborationUpdate = (event) => {
        const { detail } = event;
        if (detail.blogId === blogId) {
          // Handle content updates from other collaborators
          window.dispatchEvent(new CustomEvent('content-sync', {
            detail: detail
          }));
        }
      };

      const handleCollaborationChange = (event) => {
        const { detail } = event;
        if (detail.type === 'user-joined') {
          setCollaborators(prev => [...prev, detail.data]);
        } else if (detail.type === 'user-left') {
          setCollaborators(prev => prev.filter(c => c.userId !== detail.data.userId));
        }
      };

      window.addEventListener('collaboration-update', handleCollaborationUpdate);
      window.addEventListener('collaboration-change', handleCollaborationChange);

      return () => {
        leaveCollaboration(blogId);
        setIsCollaborating(false);
        window.removeEventListener('collaboration-update', handleCollaborationUpdate);
        window.removeEventListener('collaboration-change', handleCollaborationChange);
      };
    }
  }, [blogId, joinCollaboration, leaveCollaboration]);

  const handleContentChange = useCallback((content, operation = 'edit', position = 0) => {
    if (isCollaborating) {
      sendContentChange(content, operation, position);
    }
  }, [isCollaborating, sendContentChange]);

  return {
    collaborators,
    isCollaborating,
    typingUsers: realTimeData.typingUsers,
    handleContentChange
  };
};

export const useRealTimeNotifications = () => {
  const { notifications, markNotificationsAsRead, sendNotification } = useRealTimeFeatures();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  // Listen for real-time notifications
  useEffect(() => {
    const handleRealtimeNotification = (event) => {
      const notification = event.detail;
      // Handle notification display logic here
    };

    window.addEventListener('realtime-notification', handleRealtimeNotification);
    
    return () => {
      window.removeEventListener('realtime-notification', handleRealtimeNotification);
    };
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead: markNotificationsAsRead,
    sendNotification
  };
};