import { io } from 'socket.io-client';
import { serverURL } from '../helper/Helper';
import { useState } from 'react';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.heartbeatInterval = null;
    this.currentUser = null;
  }

  connect() {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    this.socket = io(serverURL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Initialize user connection
      const userId = localStorage.getItem('userId');
      const userName = localStorage.getItem('userName') || 'Anonymous';
      if (userId) {
        this.currentUser = { userId, userName };
        this.socket.emit('user-connected', { userId, userName });
        this.startHeartbeat();
      }
      
      // Join blogs room for real-time updates
      this.socket.emit('join-blogs-room');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
      
      this.stopHeartbeat();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.isConnected = false;
      this.handleReconnect();
    });

    return this.socket;
  }

  // Start heartbeat to keep connection alive
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected && this.currentUser) {
        this.socket.emit('heartbeat', {
          userId: this.currentUser.userId,
          timestamp: new Date()
        });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Set current user
  setCurrentUser(userId, userName) {
    this.currentUser = { userId, userName };
    if (this.socket && this.isConnected) {
      this.socket.emit('user-connected', { userId, userName });
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.socket) {
      // Notify server of intentional disconnect
      if (this.currentUser) {
        this.socket.emit('user-offline', this.currentUser.userId);
      }
      
      this.stopHeartbeat();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentUser = null;
    }
  }

  // Blog room management
  joinBlogRoom(blogId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-blog-room', { blogId, userId });
    }
  }

  leaveBlogRoom(blogId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-blog-room', { blogId, userId });
    }
  }

  // Real-time blog interactions
  emitBlogLike(blogId, userId, isLiked) {
    if (this.socket && this.isConnected) {
      this.socket.emit('blog-liked', { blogId, userId, isLiked });
    }
  }

  emitBlogShare(blogId, userId, platform) {
    if (this.socket && this.isConnected) {
      this.socket.emit('blog-shared', { blogId, userId, platform });
    }
  }

  emitComment(blogId, userId, content, parentCommentId = null) {
    if (this.socket && this.isConnected) {
      this.socket.emit('comment-added', { 
        blogId, 
        userId, 
        content, 
        parentCommentId 
      });
    }
  }

  // Real-time collaboration
  joinCollaboration(blogId, userId, userName) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-collaboration', { blogId, userId, userName });
    }
  }

  leaveCollaboration(blogId, userId, userName) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-collaboration', { blogId, userId, userName });
    }
  }

  emitContentChange(blogId, userId, userName, content, operation, position) {
    if (this.socket && this.isConnected) {
      this.socket.emit('collaboration-content-change', {
        blogId,
        userId,
        userName,
        content,
        operation,
        position
      });
    }
  }

  // Real-time analytics
  trackPageView(blogId, userId, duration, scrollDepth, referrer) {
    if (this.socket && this.isConnected) {
      this.socket.emit('track-page-view', {
        blogId,
        userId,
        duration,
        scrollDepth,
        referrer
      });
    }
  }

  // Real-time search
  performLiveSearch(query, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('live-search', { query, userId });
    }
  }

  onSearchResults(callback) {
    if (this.socket) {
      this.socket.on('search-results', callback);
    }
  }

  // Real-time notifications
  sendNotification(recipientId, type, title, message, senderId, blogId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('send-notification', {
        recipientId,
        type,
        title,
        message,
        senderId,
        blogId
      });
    }
  }

  // Blog-related events
  onNewBlog(callback) {
    if (this.socket) {
      this.socket.on('new-blog', callback);
    }
  }

  onBlogUpdated(callback) {
    if (this.socket) {
      this.socket.on('blog-updated', callback);
    }
  }

  onBlogDeleted(callback) {
    if (this.socket) {
      this.socket.on('blog-deleted', callback);
    }
  }

  onBlogLikeUpdated(callback) {
    if (this.socket) {
      this.socket.on('blog-like-updated', callback);
    }
  }

  onBlogShared(callback) {
    if (this.socket) {
      this.socket.on('blog-shared', callback);
    }
  }

  onViewerJoined(callback) {
    if (this.socket) {
      this.socket.on('viewer-joined', callback);
    }
  }

  onViewerLeft(callback) {
    if (this.socket) {
      this.socket.on('viewer-left', callback);
    }
  }

  onNewComment(callback) {
    if (this.socket) {
      this.socket.on('new-comment', callback);
    }
  }

  onBlogLikeUpdated(callback) {
    if (this.socket) {
      this.socket.on('blog-like-updated', callback);
    }
  }

  // Collaboration events
  onCollaboratorJoined(callback) {
    if (this.socket) {
      this.socket.on('collaborator-joined', callback);
    }
  }

  onCollaboratorLeft(callback) {
    if (this.socket) {
      this.socket.on('collaborator-left', callback);
    }
  }

  onCollaborationUpdate(callback) {
    if (this.socket) {
      this.socket.on('collaboration-update', callback);
    }
  }

  onContentUpdated(callback) {
    if (this.socket) {
      this.socket.on('content-updated', callback);
    }
  }

  // Chat-related events
  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('new-message', callback);
    }
  }

  onMessageEdited(callback) {
    if (this.socket) {
      this.socket.on('message-edited', callback);
    }
  }

  onMessageDeleted(callback) {
    if (this.socket) {
      this.socket.on('message-deleted', callback);
    }
  }

  onNewChat(callback) {
    if (this.socket) {
      this.socket.on('new-chat', callback);
    }
  }

  onMessagesRead(callback) {
    if (this.socket) {
      this.socket.on('messages-read', callback);
    }
  }

  onReactionAdded(callback) {
    if (this.socket) {
      this.socket.on('reaction-added', callback);
    }
  }

  onReactionRemoved(callback) {
    if (this.socket) {
      this.socket.on('reaction-removed', callback);
    }
  }

  // Chat typing indicators
  emitChatTyping(chatId, userId, userName) {
    if (this.socket && this.isConnected) {
      this.socket.emit('chat-typing', { chatId, userId, userName });
    }
  }

  emitChatStoppedTyping(chatId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('chat-stopped-typing', { chatId, userId });
    }
  }

  onUserTypingChat(callback) {
    if (this.socket) {
      this.socket.on('user-typing-chat', callback);
    }
  }

  onUserStoppedTypingChat(callback) {
    if (this.socket) {
      this.socket.on('user-stopped-typing-chat', callback);
    }
  }

  // Chat room management
  joinChatRoom(chatId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-chat-room', chatId);
    }
  }

  leaveChatRoom(chatId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-chat-room', chatId);
    }
  }

  onNewUserRegistered(callback) {
    if (this.socket) {
      this.socket.on('new-user-registered', callback);
    }
  }

  onNewNotification(callback) {
    if (this.socket) {
      this.socket.on('new-notification', callback);
    }
  }

  onUserOnline(callback) {
    if (this.socket) {
      this.socket.on('user-online', callback);
    }
  }

  onUserOffline(callback) {
    if (this.socket) {
      this.socket.on('user-offline', callback);
    }
  }

  // Typing indicators
  emitUserTyping(userId, userName, action) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user-typing', { userId, userName, action });
    }
  }

  emitUserStoppedTyping(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user-stopped-typing', { userId });
    }
  }

  onUserTyping(callback) {
    if (this.socket) {
      this.socket.on('user-typing', callback);
    }
  }

  onUserStoppedTyping(callback) {
    if (this.socket) {
      this.socket.on('user-stopped-typing', callback);
    }
  }

  // Collaboration events
  joinBlogCollaboration(blogId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-blog-collaboration', blogId);
    }
  }

  emitBlogContentChange(blogId, content, user) {
    if (this.socket && this.isConnected) {
      this.socket.emit('blog-content-change', { blogId, content, user });
    }
  }

  onBlogContentUpdated(callback) {
    if (this.socket) {
      this.socket.on('blog-content-updated', callback);
    }
  }

  // Comment typing indicators
  emitCommentTyping(blogId, userId, userName) {
    if (this.socket && this.isConnected) {
      this.socket.emit('comment-typing', { blogId, userId, userName });
    }
  }

  emitCommentStoppedTyping(blogId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('comment-stopped-typing', { blogId, userId });
    }
  }

  onUserCommenting(callback) {
    if (this.socket) {
      this.socket.on('user-commenting', callback);
    }
  }

  onUserStoppedCommenting(callback) {
    if (this.socket) {
      this.socket.on('user-stopped-commenting', callback);
    }
  }

  // User activity tracking
  emitUserActivity(userId, activity, metadata = {}) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user-activity', { userId, activity, metadata });
    }
  }

  onUserActivityUpdated(callback) {
    if (this.socket) {
      this.socket.on('user-activity-updated', callback);
    }
  }

  // Analytics events
  onAnalyticsUpdated(callback) {
    if (this.socket) {
      this.socket.on('analytics-updated', callback);
    }
  }

  // Media upload events
  emitUploadProgress(uploadId, progress, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('media-upload-progress', { uploadId, progress, userId });
    }
  }

  onUploadProgress(callback) {
    if (this.socket) {
      this.socket.on('upload-progress', callback);
    }
  }

  onUserCommenting(callback) {
    if (this.socket) {
      this.socket.on('user-commenting', callback);
    }
  }

  onUserStoppedCommenting(callback) {
    if (this.socket) {
      this.socket.on('user-stopped-commenting', callback);
    }
  }

  // Utility methods
  joinUserRoom(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-user-room', userId);
    }
  }

  joinBlogsRoom() {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-blogs-room');
    }
  }

  joinCategoriesRoom() {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-categories-room');
    }
  }

  emitUserOnline(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user-online', userId);
    }
  }

  emitUserOffline(userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user-offline', userId);
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  getSocket() {
    return this.socket;
  }

  // Clean up event listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;