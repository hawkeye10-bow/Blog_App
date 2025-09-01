import socketService from './socketService';
import apiService from './apiService';

class RealtimeService {
  constructor() {
    this.activeViewers = new Map();
    this.typingUsers = new Map();
    this.collaborationSessions = new Map();
    this.presenceInterval = null;
    this.viewTrackingInterval = null;
  }

  // Initialize real-time features
  initialize(userId) {
    this.userId = userId;
    this.setupPresenceTracking();
    this.setupViewTracking();
    this.setupCollaborationTracking();
    this.setupNotificationHandlers();
  }

  // Setup user presence tracking
  setupPresenceTracking() {
    if (!this.userId) return;

    // Send presence update every 30 seconds
    this.presenceInterval = setInterval(() => {
      this.updatePresence('active');
    }, 30000);

    // Track user activity
    this.trackUserActivity();

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.updatePresence('away');
      } else {
        this.updatePresence('active');
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.updatePresence('offline');
    });
  }

  // Update user presence
  async updatePresence(status, metadata = {}) {
    try {
      await apiService.post('/api/realtime/presence', {
        userId: this.userId,
        action: status,
        metadata: {
          ...metadata,
          timestamp: new Date(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }

  // Track user activity (mouse, keyboard, scroll)
  trackUserActivity() {
    let activityTimeout;
    
    const resetActivityTimer = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        this.updatePresence('idle');
      }, 5 * 60 * 1000); // 5 minutes of inactivity
    };

    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetActivityTimer, true);
    });

    resetActivityTimer();
  }

  // Setup view tracking for blogs
  setupViewTracking() {
    this.viewStartTime = Date.now();
    this.maxScrollDepth = 0;

    // Track scroll depth
    const trackScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollDepth = Math.round((scrollTop + windowHeight) / documentHeight * 100);
      
      this.maxScrollDepth = Math.max(this.maxScrollDepth, scrollDepth);
    };

    window.addEventListener('scroll', trackScroll);

    // Track time on page
    this.viewTrackingInterval = setInterval(() => {
      this.trackPageView();
    }, 10000); // Track every 10 seconds
  }

  // Track blog view with detailed analytics
  async trackBlogView(blogId, additionalData = {}) {
    try {
      const timeOnPage = Math.round((Date.now() - this.viewStartTime) / 1000);
      
      await apiService.post(`/api/realtime/blog/${blogId}/view`, {
        userId: this.userId,
        sessionId: this.generateSessionId(),
        timeOnPage,
        scrollDepth: this.maxScrollDepth,
        ...additionalData
      });
    } catch (error) {
      console.error('Error tracking blog view:', error);
    }
  }

  // Track engagement actions
  async trackEngagement(blogId, action, metadata = {}) {
    try {
      await apiService.post(`/api/realtime/blog/${blogId}/engage`, {
        userId: this.userId,
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
  }

  // Setup real-time collaboration
  setupCollaborationTracking() {
    const socket = socketService.connect();

    // Listen for collaboration events
    socket.on('content-collaboration', (data) => {
      this.handleCollaborationUpdate(data);
    });

    socket.on('user-joined-collaboration', (data) => {
      this.collaborationSessions.set(data.userId, {
        userName: data.userName,
        joinedAt: data.timestamp,
        isActive: true
      });
      this.notifyCollaborationChange('user-joined', data);
    });

    socket.on('user-left-collaboration', (data) => {
      this.collaborationSessions.delete(data.userId);
      this.notifyCollaborationChange('user-left', data);
    });
  }

  // Handle collaboration content updates
  handleCollaborationUpdate(data) {
    if (data.userId === this.userId) return; // Ignore own changes

    // Emit custom event for components to handle
    window.dispatchEvent(new CustomEvent('collaboration-update', {
      detail: data
    }));
  }

  // Notify collaboration changes
  notifyCollaborationChange(type, data) {
    window.dispatchEvent(new CustomEvent('collaboration-change', {
      detail: { type, data }
    }));
  }

  // Start collaboration session
  startCollaboration(blogId) {
    const socket = socketService.connect();
    socket.emit('join-blog-collaboration', blogId);
    
    this.currentCollaborationBlog = blogId;
  }

  // End collaboration session
  endCollaboration(blogId) {
    const socket = socketService.connect();
    socket.emit('leave-blog-collaboration', blogId);
    
    this.currentCollaborationBlog = null;
  }

  // Send collaboration content change
  sendContentChange(blogId, content, operation, position) {
    if (!this.currentCollaborationBlog) return;

    apiService.post(`/api/realtime/blog/${blogId}/collaborate`, {
      userId: this.userId,
      content,
      operation,
      position
    });
  }

  // Setup notification handlers
  setupNotificationHandlers() {
    const socket = socketService.connect();

    socket.on('new-notification', (notification) => {
      this.handleNewNotification(notification);
    });

    socket.on('blog-view-updated', (data) => {
      this.handleBlogViewUpdate(data);
    });

    socket.on('engagement-updated', (data) => {
      this.handleEngagementUpdate(data);
    });

    socket.on('analytics-updated', (data) => {
      this.handleAnalyticsUpdate(data);
    });
  }

  // Handle new notification
  handleNewNotification(notification) {
    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.type,
        data: notification.data
      });
    }

    // Emit custom event for UI components
    window.dispatchEvent(new CustomEvent('realtime-notification', {
      detail: notification
    }));
  }

  // Handle blog view updates
  handleBlogViewUpdate(data) {
    window.dispatchEvent(new CustomEvent('blog-view-update', {
      detail: data
    }));
  }

  // Handle engagement updates
  handleEngagementUpdate(data) {
    window.dispatchEvent(new CustomEvent('engagement-update', {
      detail: data
    }));
  }

  // Handle analytics updates
  handleAnalyticsUpdate(data) {
    window.dispatchEvent(new CustomEvent('analytics-update', {
      detail: data
    }));
  }

  // Get real-time blog statistics
  async getRealTimeBlogStats(blogId) {
    try {
      const response = await apiService.get(`/api/realtime/blog/${blogId}/stats`);
      return response.data.stats;
    } catch (error) {
      console.error('Error getting real-time blog stats:', error);
      return null;
    }
  }

  // Get trending content
  async getTrendingContent(timeframe = '24h') {
    try {
      const response = await apiService.get(`/api/realtime/trending?timeframe=${timeframe}`);
      return response.data.trendingBlogs;
    } catch (error) {
      console.error('Error getting trending content:', error);
      return [];
    }
  }

  // Perform real-time search
  async performSearch(query, filters = {}) {
    try {
      const response = await apiService.post('/api/realtime/search', {
        query,
        filters
      });
      return response.data.results;
    } catch (error) {
      console.error('Error performing search:', error);
      return [];
    }
  }

  // Get real-time content feed
  async getContentFeed(lastTimestamp = null, limit = 10) {
    try {
      const params = new URLSearchParams({ limit });
      if (lastTimestamp) params.append('lastTimestamp', lastTimestamp);
      
      const response = await apiService.get(`/api/realtime/user/${this.userId}/activity?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error getting content feed:', error);
      return { blogs: [], hasMore: false };
    }
  }

  // Send real-time notification
  async sendNotification(recipientId, type, title, message, data = {}) {
    try {
      await apiService.post('/api/realtime/notification', {
        recipientId,
        type,
        title,
        message,
        data
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Generate session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get active viewers for a blog
  getActiveViewers(blogId) {
    return this.activeViewers.get(blogId) || [];
  }

  // Get typing users
  getTypingUsers() {
    return Array.from(this.typingUsers.values());
  }

  // Get collaboration sessions
  getCollaborationSessions() {
    return Array.from(this.collaborationSessions.values());
  }

  // Cleanup
  cleanup() {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
    }
    if (this.viewTrackingInterval) {
      clearInterval(this.viewTrackingInterval);
    }
    
    // Update status to offline
    if (this.userId) {
      this.updatePresence('offline');
    }
  }
}

// Create singleton instance
const realtimeService = new RealtimeService();

export default realtimeService;