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

  // Initialize real-time features with enhanced tracking
  useEffect(() => {
    if (user?._id) {
      // Set current user in socket service
      socketService.setCurrentUser(user._id, user.name);
      
      // Join user room for personal notifications
      socketService.joinUserRoom(user._id);
      
      setupEventListeners();
      
      return () => {
        cleanup();
      };
    }
  }, [user]);

  // Join blog-specific rooms when blogId changes
  useEffect(() => {
    if (blogId && user?._id) {
      socketService.joinBlogRoom(blogId, user._id);
      socketService.joinAnalyticsRoom(blogId);
      
      return () => {
        socketService.leaveBlogRoom(blogId, user._id);
        socketService.leaveAnalyticsRoom(blogId);
      };
    }
  }, [blogId, user?._id]);

  // Setup event listeners for real-time updates
  const setupEventListeners = useCallback(() => {
    const socket = socketService.connect();

    // Connection status
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Blog view updates
    const handleBlogViewUpdate = (data) => {
      console.log('👁️ Real-time: Blog view update received:', data);
      if (data.blogId === blogId) {
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
      console.log('📊 Real-time: Engagement update received:', data);
      if (data.blogId === blogId) {
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
      console.log('👤 Real-time: User presence update:', data);
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
      console.log('⌨️ Real-time: User typing:', data);
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
      console.log('🤝 Real-time: Collaboration update:', data);
      window.dispatchEvent(new CustomEvent('collaboration-update', {
        detail: data
      }));
    };

    // New notifications
    const handleNewNotification = (notification) => {
      console.log('🔔 Real-time: New notification:', notification);
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
    socketService.addEventListener('blog-view-updated', handleBlogViewUpdate);
    socketService.addEventListener('engagement-updated', handleEngagementUpdate);
    socketService.addEventListener('user-presence-updated', handleUserPresenceUpdate);
    socketService.addEventListener('user-typing', handleUserTyping);
    socketService.addEventListener('content-collaboration', handleCollaborationUpdate);
    socketService.addEventListener('new-notification', handleNewNotification);
    socketService.addEventListener('viewer-joined', handleBlogViewUpdate);
    socketService.addEventListener('viewer-left', handleBlogViewUpdate);
    socketService.addEventListener('analytics-updated', handleEngagementUpdate);

    return () => {
      socketService.removeEventListener('blog-view-updated', handleBlogViewUpdate);
      socketService.removeEventListener('engagement-updated', handleEngagementUpdate);
      socketService.removeEventListener('user-presence-updated', handleUserPresenceUpdate);
      socketService.removeEventListener('user-typing', handleUserTyping);
      socketService.removeEventListener('content-collaboration', handleCollaborationUpdate);
      socketService.removeEventListener('new-notification', handleNewNotification);
      socketService.removeEventListener('viewer-joined', handleBlogViewUpdate);
      socketService.removeEventListener('viewer-left', handleBlogViewUpdate);
      socketService.removeEventListener('analytics-updated', handleEngagementUpdate);
    };
  }, [blogId]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (user?._id) {
      socketService.leaveUserRoom(user._id);
    }
    if (blogId && user?._id) {
      socketService.leaveBlogRoom(blogId, user._id);
      socketService.leaveAnalyticsRoom(blogId);
    }
    socketService.removeAllListeners();
  }, [user?._id, blogId]);

  // Track blog view
  const trackView = useCallback(async (targetBlogId, additionalData = {}) => {
    if (!user?._id) return;
    
    try {
      const viewData = {
        timeOnPage: additionalData.timeOnPage || 0,
        scrollDepth: additionalData.scrollDepth || 0,
        referrer: document.referrer,
        ...additionalData
      };
      
      // Track via API
      await apiService.post(`/api/analytics/track/pageview/${targetBlogId || blogId}`, viewData);
      
      // Track via socket for real-time updates
      socketService.trackDetailedView(targetBlogId || blogId, viewData);
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }, [user, blogId]);

  // Track engagement
  const trackEngagement = useCallback(async (action, targetBlogId = null, metadata = {}) => {
    if (!user?._id) return;
    
    try {
      const engagementData = {
        action,
        metadata: {
          ...metadata,
          timestamp: new Date(),
          url: window.location.href
        }
      };
      
      // Track via API
      await apiService.post(`/api/analytics/track/engagement/${targetBlogId || blogId}`, engagementData);
      
      // Track via socket for real-time updates
      socketService.trackEngagement(targetBlogId || blogId, action, metadata);
    } catch (error) {
      console.error('Error tracking engagement:', error);
    }
  }, [user, blogId]);

  // Start typing indicator
  const startTyping = useCallback((action = 'typing') => {
    if (!user?._id) return;
    
    console.log(`⌨️ Starting typing indicator: ${action}`);
    socketService.emitUserTyping(user._id, user.name, action);
  }, [user]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!user?._id) return;
    
    console.log(`⌨️ Stopping typing indicator`);
    socketService.emitUserStoppedTyping(user._id);
  }, [user]);

  // Join blog collaboration
  const joinCollaboration = useCallback((targetBlogId) => {
    if (!user?._id) return;
    
    console.log(`🤝 Joining collaboration for blog: ${targetBlogId || blogId}`);
    socketService.joinCollaboration(targetBlogId || blogId, user._id, user.name);
  }, [user, blogId]);

  // Leave blog collaboration
  const leaveCollaboration = useCallback((targetBlogId) => {
    if (!user?._id) return;
    
    console.log(`🤝 Leaving collaboration for blog: ${targetBlogId || blogId}`);
    socketService.leaveCollaboration(targetBlogId || blogId, user._id, user.name);
  }, [user, blogId]);

  // Send content change for collaboration
  const sendContentChange = useCallback((content, operation = 'edit', position = 0) => {
    if (!user?._id || !blogId) return;
    
    console.log(`📝 Sending content change: ${operation}`);
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
      await apiService.post('/api/realtime/notification', {
        recipientId,
        type,
        title,
        message,
        data
      });
      
      // Also emit via socket for immediate delivery
      socketService.sendNotification(recipientId, type, title, message, user._id, data.blogId);
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
  const [timeOnPage, setTimeOnPage] = useState(0);
  const [interactions, setInteractions] = useState([]);
  const hasTrackedView = useRef(false);
  const viewTrackingInterval = useRef(null);

  // Track initial view
  useEffect(() => {
    if (blogId && !hasTrackedView.current) {
      console.log(`👁️ Tracking initial view for blog: ${blogId}`);
      trackView(blogId, {
        viewType: 'initial',
        timestamp: new Date()
      });
      hasTrackedView.current = true;
      
      // Start time tracking
      viewTrackingInterval.current = setInterval(() => {
        setTimeOnPage(Math.round((Date.now() - viewStartTime) / 1000));
      }, 1000);
    }
    
    return () => {
      if (viewTrackingInterval.current) {
        clearInterval(viewTrackingInterval.current);
      }
    };
  }, [blogId, trackView]);

  // Track scroll depth and user interactions
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const currentScrollDepth = Math.round((scrollTop + windowHeight) / documentHeight * 100);
      
      setScrollDepth(prev => Math.max(prev, currentScrollDepth));
    };

    const handleClick = (e) => {
      setInteractions(prev => [...prev, {
        type: 'click',
        x: e.clientX,
        y: e.clientY,
        target: e.target.tagName,
        timestamp: Date.now()
      }]);
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('click', handleClick);
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track view completion on unmount
  useEffect(() => {
    return () => {
      if (blogId && hasTrackedView.current) {
        const finalTimeOnPage = Math.round((Date.now() - viewStartTime) / 1000);
        
        console.log(`👁️ Tracking view completion for blog: ${blogId}`);
        console.log(`⏱️ Time on page: ${finalTimeOnPage}s, Scroll depth: ${scrollDepth}%`);
        
        // Track final view data
        trackView(blogId, {
          timeOnPage: finalTimeOnPage,
          scrollDepth,
          completed: true,
          interactions: interactions.length,
          viewType: 'exit'
        });
      }
    };
  }, [blogId, trackView, viewStartTime, scrollDepth, interactions]);

  return {
    currentViewers: realTimeData.currentViewers,
    liveStats: realTimeData.liveStats,
    timeOnPage,
    scrollDepth,
    interactions: interactions.length,
    trackEngagement: (action, metadata) => trackEngagement(action, blogId, metadata)
  };
};

export const useRealTimeCollaboration = (blogId) => {
  const { joinCollaboration, leaveCollaboration, sendContentChange, realTimeData } = useRealTimeFeatures(blogId);
  const [collaborators, setCollaborators] = useState([]);
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [contentConflicts, setContentConflicts] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());

  useEffect(() => {
    if (blogId) {
      console.log(`🤝 Starting collaboration for blog: ${blogId}`);
      joinCollaboration(blogId);
      setIsCollaborating(true);

      // Listen for collaboration events
      const handleCollaborationUpdate = (event) => {
        const { detail } = event;
        if (detail.blogId === blogId) {
          console.log(`🤝 Collaboration update received:`, detail);
          // Handle content updates from other collaborators
          window.dispatchEvent(new CustomEvent('content-sync', {
            detail: detail
          }));
        }
      };

      const handleCollaborationChange = (event) => {
        const { detail } = event;
        console.log(`🤝 Collaboration change:`, detail);
        if (detail.type === 'user-joined') {
          setCollaborators(prev => [...prev, detail.data]);
        } else if (detail.type === 'user-left') {
          setCollaborators(prev => prev.filter(c => c.userId !== detail.data.userId));
        }
      };

      window.addEventListener('collaboration-update', handleCollaborationUpdate);
      window.addEventListener('collaboration-change', handleCollaborationChange);

      return () => {
        console.log(`🤝 Ending collaboration for blog: ${blogId}`);
        leaveCollaboration(blogId);
        setIsCollaborating(false);
        window.removeEventListener('collaboration-update', handleCollaborationUpdate);
        window.removeEventListener('collaboration-change', handleCollaborationChange);
      };
    }
  }, [blogId, joinCollaboration, leaveCollaboration]);

  const handleContentChange = useCallback((content, operation = 'edit', position = 0) => {
    if (isCollaborating) {
      console.log(`📝 Handling content change: ${operation} at position ${position}`);
      sendContentChange(content, operation, position);
      setLastSyncTime(Date.now());
    }
  }, [isCollaborating, sendContentChange]);

  // Detect and handle content conflicts
  const handleContentConflict = useCallback((incomingContent, localContent) => {
    if (incomingContent !== localContent) {
      const conflict = {
        id: Date.now(),
        incomingContent,
        localContent,
        timestamp: new Date()
      };
      
      setContentConflicts(prev => [...prev, conflict]);
      console.warn(`⚠️ Content conflict detected:`, conflict);
    }
  }, []);

  // Resolve content conflict
  const resolveConflict = useCallback((conflictId, resolution) => {
    setContentConflicts(prev => prev.filter(c => c.id !== conflictId));
    console.log(`✅ Content conflict resolved: ${resolution}`);
  }, []);

  return {
    collaborators,
    isCollaborating,
    typingUsers: realTimeData.typingUsers,
    contentConflicts,
    lastSyncTime,
    handleContentChange,
    handleContentConflict,
    resolveConflict
  };
};

export const useRealTimeNotifications = () => {
  const { notifications, markNotificationsAsRead, sendNotification } = useRealTimeFeatures();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
    
    // Update page title with unread count
    if (unread > 0) {
      document.title = `(${unread}) BLOGGY - Real-time Blogging Platform`;
    } else {
      document.title = 'BLOGGY - Real-time Blogging Platform';
    }
  }, [notifications]);

  // Listen for real-time notifications
  useEffect(() => {
    const handleRealtimeNotification = (event) => {
      const notification = event.detail;
      // Handle notification display logic here
      console.log(`🔔 Real-time notification received:`, notification);
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
    sendNotification,
    clearAll: () => setNotifications([])
  };
};

// Enhanced hook for real-time content feed
export const useRealTimeContentFeed = (userId, limit = 10) => {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState(null);
  const [newContentCount, setNewContentCount] = useState(0);

  // Load initial feed
  useEffect(() => {
    loadFeedItems(true);
    setupFeedListeners();
    
    return () => {
      socketService.removeAllListeners();
    };
  }, [userId]);

  const loadFeedItems = async (isInitial = false) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(lastTimestamp && !isInitial && { lastTimestamp })
      });
      
      const response = await apiService.get(`/api/realtime/user/${userId}/activity?${params}`);
      const { blogs, hasMore: moreAvailable } = response.data;
      
      if (isInitial) {
        setFeedItems(blogs);
        setNewContentCount(0);
      } else {
        setFeedItems(prev => [...prev, ...blogs]);
      }
      
      setHasMore(moreAvailable);
      
      if (blogs.length > 0) {
        setLastTimestamp(blogs[blogs.length - 1].createdAt);
      }
    } catch (error) {
      console.error('Error loading feed items:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupFeedListeners = () => {
    // Listen for new blog posts
    socketService.onNewBlog((data) => {
      console.log(`📰 New blog in feed:`, data);
      setNewContentCount(prev => prev + 1);
    });

    // Listen for blog updates
    socketService.onBlogUpdated((data) => {
      console.log(`📝 Blog updated in feed:`, data);
      setFeedItems(prev => prev.map(item => 
        item._id === data.blog._id ? { ...item, ...data.blog } : item
      ));
    });

    // Listen for blog deletions
    socketService.onBlogDeleted((data) => {
      console.log(`🗑️ Blog deleted from feed:`, data);
      setFeedItems(prev => prev.filter(item => item._id !== data.blogId));
    });
  };

  const loadNewContent = () => {
    loadFeedItems(true);
  };

  return {
    feedItems,
    loading,
    hasMore,
    newContentCount,
    loadFeedItems,
    loadNewContent
  };
};