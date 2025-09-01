import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import socketService from '../services/socketService';
import realtimeService from '../services/realtimeService';

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

  // Initialize real-time features
  useEffect(() => {
    if (user?._id) {
      realtimeService.initialize(user._id);
      setupEventListeners();
      
      return () => {
        realtimeService.cleanup();
      };
    }
  }, [user]);

  // Setup event listeners for real-time updates
  const setupEventListeners = useCallback(() => {
    const socket = socketService.connect();

    // Connection status
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

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

    // Engagement updates
    const handleEngagementUpdate = (data) => {
      if (!blogId || data.blogId === blogId) {
        setRealTimeData(prev => ({
          ...prev,
          recentActivity: [data, ...prev.recentActivity.slice(0, 19)],
          liveStats: {
            ...prev.liveStats,
            [data.action]: prev.liveStats[data.action] + 1
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

    // Collaboration updates
    const handleCollaborationUpdate = (data) => {
      window.dispatchEvent(new CustomEvent('collaboration-update', {
        detail: data
      }));
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
    socket.on('blog-view-updated', handleBlogViewUpdate);
    socket.on('engagement-updated', handleEngagementUpdate);
    socket.on('user-presence-updated', handleUserPresenceUpdate);
    socket.on('user-typing', handleUserTyping);
    socket.on('content-collaboration', handleCollaborationUpdate);
    socket.on('new-notification', handleNewNotification);

    return () => {
      socket.off('blog-view-updated', handleBlogViewUpdate);
      socket.off('engagement-updated', handleEngagementUpdate);
      socket.off('user-presence-updated', handleUserPresenceUpdate);
      socket.off('user-typing', handleUserTyping);
      socket.off('content-collaboration', handleCollaborationUpdate);
      socket.off('new-notification', handleNewNotification);
    };
  }, [blogId]);

  // Track blog view
  const trackView = useCallback(async (targetBlogId, additionalData = {}) => {
    if (!user?._id) return;
    
    try {
      await realtimeService.trackBlogView(targetBlogId || blogId, additionalData);
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }, [user, blogId]);

  // Track engagement
  const trackEngagement = useCallback(async (action, targetBlogId = null, metadata = {}) => {
    if (!user?._id) return;
    
    try {
      await realtimeService.trackEngagement(targetBlogId || blogId, action, metadata);
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
    
    realtimeService.startCollaboration(targetBlogId || blogId);
  }, [user, blogId]);

  // Leave blog collaboration
  const leaveCollaboration = useCallback((targetBlogId) => {
    if (!user?._id) return;
    
    realtimeService.endCollaboration(targetBlogId || blogId);
  }, [user, blogId]);

  // Send content change for collaboration
  const sendContentChange = useCallback((content, operation = 'edit', position = 0) => {
    if (!user?._id || !blogId) return;
    
    realtimeService.sendContentChange(blogId, content, operation, position);
  }, [user, blogId]);

  // Get real-time statistics
  const getRealTimeStats = useCallback(async (targetBlogId) => {
    try {
      return await realtimeService.getRealTimeBlogStats(targetBlogId || blogId);
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
      await realtimeService.sendNotification(recipientId, type, title, message, data);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, []);

  return {
    realTimeData,
    isConnected,
    notifications,
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
  const { trackView, trackEngagement, realTimeData } = useRealTimeFeatures(blogId);
  const [viewStartTime] = useState(Date.now());
  const [scrollDepth, setScrollDepth] = useState(0);
  const hasTrackedView = useRef(false);

  // Track initial view
  useEffect(() => {
    if (blogId && !hasTrackedView.current) {
      trackView(blogId);
      hasTrackedView.current = true;
    }
  }, [blogId, trackView]);

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