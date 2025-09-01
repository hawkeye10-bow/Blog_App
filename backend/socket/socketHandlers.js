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
const userPresence = new Map(); // userId -> presence data
const analyticsViewers = new Map(); // blogId -> Set of userIds
const chatRooms = new Map(); // chatId -> Set of userIds

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
        lastActivity: new Date(),
        rooms: new Set(),
        currentBlog: null,
        isTyping: false
      });

      // Update user presence
      userPresence.set(userData.userId, {
        userId: userData.userId,
        userName: userData.userName,
        status: 'online',
        lastActivity: new Date(),
        currentActivity: 'browsing',
        socketId: socket.id
      });

      // Update user online status
      await User.findByIdAndUpdate(userData.userId, {
        isOnline: true,
        lastActive: new Date()
      });

      // Join user's personal room
      socket.join(`user-${userData.userId}`);
      
      // Add room to connection tracking
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.rooms.add(`user-${userData.userId}`);
      }
      
      // Notify followers that user is online
      const user = await User.findById(userData.userId).populate('followers');
      if (user.followers) {
        user.followers.forEach(follower => {
          socket.to(`user-${follower._id}`).emit('user-online', {
            userId: userData.userId,
            userName: userData.userName,
            status: 'online',
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
    
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.rooms.add('blogs-room');
    }
    
    console.log(`Socket ${socket.id} joined blogs-room`);
  });

  // Join user room
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.rooms.add(`user-${userId}`);
    }
    
    console.log(`Socket ${socket.id} joined user room ${userId}`);
  });

  // Leave user room
  socket.on('leave-user-room', (userId) => {
    socket.leave(`user-${userId}`);
    
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.rooms.delete(`user-${userId}`);
    }
    
    console.log(`Socket ${socket.id} left user room ${userId}`);
  });

  // Join specific blog room for real-time viewing
  socket.on('join-blog-room', async (data) => {
    const { blogId, userId } = data;
    
    try {
      socket.join(`blog-${blogId}`);
      
      // Update connection tracking
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.rooms.add(`blog-${blogId}`);
        connection.currentBlog = blogId;
      }
      
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
        userName: activeConnections.get(socket.id)?.userName,
        viewerCount: blogViewers.get(blogId).size,
        activeViewers: Array.from(blogViewers.get(blogId)),
        timestamp: new Date()
      });

      // Send current viewers to the new viewer
      const currentViewers = Array.from(blogViewers.get(blogId));
      socket.emit('current-viewers', {
        blogId,
        viewers: currentViewers,
        viewerCount: currentViewers.length
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
      
      // Update connection tracking
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.rooms.delete(`blog-${blogId}`);
        if (connection.currentBlog === blogId) {
          connection.currentBlog = null;
        }
      }
      
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
        userName: activeConnections.get(socket.id)?.userName,
        viewerCount: blogViewers.get(blogId)?.size || 0,
        activeViewers: Array.from(blogViewers.get(blogId) || []),
        timestamp: new Date()
      });

      console.log(`User ${userId} left blog room ${blogId}`);
    } catch (error) {
      console.error('Error leaving blog room:', error);
    }
  });

  // Join analytics room
  socket.on('join-analytics-room', (blogId) => {
    socket.join(`analytics-${blogId}`);
    
    // Add to analytics viewers
    if (!analyticsViewers.has(blogId)) {
      analyticsViewers.set(blogId, new Set());
    }
    
    const connection = activeConnections.get(socket.id);
    if (connection) {
      analyticsViewers.get(blogId).add(connection.userId);
      connection.rooms.add(`analytics-${blogId}`);
    }
    
    console.log(`Socket ${socket.id} joined analytics room ${blogId}`);
  });

  // Leave analytics room
  socket.on('leave-analytics-room', (blogId) => {
    socket.leave(`analytics-${blogId}`);
    
    const connection = activeConnections.get(socket.id);
    if (connection) {
      if (analyticsViewers.has(blogId)) {
        analyticsViewers.get(blogId).delete(connection.userId);
      }
      connection.rooms.delete(`analytics-${blogId}`);
    }
    
    console.log(`Socket ${socket.id} left analytics room ${blogId}`);
  });

  // Real-time blog content collaboration
  socket.on('blog-content-change', (data) => {
    const { blogId, userId, content, operation, position, timestamp } = data;
    
    console.log(`📝 Content change received for blog ${blogId} by user ${userId}`);
    
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
    
    console.log(`⌨️ User ${userName} is ${action} in blog ${blogId}`);
    
    // Update connection typing status
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.isTyping = true;
      connection.typingAction = action;
    }
    
    // Add to typing users
    const key = blogId || 'global';
    if (!typingUsers.has(key)) {
      typingUsers.set(key, new Map());
    }
    typingUsers.get(key).set(userId, { userName, action, timestamp: Date.now() });

    // Broadcast typing indicator
    const targetRoom = blogId ? `blog-${blogId}` : 'blogs-room';
    socket.to(targetRoom).emit('user-typing', {
      blogId,
      userId,
      userName,
      action,
      timestamp: new Date()
    });

    // Auto-remove typing indicator after 3 seconds
    setTimeout(() => {
      const key = blogId || 'global';
      if (typingUsers.has(key)) {
        typingUsers.get(key).delete(userId);
        if (typingUsers.get(key).size === 0) {
          typingUsers.delete(key);
        }
      }
      
      // Update connection typing status
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.isTyping = false;
        connection.typingAction = null;
      }
      
      const targetRoom = blogId ? `blog-${blogId}` : 'blogs-room';
      socket.to(targetRoom).emit('user-stopped-typing', {
        blogId,
        userId
      });
    }, 3000);
  });

  // Stop typing indicator
  socket.on('user-stopped-typing', (data) => {
    const { blogId, userId } = data;
    
    console.log(`⌨️ User ${userId} stopped typing in blog ${blogId || 'global'}`);
    
    // Update connection typing status
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.isTyping = false;
      connection.typingAction = null;
    }
    
    const key = blogId || 'global';
    if (typingUsers.has(key)) {
      typingUsers.get(key).delete(userId);
      if (typingUsers.get(key).size === 0) {
        typingUsers.delete(key);
      }
    }

    const targetRoom = blogId ? `blog-${blogId}` : 'blogs-room';
    socket.to(targetRoom).emit('user-stopped-typing', {
      blogId,
      userId
    });
  });

  // Real-time comment typing
  socket.on('comment-typing', (data) => {
    const { blogId, userId, userName } = data;
    
    console.log(`💬 User ${userName} is typing a comment on blog ${blogId}`);
    
    socket.to(`blog-${blogId}`).emit('user-commenting', {
      blogId,
      userId,
      userName,
      timestamp: new Date()
    });
  });

  socket.on('comment-stopped-typing', (data) => {
    const { blogId, userId } = data;
    
    console.log(`💬 User ${userId} stopped typing comment on blog ${blogId}`);
    
    socket.to(`blog-${blogId}`).emit('user-stopped-commenting', {
      blogId,
      userId
    });
  });

  // Real-time blog interactions
  socket.on('blog-liked', async (data) => {
    const { blogId, userId, isLiked } = data;
    
    console.log(`❤️ Blog ${blogId} ${isLiked ? 'liked' : 'unliked'} by user ${userId}`);
    
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
          userName: activeConnections.get(socket.id)?.userName,
          timestamp: new Date()
        });

        // Broadcast to analytics room
        io.to(`analytics-${blogId}`).emit('analytics-updated', {
          blogId,
          event: 'like',
          totalLikes: blog.likes.length,
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
    
    console.log(`💬 New comment added to blog ${blogId} by user ${userId}`);
    
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
          commentCount: blog.comments.length,
          timestamp: new Date()
        });

        // Broadcast to analytics room
        io.to(`analytics-${blogId}`).emit('analytics-updated', {
          blogId,
          event: 'comment',
          totalComments: blog.comments.length,
          userId,
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
    
    console.log(`📤 Blog ${blogId} shared on ${platform} by user ${userId}`);
    
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
          userName: activeConnections.get(socket.id)?.userName,
          timestamp: new Date()
        });

        // Broadcast to analytics room
        io.to(`analytics-${blogId}`).emit('analytics-updated', {
          blogId,
          event: 'share',
          totalShares: blog.shares.length,
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
    
    // Add to chat rooms tracking
    if (!chatRooms.has(chatId)) {
      chatRooms.set(chatId, new Set());
    }
    
    const connection = activeConnections.get(socket.id);
    if (connection) {
      chatRooms.get(chatId).add(connection.userId);
      connection.rooms.add(`chat-${chatId}`);
    }
    
    console.log(`Socket ${socket.id} joined chat room ${chatId}`);
  });

  socket.on('leave-chat-room', (chatId) => {
    socket.leave(`chat-${chatId}`);
    
    const connection = activeConnections.get(socket.id);
    if (connection) {
      if (chatRooms.has(chatId)) {
        chatRooms.get(chatId).delete(connection.userId);
      }
      connection.rooms.delete(`chat-${chatId}`);
    }
    
    console.log(`Socket ${socket.id} left chat room ${chatId}`);
  });

  socket.on('chat-message', async (data) => {
    const { chatId, senderId, content, messageType, mediaUrl } = data;
    
    console.log(`💬 New chat message in ${chatId} from user ${senderId}`);
    
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
          participantCount: chat.participants.length,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error handling chat message:', error);
    }
  });

  socket.on('chat-typing', (data) => {
    const { chatId, userId, userName } = data;
    
    console.log(`💬 User ${userName} typing in chat ${chatId}`);
    
    socket.to(`chat-${chatId}`).emit('user-typing-chat', {
      chatId,
      userId,
      userName,
      timestamp: new Date()
    });
  });

  socket.on('chat-stopped-typing', (data) => {
    const { chatId, userId } = data;
    
    console.log(`💬 User ${userId} stopped typing in chat ${chatId}`);
    
    socket.to(`chat-${chatId}`).emit('user-stopped-typing-chat', {
      chatId,
      userId
    });
  });

  // Real-time collaboration
  socket.on('join-collaboration', async (data) => {
    const { blogId, userId, userName } = data;
    
    console.log(`🤝 User ${userName} joining collaboration for blog ${blogId}`);
    
    try {
      socket.join(`collaboration-${blogId}`);
      
      // Update connection tracking
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.rooms.add(`collaboration-${blogId}`);
      }
      
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
        socketId: socket.id,
        collaboratorCount: collaborationSessions.get(blogId).size,
        activeCollaborators: Array.from(collaborationSessions.get(blogId)),
        timestamp: new Date()
      });

      // Send current collaborators to the new collaborator
      const currentCollaborators = Array.from(collaborationSessions.get(blogId));
      socket.emit('current-collaborators', {
        blogId,
        collaborators: currentCollaborators,
        collaboratorCount: currentCollaborators.length
      });

      console.log(`User ${userName} joined collaboration for blog ${blogId}`);
    } catch (error) {
      console.error('Error joining collaboration:', error);
    }
  });

  socket.on('leave-collaboration', (data) => {
    const { blogId, userId, userName } = data;
    
    console.log(`🤝 User ${userName} leaving collaboration for blog ${blogId}`);
    
    socket.leave(`collaboration-${blogId}`);
    
    // Update connection tracking
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.rooms.delete(`collaboration-${blogId}`);
    }
    
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
      socketId: socket.id,
      collaboratorCount: collaborationSessions.get(blogId)?.size || 0,
      activeCollaborators: Array.from(collaborationSessions.get(blogId) || []),
      timestamp: new Date()
    });
  });

  socket.on('collaboration-content-change', (data) => {
    const { blogId, userId, userName, content, operation, position } = data;
    
    console.log(`📝 Collaboration content change in blog ${blogId} by ${userName}: ${operation}`);
    
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
    
    console.log(`🔔 Sending notification to user ${recipientId}: ${title}`);
    
    try {
      // Add notification to user
      const user = await User.findById(recipientId);
      if (user) {
        await user.addNotification(type, message, senderId, blogId);
        
        // Send real-time notification
        socket.to(`user-${recipientId}`).emit('new-notification', {
          id: Date.now().toString(),
          type,
          title,
          message,
          from: senderId,
          blog: blogId,
          read: false,
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
    
    console.log(`📊 Tracking page view for blog ${blogId} by user ${userId}`);
    
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
          uniqueViews: dashboard.uniqueViews,
          currentViewers: blogViewers.get(blogId)?.size || 0,
          recentActivity: dashboard.recentActivity?.slice(0, 10) || [],
          event: 'view',
          userId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  });

  // Enhanced real-time analytics tracking
  socket.on('track-detailed-view', async (data) => {
    const { 
      blogId, 
      userId, 
      sessionId, 
      timeOnPage, 
      scrollDepth, 
      interactions,
      viewType,
      screenResolution,
      viewportSize,
      referrer,
      userAgent
    } = data;
    
    console.log(`📊 Tracking detailed view for blog ${blogId}: ${viewType}`);
    
    try {
      // Create detailed analytics record
      await Analytics.create({
        blog: blogId,
        user: userId,
        event: 'detailed_view',
        metadata: {
          sessionId,
          timeOnPage,
          scrollDepth,
          interactions,
          viewType,
          screenResolution,
          viewportSize,
          referrer,
          userAgent,
          timestamp: new Date()
        }
      });

      // Update analytics dashboard with detailed metrics
      const dashboard = await AnalyticsDashboard.findOne({ blog: blogId });
      if (dashboard) {
        // Update engagement metrics
        if (timeOnPage > 0) {
          dashboard.averageReadingTime = 
            (dashboard.averageReadingTime * dashboard.totalViews + timeOnPage) / 
            (dashboard.totalViews + 1);
        }
        
        if (scrollDepth > 0) {
          // Update scroll heatmap
          const scrollBucket = Math.floor(scrollDepth / 10) * 10;
          const existingScroll = dashboard.scrollHeatmap.find(s => s.depth === scrollBucket);
          if (existingScroll) {
            existingScroll.count += 1;
          } else {
            dashboard.scrollHeatmap.push({ depth: scrollBucket, count: 1 });
          }
        }
        
        await dashboard.save();

        // Broadcast detailed analytics update
        io.to(`analytics-${blogId}`).emit('detailed-analytics-updated', {
          blogId,
          averageReadingTime: dashboard.averageReadingTime,
          scrollHeatmap: dashboard.scrollHeatmap,
          bounceRate: dashboard.bounceRate,
          engagementRate: dashboard.engagementRate,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error tracking detailed view:', error);
    }
  });

  // Real-time engagement tracking
  socket.on('track-engagement', async (data) => {
    const { blogId, userId, action, metadata } = data;
    
    console.log(`📊 Tracking engagement: ${action} on blog ${blogId} by user ${userId}`);
    
    try {
      // Create analytics record
      await Analytics.create({
        blog: blogId,
        user: userId,
        event: action,
        metadata: {
          ...metadata,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          timestamp: new Date()
        }
      });

      // Update analytics dashboard
      const dashboard = await AnalyticsDashboard.findOne({ blog: blogId });
      if (dashboard) {
        // Add to recent activity
        dashboard.recentActivity.unshift({
          type: action,
          user: userId,
          timestamp: new Date(),
          metadata
        });

        // Keep only last 100 activities
        if (dashboard.recentActivity.length > 100) {
          dashboard.recentActivity = dashboard.recentActivity.slice(0, 100);
        }

        await dashboard.save();

        // Broadcast engagement update
        io.to(`blog-${blogId}`).emit('engagement-updated', {
          blogId,
          action,
          userId,
          userName: activeConnections.get(socket.id)?.userName,
          metadata,
          recentActivity: dashboard.recentActivity.slice(0, 10),
          timestamp: new Date()
        });

        // Broadcast to analytics room
        io.to(`analytics-${blogId}`).emit('analytics-updated', {
          blogId,
          event: action,
          recentActivity: dashboard.recentActivity.slice(0, 10),
          userId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error tracking engagement:', error);
    }
  });

  // Real-time search with live results
  socket.on('live-search', async (data) => {
    const { query, userId } = data;
    
    console.log(`🔍 Live search query: "${query}" by user ${userId}`);
    
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
          resultCount: results.length,
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
    
    console.log(`🗳️ Poll vote received: ${pollId} by user ${userId}`);
    
    try {
      // Update poll with vote (implement poll voting logic)
      // For now, just broadcast the update
      // Broadcast poll update
      socket.to(`blog-${blogId}`).emit('poll-updated', {
        pollId,
        blogId,
        userId,
        userName: activeConnections.get(socket.id)?.userName,
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
    
    console.log(`👤 User activity update: ${userId} - ${activity}`);
    
    try {
      // Update user presence
      if (userPresence.has(userId)) {
        const presence = userPresence.get(userId);
        presence.currentActivity = activity;
        presence.lastActivity = new Date();
        presence.metadata = metadata;
      }
      
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
        connection.metadata = metadata;
      }

      // Broadcast activity to followers
      const user = await User.findById(userId).populate('followers');
      if (user.followers) {
        user.followers.forEach(follower => {
          socket.to(`user-${follower._id}`).emit('user-activity-updated', {
            userId,
            userName: connection?.userName,
            activity,
            metadata,
            status: userPresence.get(userId)?.status || 'online',
            timestamp: new Date()
          });
        });
      }
    } catch (error) {
      console.error('Error handling user activity:', error);
    }
  });

  // Real-time presence updates
  socket.on('update-presence', async (data) => {
    const { userId, status, metadata } = data;
    
    console.log(`👤 Presence update: ${userId} - ${status}`);
    
    try {
      // Update user presence
      if (userPresence.has(userId)) {
        const presence = userPresence.get(userId);
        presence.status = status;
        presence.lastActivity = new Date();
        presence.metadata = metadata;
      }

      // Update database
      await User.findByIdAndUpdate(userId, {
        isOnline: status === 'online',
        lastActive: new Date(),
        'profile.currentActivity': metadata.activity
      });

      // Broadcast presence update
      const user = await User.findById(userId).populate('followers', '_id');
      if (user.followers) {
        user.followers.forEach(follower => {
          socket.to(`user-${follower._id}`).emit('user-presence-updated', {
            userId,
            userName: activeConnections.get(socket.id)?.userName,
            status,
            metadata,
            timestamp: new Date()
          });
        });
      }
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  });

  // Real-time blog creation/updates
  socket.on('blog-created', async (blog) => {
    console.log(`📝 New blog created: ${blog.title}`);
    
    try {
      // Broadcast to all users in blogs room
      socket.to('blogs-room').emit('new-blog', {
        blog,
        message: `New blog "${blog.title}" published by ${blog.user.name}`,
        timestamp: new Date()
      });

      // Notify followers of the author
      const author = await User.findById(blog.user._id).populate('followers', '_id');
      if (author.followers) {
        author.followers.forEach(follower => {
          socket.to(`user-${follower._id}`).emit('new-blog-from-following', {
            blog,
            author: {
              _id: author._id,
              name: author.name,
              profile: author.profile
            },
            message: `${author.name} published a new blog: "${blog.title}"`,
            timestamp: new Date()
          });
        });
      }
    } catch (error) {
      console.error('Error handling blog creation:', error);
    }
  });

  socket.on('blog-updated', async (blog) => {
    console.log(`📝 Blog updated: ${blog.title}`);
    
    try {
      // Broadcast to all users in blogs room
      socket.to('blogs-room').emit('blog-updated', {
        blog,
        message: `Blog "${blog.title}" has been updated`,
        timestamp: new Date()
      });

      // Broadcast to blog-specific room
      socket.to(`blog-${blog._id}`).emit('blog-content-updated', {
        blog,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error handling blog update:', error);
    }
  });

  socket.on('blog-deleted', async (data) => {
    const { blogId } = data;
    
    console.log(`🗑️ Blog deleted: ${blogId}`);
    
    try {
      // Broadcast to all users
      socket.to('blogs-room').emit('blog-deleted', {
        blogId,
        message: 'A blog has been deleted',
        timestamp: new Date()
      });

      // Clear all related tracking data
      blogViewers.delete(blogId);
      collaborationSessions.delete(blogId);
      analyticsViewers.delete(blogId);
      
      // Remove users from blog rooms
      io.in(`blog-${blogId}`).socketsLeave(`blog-${blogId}`);
      io.in(`analytics-${blogId}`).socketsLeave(`analytics-${blogId}`);
      io.in(`collaboration-${blogId}`).socketsLeave(`collaboration-${blogId}`);
    } catch (error) {
      console.error('Error handling blog deletion:', error);
    }
  });

  // Handle real-time media uploads
  socket.on('media-upload-progress', (data) => {
    const { uploadId, progress, userId } = data;
    
    console.log(`📎 Media upload progress: ${uploadId} - ${progress}%`);
    
    socket.to(`user-${userId}`).emit('upload-progress', {
      uploadId,
      progress,
      status: progress === 100 ? 'completed' : 'uploading',
      timestamp: new Date()
    });
  });

  socket.on('media-uploaded', (data) => {
    console.log(`📎 Media uploaded: ${data.filename}`);
    
    // Broadcast to relevant rooms
    if (data.blogId) {
      socket.to(`blog-${data.blogId}`).emit('media-uploaded', {
        ...data,
        timestamp: new Date()
      });
    }
    
    // Broadcast to user's room
    socket.to(`user-${data.uploadedBy}`).emit('media-uploaded', {
      ...data,
      timestamp: new Date()
    });
  });

  // Real-time system status
  socket.on('get-system-status', () => {
    const status = {
      activeConnections: activeConnections.size,
      blogViewers: Object.fromEntries(
        Array.from(blogViewers.entries()).map(([blogId, viewers]) => [
          blogId, 
          Array.from(viewers)
        ])
      ),
      typingUsers: Object.fromEntries(
        Array.from(typingUsers.entries()).map(([key, users]) => [
          key,
          Array.from(users.entries())
        ])
      ),
      collaborationSessions: Object.fromEntries(
        Array.from(collaborationSessions.entries()).map(([blogId, users]) => [
          blogId,
          Array.from(users)
        ])
      ),
      userPresence: Object.fromEntries(userPresence),
      timestamp: new Date()
    };
    
    socket.emit('system-status', status);
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        const { userId, userName } = connection;
        
        console.log(`👤 User ${userName} (${userId}) disconnected`);
        
        // Update user presence
        if (userPresence.has(userId)) {
          const presence = userPresence.get(userId);
          presence.status = 'offline';
          presence.lastActivity = new Date();
        }
        
        // Update user offline status
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastActive: new Date()
        });

        // Remove from all tracking maps
        blogViewers.forEach((viewers, blogId) => {
          if (viewers.has(userId)) {
            viewers.delete(userId);
            
            // Notify remaining viewers
            socket.to(`blog-${blogId}`).emit('viewer-left', {
              blogId,
              userId,
              userName,
              viewerCount: viewers.size,
              activeViewers: Array.from(viewers),
              timestamp: new Date()
            });
          }
        });

        typingUsers.forEach((users, blogId) => {
          if (users.has(userId)) {
            users.delete(userId);
            
            const targetRoom = blogId === 'global' ? 'blogs-room' : `blog-${blogId}`;
            socket.to(targetRoom).emit('user-stopped-typing', {
              blogId: blogId === 'global' ? null : blogId,
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
              socketId: socket.id,
              collaboratorCount: users.size,
              activeCollaborators: Array.from(users),
              timestamp: new Date()
            });
          }
        });

        // Remove from chat rooms
        chatRooms.forEach((users, chatId) => {
          if (users.has(userId)) {
            users.delete(userId);
            socket.to(`chat-${chatId}`).emit('user-left-chat', {
              chatId,
              userId,
              userName,
              timestamp: new Date()
            });
          }
        });

        // Remove from analytics rooms
        analyticsViewers.forEach((users, blogId) => {
          if (users.has(userId)) {
            users.delete(userId);
          }
        });

        // Notify followers that user is offline
        const user = await User.findById(userId).populate('followers');
        if (user && user.followers) {
          user.followers.forEach(follower => {
            socket.to(`user-${follower._id}`).emit('user-offline', {
              userId,
              userName,
              status: 'offline',
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
        
        // Update user presence
        if (userPresence.has(userId)) {
          userPresence.get(userId).lastActivity = new Date();
        }
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

  // Real-time blog creation notification
  socket.on('notify-blog-created', async (data) => {
    const { blog, authorId } = data;
    
    console.log(`📢 Broadcasting new blog creation: ${blog.title}`);
    
    try {
      // Broadcast to all users in blogs room
      io.to('blogs-room').emit('new-blog', {
        blog,
        message: `New blog "${blog.title}" published!`,
        timestamp: new Date()
      });

      // Notify author's followers
      const author = await User.findById(authorId).populate('followers', '_id');
      if (author.followers) {
        author.followers.forEach(follower => {
          socket.to(`user-${follower._id}`).emit('new-blog-from-following', {
            blog,
            author: {
              _id: author._id,
              name: author.name,
              profile: author.profile
            },
            message: `${author.name} published a new blog: "${blog.title}"`,
            timestamp: new Date()
          });
        });
      }
    } catch (error) {
      console.error('Error broadcasting blog creation:', error);
    }
  });
};

// Utility functions for socket management
export const getActiveConnections = () => activeConnections;
export const getBlogViewers = (blogId) => blogViewers.get(blogId) || new Set();
export const getTypingUsers = (blogId) => typingUsers.get(blogId) || new Map();
export const getCollaborationSessions = (blogId) => collaborationSessions.get(blogId) || new Set();
export const getUserPresence = (userId) => userPresence.get(userId) || null;
export const getAllUserPresence = () => Object.fromEntries(userPresence);
export const getChatRoomUsers = (chatId) => chatRooms.get(chatId) || new Set();
export const getAnalyticsViewers = (blogId) => analyticsViewers.get(blogId) || new Set();

// Get comprehensive system statistics
export const getSystemStats = () => {
  return {
    activeConnections: activeConnections.size,
    totalBlogViewers: Array.from(blogViewers.values()).reduce((total, viewers) => total + viewers.size, 0),
    totalTypingUsers: Array.from(typingUsers.values()).reduce((total, users) => total + users.size, 0),
    totalCollaborators: Array.from(collaborationSessions.values()).reduce((total, users) => total + users.size, 0),
    onlineUsers: userPresence.size,
    activeChatRooms: chatRooms.size,
    timestamp: new Date()
  };
};

// Cleanup inactive connections
export const cleanupInactiveConnections = () => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  let cleanedConnections = 0;
  
  activeConnections.forEach((connection, socketId) => {
    if (now - connection.lastActivity.getTime() > timeout) {
      activeConnections.delete(socketId);
      
      // Remove from user presence
      if (connection.userId && userPresence.has(connection.userId)) {
        const presence = userPresence.get(connection.userId);
        presence.status = 'offline';
      }
      
      cleanedConnections++;
    }
  });

  if (cleanedConnections > 0) {
    console.log(`🧹 Cleaned up ${cleanedConnections} inactive connections`);
  }

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

  // Clean up user presence
  userPresence.forEach((presence, userId) => {
    const isActive = Array.from(activeConnections.values())
      .some(conn => conn.userId === userId);
    if (!isActive && now - presence.lastActivity.getTime() > timeout) {
      presence.status = 'offline';
    }
  });

  // Clean up typing users
  typingUsers.forEach((users, key) => {
    const activeTypingUsers = new Map();
    users.forEach((userData, userId) => {
      if (now - userData.timestamp < 10000) { // 10 seconds timeout for typing
        activeTypingUsers.set(userId, userData);
      }
    });
    
    if (activeTypingUsers.size > 0) {
      typingUsers.set(key, activeTypingUsers);
    } else {
      typingUsers.delete(key);
    }
  });
};

// Enhanced cleanup with logging
const runCleanup = () => {
  const startTime = Date.now();
  cleanupInactiveConnections();
  const duration = Date.now() - startTime;
  
  if (duration > 100) { // Log if cleanup takes more than 100ms
    console.log(`🧹 Cleanup completed in ${duration}ms`);
  }
};

// Run cleanup every 30 seconds for better real-time accuracy
setInterval(runCleanup, 30000);

// Log system statistics every 5 minutes
setInterval(() => {
  const stats = getSystemStats();
  console.log(`📊 System Stats:`, stats);
}, 5 * 60 * 1000);