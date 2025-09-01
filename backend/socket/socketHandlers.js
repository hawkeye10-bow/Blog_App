import User from "../model/User.js";
import Blog from "../model/Blog.js";
import Chat from "../model/Chat.js";
import Analytics from "../model/Analytics.js";
import AnalyticsDashboard from "../model/AnalyticsDashboard.js";

// Store active connections and their metadata
const activeConnections = new Map();
const blogViewers = new Map(); // blogId -> Set of userIds
const typingUsers = new Map(); // blogId -> Set of userIds
const collaborationSessions = new Map(); // blogId -> Set of userIds

export const handleSocketConnection = (io, socket) => {
  console.log(`User connected: ${socket.id}`);

  // Store connection info
  socket.on('user-connected', async (userData) => {
    try {
      activeConnections.set(socket.id, {
        userId: userData.userId,
        userName: userData.userName,
        socketId: socket.id,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      // Update user online status
      await User.findByIdAndUpdate(userData.userId, {
        isOnline: true,
        lastActive: new Date()
      });

      // Join user's personal room
      socket.join(`user-${userData.userId}`);
      
      // Notify followers that user is online
      const user = await User.findById(userData.userId).populate('followers');
      if (user.followers) {
        user.followers.forEach(follower => {
          socket.to(`user-${follower._id}`).emit('user-online', {
            userId: userData.userId,
            userName: userData.userName,
            timestamp: new Date()
          });
        });
      }

      console.log(`User ${userData.userName} connected and joined room user-${userData.userId}`);
    } catch (error) {
      console.error('Error handling user connection:', error);
    }
  });

  // Join blogs room for general blog updates
  socket.on('join-blogs-room', () => {
    socket.join('blogs-room');
    console.log(`Socket ${socket.id} joined blogs-room`);
  });

  // Join specific blog room for real-time viewing
  socket.on('join-blog-room', async (data) => {
    const { blogId, userId } = data;
    
    try {
      socket.join(`blog-${blogId}`);
      
      // Add to blog viewers
      if (!blogViewers.has(blogId)) {
        blogViewers.set(blogId, new Set());
      }
      blogViewers.get(blogId).add(userId);

      // Update analytics dashboard
      await AnalyticsDashboard.updateViewerActivity(blogId, userId);

      // Notify other viewers
      socket.to(`blog-${blogId}`).emit('viewer-joined', {
        blogId,
        userId,
        viewerCount: blogViewers.get(blogId).size,
        timestamp: new Date()
      });

      console.log(`User ${userId} joined blog room ${blogId}`);
    } catch (error) {
      console.error('Error joining blog room:', error);
    }
  });

  // Leave blog room
  socket.on('leave-blog-room', async (data) => {
    const { blogId, userId } = data;
    
    try {
      socket.leave(`blog-${blogId}`);
      
      // Remove from blog viewers
      if (blogViewers.has(blogId)) {
        blogViewers.get(blogId).delete(userId);
        if (blogViewers.get(blogId).size === 0) {
          blogViewers.delete(blogId);
        }
      }

      // Notify other viewers
      socket.to(`blog-${blogId}`).emit('viewer-left', {
        blogId,
        userId,
        viewerCount: blogViewers.get(blogId)?.size || 0,
        timestamp: new Date()
      });

      console.log(`User ${userId} left blog room ${blogId}`);
    } catch (error) {
      console.error('Error leaving blog room:', error);
    }
  });

  // Real-time blog content collaboration
  socket.on('blog-content-change', (data) => {
    const { blogId, userId, content, operation, position, timestamp } = data;
    
    // Broadcast to other collaborators
    socket.to(`blog-${blogId}`).emit('content-updated', {
      blogId,
      userId,
      content,
      operation,
      position,
      timestamp
    });
  });

  // Real-time typing indicators
  socket.on('user-typing', (data) => {
    const { blogId, userId, userName, action } = data;
    
    // Add to typing users
    if (!typingUsers.has(blogId)) {
      typingUsers.set(blogId, new Map());
    }
    typingUsers.get(blogId).set(userId, { userName, action, timestamp: Date.now() });

    // Broadcast typing indicator
    socket.to(`blog-${blogId}`).emit('user-typing', {
      blogId,
      userId,
      userName,
      action,
      timestamp: new Date()
    });

    // Auto-remove typing indicator after 3 seconds
    setTimeout(() => {
      if (typingUsers.has(blogId)) {
        typingUsers.get(blogId).delete(userId);
        if (typingUsers.get(blogId).size === 0) {
          typingUsers.delete(blogId);
        }
      }
      
      socket.to(`blog-${blogId}`).emit('user-stopped-typing', {
        blogId,
        userId
      });
    }, 3000);
  });

  // Stop typing indicator
  socket.on('user-stopped-typing', (data) => {
    const { blogId, userId } = data;
    
    if (typingUsers.has(blogId)) {
      typingUsers.get(blogId).delete(userId);
      if (typingUsers.get(blogId).size === 0) {
        typingUsers.delete(blogId);
      }
    }

    socket.to(`blog-${blogId}`).emit('user-stopped-typing', {
      blogId,
      userId
    });
  });

  // Real-time comment typing
  socket.on('comment-typing', (data) => {
    const { blogId, userId, userName } = data;
    
    socket.to(`blog-${blogId}`).emit('user-commenting', {
      blogId,
      userId,
      userName,
      timestamp: new Date()
    });
  });

  socket.on('comment-stopped-typing', (data) => {
    const { blogId, userId } = data;
    
    socket.to(`blog-${blogId}`).emit('user-stopped-commenting', {
      blogId,
      userId
    });
  });

  // Real-time blog interactions
  socket.on('blog-liked', async (data) => {
    const { blogId, userId, isLiked } = data;
    
    try {
      // Update blog likes
      const blog = await Blog.findById(blogId);
      if (blog) {
        if (isLiked) {
          blog.likes.push({ user: userId, createdAt: new Date() });
        } else {
          blog.likes = blog.likes.filter(like => like.user.toString() !== userId);
        }
        await blog.save();

        // Broadcast like update
        io.to(`blog-${blogId}`).emit('blog-like-updated', {
          blogId,
          likeCount: blog.likes.length,
          isLiked,
          userId,
          timestamp: new Date()
        });

        // Update analytics
        await Analytics.create({
          blog: blogId,
          user: userId,
          event: isLiked ? 'like' : 'unlike',
          metadata: {
            timestamp: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error handling blog like:', error);
    }
  });

  // Real-time comments
  socket.on('comment-added', async (data) => {
    const { blogId, userId, content, parentCommentId } = data;
    
    try {
      const blog = await Blog.findById(blogId).populate('user');
      if (blog) {
        const newComment = {
          user: userId,
          content,
          parentComment: parentCommentId || null,
          createdAt: new Date()
        };

        blog.comments.push(newComment);
        await blog.save();

        // Populate the new comment
        await Blog.populate(newComment, { path: 'user', select: 'name profile' });

        // Broadcast new comment
        io.to(`blog-${blogId}`).emit('new-comment', {
          blogId,
          comment: newComment,
          timestamp: new Date()
        });

        // Notify blog author if different user
        if (blog.user._id.toString() !== userId) {
          socket.to(`user-${blog.user._id}`).emit('new-notification', {
            type: 'comment',
            title: 'New Comment',
            message: `Someone commented on your blog "${blog.title}"`,
            data: { blogId, commentId: newComment._id },
            timestamp: new Date()
          });
        }

        // Update analytics
        await Analytics.create({
          blog: blogId,
          user: userId,
          event: 'comment',
          metadata: {
            commentLength: content.length,
            isReply: !!parentCommentId,
            timestamp: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error handling comment:', error);
    }
  });

  // Real-time blog sharing
  socket.on('blog-shared', async (data) => {
    const { blogId, userId, platform } = data;
    
    try {
      const blog = await Blog.findById(blogId);
      if (blog) {
        blog.shares.push({
          user: userId,
          platform,
          createdAt: new Date()
        });
        await blog.save();

        // Broadcast share update
        io.to(`blog-${blogId}`).emit('blog-shared', {
          blogId,
          shareCount: blog.shares.length,
          platform,
          userId,
          timestamp: new Date()
        });

        // Update analytics
        await Analytics.create({
          blog: blogId,
          user: userId,
          event: 'share',
          metadata: {
            platform,
            timestamp: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error handling blog share:', error);
    }
  });

  // Real-time chat functionality
  socket.on('join-chat-room', (chatId) => {
    socket.join(`chat-${chatId}`);
    console.log(`Socket ${socket.id} joined chat room ${chatId}`);
  });

  socket.on('leave-chat-room', (chatId) => {
    socket.leave(`chat-${chatId}`);
    console.log(`Socket ${socket.id} left chat room ${chatId}`);
  });

  socket.on('chat-message', async (data) => {
    const { chatId, senderId, content, messageType, mediaUrl } = data;
    
    try {
      const chat = await Chat.findById(chatId);
      if (chat) {
        const newMessage = {
          sender: senderId,
          content,
          messageType: messageType || 'text',
          mediaUrl,
          readBy: [{ user: senderId, readAt: new Date() }],
          createdAt: new Date()
        };

        chat.messages.push(newMessage);
        chat.lastActivity = new Date();
        await chat.save();

        // Populate sender info
        await Chat.populate(newMessage, { path: 'sender', select: 'name profile' });

        // Broadcast to chat participants
        socket.to(`chat-${chatId}`).emit('new-chat-message', {
          chatId,
          message: newMessage,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error handling chat message:', error);
    }
  });

  socket.on('chat-typing', (data) => {
    const { chatId, userId, userName } = data;
    socket.to(`chat-${chatId}`).emit('user-typing-chat', {
      chatId,
      userId,
      userName,
      timestamp: new Date()
    });
  });

  socket.on('chat-stopped-typing', (data) => {
    const { chatId, userId } = data;
    socket.to(`chat-${chatId}`).emit('user-stopped-typing-chat', {
      chatId,
      userId
    });
  });

  // Real-time collaboration
  socket.on('join-collaboration', async (data) => {
    const { blogId, userId, userName } = data;
    
    try {
      socket.join(`collaboration-${blogId}`);
      
      // Add to collaboration session
      if (!collaborationSessions.has(blogId)) {
        collaborationSessions.set(blogId, new Set());
      }
      collaborationSessions.get(blogId).add(userId);

      // Notify other collaborators
      socket.to(`collaboration-${blogId}`).emit('collaborator-joined', {
        blogId,
        userId,
        userName,
        collaboratorCount: collaborationSessions.get(blogId).size,
        timestamp: new Date()
      });

      console.log(`User ${userName} joined collaboration for blog ${blogId}`);
    } catch (error) {
      console.error('Error joining collaboration:', error);
    }
  });

  socket.on('leave-collaboration', (data) => {
    const { blogId, userId, userName } = data;
    
    socket.leave(`collaboration-${blogId}`);
    
    // Remove from collaboration session
    if (collaborationSessions.has(blogId)) {
      collaborationSessions.get(blogId).delete(userId);
      if (collaborationSessions.get(blogId).size === 0) {
        collaborationSessions.delete(blogId);
      }
    }

    // Notify other collaborators
    socket.to(`collaboration-${blogId}`).emit('collaborator-left', {
      blogId,
      userId,
      userName,
      collaboratorCount: collaborationSessions.get(blogId)?.size || 0,
      timestamp: new Date()
    });
  });

  socket.on('collaboration-content-change', (data) => {
    const { blogId, userId, userName, content, operation, position } = data;
    
    // Broadcast to other collaborators
    socket.to(`collaboration-${blogId}`).emit('collaboration-update', {
      blogId,
      userId,
      userName,
      content,
      operation,
      position,
      timestamp: new Date()
    });
  });

  // Real-time notifications
  socket.on('send-notification', async (data) => {
    const { recipientId, type, title, message, senderId, blogId } = data;
    
    try {
      // Add notification to user
      const user = await User.findById(recipientId);
      if (user) {
        await user.addNotification(type, message, senderId, blogId);
        
        // Send real-time notification
        socket.to(`user-${recipientId}`).emit('new-notification', {
          type,
          title,
          message,
          from: senderId,
          blog: blogId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  });

  // Real-time analytics tracking
  socket.on('track-page-view', async (data) => {
    const { blogId, userId, duration, scrollDepth, referrer } = data;
    
    try {
      // Create analytics record
      await Analytics.create({
        blog: blogId,
        user: userId,
        event: 'view',
        metadata: {
          duration,
          scrollDepth,
          referrer,
          timestamp: new Date()
        }
      });

      // Update real-time analytics
      const dashboard = await AnalyticsDashboard.findOne({ blog: blogId });
      if (dashboard) {
        dashboard.totalViews += 1;
        await dashboard.save();

        // Broadcast analytics update
        io.to(`analytics-${blogId}`).emit('analytics-updated', {
          blogId,
          totalViews: dashboard.totalViews,
          currentViewers: blogViewers.get(blogId)?.size || 0,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  });

  // Real-time search
  socket.on('live-search', async (data) => {
    const { query, userId } = data;
    
    try {
      if (query.length >= 2) {
        const searchRegex = new RegExp(query, 'i');
        const results = await Blog.find({
          status: 'published',
          $or: [
            { title: searchRegex },
            { description: searchRegex },
            { tags: { $in: [searchRegex] } }
          ]
        })
        .populate('user', 'name profile')
        .limit(5)
        .sort({ createdAt: -1 });

        socket.emit('search-results', {
          query,
          results,
          timestamp: new Date()
        });

        // Track search analytics
        await Analytics.create({
          event: 'search',
          user: userId,
          metadata: {
            searchQuery: query,
            resultsCount: results.length,
            timestamp: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error handling live search:', error);
    }
  });

  // Real-time poll voting
  socket.on('poll-vote', async (data) => {
    const { pollId, blogId, userId, optionTexts } = data;
    
    try {
      // This would integrate with your poll system
      // Broadcast poll update
      socket.to(`blog-${blogId}`).emit('poll-updated', {
        pollId,
        blogId,
        userId,
        optionTexts,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error handling poll vote:', error);
    }
  });

  // Handle user activity updates
  socket.on('user-activity', async (data) => {
    const { userId, activity, metadata } = data;
    
    try {
      // Update user's last activity
      await User.findByIdAndUpdate(userId, {
        lastActive: new Date(),
        'profile.currentActivity': activity
      });

      // Update connection info
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
        connection.currentActivity = activity;
      }

      // Broadcast activity to followers
      const user = await User.findById(userId).populate('followers');
      if (user.followers) {
        user.followers.forEach(follower => {
          socket.to(`user-${follower._id}`).emit('user-activity-updated', {
            userId,
            activity,
            metadata,
            timestamp: new Date()
          });
        });
      }
    } catch (error) {
      console.error('Error handling user activity:', error);
    }
  });

  // Handle real-time media uploads
  socket.on('media-upload-progress', (data) => {
    const { uploadId, progress, userId } = data;
    
    socket.to(`user-${userId}`).emit('upload-progress', {
      uploadId,
      progress,
      timestamp: new Date()
    });
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        const { userId, userName } = connection;
        
        // Update user offline status
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastActive: new Date()
        });

        // Remove from all tracking maps
        blogViewers.forEach((viewers, blogId) => {
          if (viewers.has(userId)) {
            viewers.delete(userId);
            socket.to(`blog-${blogId}`).emit('viewer-left', {
              blogId,
              userId,
              viewerCount: viewers.size,
              timestamp: new Date()
            });
          }
        });

        typingUsers.forEach((users, blogId) => {
          if (users.has(userId)) {
            users.delete(userId);
            socket.to(`blog-${blogId}`).emit('user-stopped-typing', {
              blogId,
              userId
            });
          }
        });

        collaborationSessions.forEach((users, blogId) => {
          if (users.has(userId)) {
            users.delete(userId);
            socket.to(`collaboration-${blogId}`).emit('collaborator-left', {
              blogId,
              userId,
              userName,
              collaboratorCount: users.size,
              timestamp: new Date()
            });
          }
        });

        // Notify followers that user is offline
        const user = await User.findById(userId).populate('followers');
        if (user && user.followers) {
          user.followers.forEach(follower => {
            socket.to(`user-${follower._id}`).emit('user-offline', {
              userId,
              userName,
              timestamp: new Date()
            });
          });
        }

        activeConnections.delete(socket.id);
        console.log(`User ${userName} disconnected`);
      }
    } catch (error) {
      console.error('Error handling disconnection:', error);
    }
  });

  // Heartbeat to keep connection alive and track activity
  socket.on('heartbeat', async (data) => {
    const { userId } = data;
    
    try {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.lastActivity = new Date();
      }

      // Update user's last active timestamp
      await User.findByIdAndUpdate(userId, {
        lastActive: new Date()
      });

      socket.emit('heartbeat-ack', { timestamp: new Date() });
    } catch (error) {
      console.error('Error handling heartbeat:', error);
    }
  });
};

// Utility functions for socket management
export const getActiveConnections = () => activeConnections;
export const getBlogViewers = (blogId) => blogViewers.get(blogId) || new Set();
export const getTypingUsers = (blogId) => typingUsers.get(blogId) || new Map();
export const getCollaborationSessions = (blogId) => collaborationSessions.get(blogId) || new Set();

// Cleanup inactive connections
export const cleanupInactiveConnections = () => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  activeConnections.forEach((connection, socketId) => {
    if (now - connection.lastActivity.getTime() > timeout) {
      activeConnections.delete(socketId);
    }
  });

  // Clean up blog viewers
  blogViewers.forEach((viewers, blogId) => {
    const activeViewers = new Set();
    viewers.forEach(userId => {
      const isActive = Array.from(activeConnections.values())
        .some(conn => conn.userId === userId);
      if (isActive) {
        activeViewers.add(userId);
      }
    });
    blogViewers.set(blogId, activeViewers);
  });
};

// Run cleanup every minute
setInterval(cleanupInactiveConnections, 60000);