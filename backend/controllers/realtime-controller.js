import User from "../model/User.js";
import Blog from "../model/Blog.js";
import Analytics from "../model/Analytics.js";
import AnalyticsDashboard from "../model/AnalyticsDashboard.js";
import { io } from "../app.js";

// Real-time user presence tracking
export const trackUserPresence = async (req, res) => {
    try {
        const { userId, action, metadata } = req.body;
        
        // Update user's online status
        await User.findByIdAndUpdate(userId, {
            isOnline: true,
            lastActive: new Date()
        });

        // Emit presence update to all connected clients
        req.io.emit('user-presence-updated', {
            userId,
            isOnline: true,
            lastActive: new Date(),
            action,
            metadata
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error tracking user presence:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time blog view tracking
export const trackBlogView = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { userId, sessionId, timeOnPage, scrollDepth } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Update blog views
        const blog = await Blog.findByIdAndUpdate(
            blogId,
            { 
                $inc: { views: 1 },
                lastViewed: new Date()
            },
            { new: true }
        );

        // Track unique view if user is provided
        if (userId) {
            const existingView = blog.uniqueViews.find(v => 
                v.user && v.user.toString() === userId
            );
            
            if (!existingView) {
                await Blog.findByIdAndUpdate(blogId, {
                    $push: {
                        uniqueViews: {
                            user: userId,
                            viewedAt: new Date(),
                            ipAddress,
                            userAgent
                        }
                    }
                });
            }
        }

        // Update analytics dashboard
        let dashboard = await AnalyticsDashboard.findOne({ blog: blogId });
        if (!dashboard) {
            dashboard = new AnalyticsDashboard({ blog: blogId });
        }

        // Add current viewer
        if (userId) {
            const existingViewer = dashboard.currentViewers.find(v => 
                v.user && v.user.toString() === userId
            );
            
            if (!existingViewer) {
                dashboard.currentViewers.push({
                    user: userId,
                    joinedAt: new Date(),
                    lastActivity: new Date()
                });
            } else {
                existingViewer.lastActivity = new Date();
            }
        }

        // Update view counts
        dashboard.totalViews += 1;
        if (userId && !blog.uniqueViews.find(v => v.user && v.user.toString() === userId)) {
            dashboard.uniqueViews += 1;
        }

        await dashboard.save();

        // Create analytics record
        await Analytics.create({
            blog: blogId,
            user: userId,
            event: 'view',
            metadata: {
                ipAddress,
                userAgent,
                sessionId,
                timeOnPage,
                scrollDepth,
                referrer: req.get('Referrer')
            }
        });

        // Emit real-time view update
        req.io.to(`blog-${blogId}`).emit('blog-view-updated', {
            blogId,
            views: blog.views,
            currentViewers: dashboard.currentViewers.length,
            timestamp: new Date()
        });

        // Emit to analytics dashboard
        req.io.to(`analytics-${blogId}`).emit('analytics-updated', {
            blogId,
            totalViews: dashboard.totalViews,
            uniqueViews: dashboard.uniqueViews,
            currentViewers: dashboard.currentViewers.length
        });

        res.json({ 
            success: true,
            views: blog.views,
            currentViewers: dashboard.currentViewers.length
        });
    } catch (error) {
        console.error("Error tracking blog view:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time content collaboration
export const handleContentCollaboration = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { userId, content, operation, position } = req.body;

        // Verify user has collaboration access
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        const hasAccess = blog.user.toString() === userId || 
                         blog.collaborators.some(c => c.user.toString() === userId);

        if (!hasAccess) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Emit real-time content change
        req.io.to(`blog-${blogId}`).emit('content-collaboration', {
            blogId,
            userId,
            content,
            operation,
            position,
            timestamp: new Date()
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error handling content collaboration:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time engagement tracking
export const trackEngagement = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { userId, action, metadata } = req.body;

        // Create analytics record
        await Analytics.create({
            blog: blogId,
            user: userId,
            event: action,
            metadata: {
                ...metadata,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
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

            // Update engagement counts
            switch (action) {
                case 'like':
                    dashboard.totalLikes += 1;
                    break;
                case 'comment':
                    dashboard.totalComments += 1;
                    break;
                case 'share':
                    dashboard.totalShares += 1;
                    break;
                case 'bookmark':
                    dashboard.totalBookmarks += 1;
                    break;
            }

            await dashboard.save();
        }

        // Emit real-time engagement update
        req.io.to(`blog-${blogId}`).emit('engagement-updated', {
            blogId,
            action,
            userId,
            metadata,
            timestamp: new Date()
        });

        // Emit to analytics dashboard
        req.io.to(`analytics-${blogId}`).emit('analytics-updated', {
            blogId,
            recentActivity: dashboard?.recentActivity?.slice(0, 10) || [],
            totalLikes: dashboard?.totalLikes || 0,
            totalComments: dashboard?.totalComments || 0,
            totalShares: dashboard?.totalShares || 0,
            totalBookmarks: dashboard?.totalBookmarks || 0
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error tracking engagement:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get real-time blog statistics
export const getRealTimeBlogStats = async (req, res) => {
    try {
        const { blogId } = req.params;

        const [blog, dashboard] = await Promise.all([
            Blog.findById(blogId).populate('user', 'name profile'),
            AnalyticsDashboard.findOne({ blog: blogId })
        ]);

        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        // Clean up inactive viewers (older than 5 minutes)
        if (dashboard) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            dashboard.currentViewers = dashboard.currentViewers.filter(
                viewer => viewer.lastActivity > fiveMinutesAgo
            );
            await dashboard.save();
        }

        const stats = {
            blogId,
            title: blog.title,
            author: blog.user,
            views: blog.views || 0,
            likes: blog.likes?.length || 0,
            comments: blog.comments?.filter(c => !c.isDeleted).length || 0,
            shares: blog.shares?.length || 0,
            currentViewers: dashboard?.currentViewers?.length || 0,
            recentActivity: dashboard?.recentActivity?.slice(0, 10) || [],
            engagementRate: dashboard?.engagementRate || 0,
            lastUpdated: new Date()
        };

        res.json({ stats });
    } catch (error) {
        console.error("Error getting real-time blog stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time user activity feed
export const getUserActivityFeed = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20 } = req.query;

        // Get user's recent activities
        const activities = await Analytics.aggregate([
            { $match: { user: userId } },
            { $sort: { timestamp: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'blogs',
                    localField: 'blog',
                    foreignField: '_id',
                    as: 'blogInfo'
                }
            },
            { $unwind: { path: '$blogInfo', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' }
        ]);

        res.json({ activities });
    } catch (error) {
        console.error("Error getting user activity feed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time trending content
export const getTrendingContent = async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        
        let timeFilter;
        switch (timeframe) {
            case '1h':
                timeFilter = new Date(Date.now() - 60 * 60 * 1000);
                break;
            case '24h':
                timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            default:
                timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
        }

        // Get trending blogs based on recent engagement
        const trendingBlogs = await Analytics.aggregate([
            { $match: { timestamp: { $gte: timeFilter } } },
            {
                $group: {
                    _id: '$blog',
                    views: { $sum: { $cond: [{ $eq: ['$event', 'view'] }, 1, 0] } },
                    likes: { $sum: { $cond: [{ $eq: ['$event', 'like'] }, 1, 0] } },
                    comments: { $sum: { $cond: [{ $eq: ['$event', 'comment'] }, 1, 0] } },
                    shares: { $sum: { $cond: [{ $eq: ['$event', 'share'] }, 1, 0] } },
                    engagementScore: {
                        $sum: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ['$event', 'view'] }, then: 1 },
                                    { case: { $eq: ['$event', 'like'] }, then: 3 },
                                    { case: { $eq: ['$event', 'comment'] }, then: 5 },
                                    { case: { $eq: ['$event', 'share'] }, then: 7 }
                                ],
                                default: 0
                            }
                        }
                    }
                }
            },
            { $sort: { engagementScore: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'blogs',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'blog'
                }
            },
            { $unwind: '$blog' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'blog.user',
                    foreignField: '_id',
                    as: 'author'
                }
            },
            { $unwind: '$author' }
        ]);

        res.json({ trendingBlogs, timeframe });
    } catch (error) {
        console.error("Error getting trending content:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time notification system
export const sendRealTimeNotification = async (req, res) => {
    try {
        const { recipientId, type, title, message, data } = req.body;
        const senderId = req.user.id;

        // Create notification
        const notification = {
            type,
            title,
            message,
            from: senderId,
            data,
            createdAt: new Date()
        };

        // Add to user's notifications
        await User.findByIdAndUpdate(recipientId, {
            $push: {
                notifications: {
                    $each: [notification],
                    $position: 0,
                    $slice: 50 // Keep only last 50 notifications
                }
            }
        });

        // Emit real-time notification
        req.io.to(`user-${recipientId}`).emit('new-notification', {
            ...notification,
            id: Date.now().toString()
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error sending real-time notification:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time content feed
export const getRealTimeContentFeed = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10, lastTimestamp } = req.query;

        // Get user's following list
        const user = await User.findById(userId).populate('following');
        const followingIds = user.following.map(f => f._id);

        // Build query for content feed
        let query = {
            status: 'published',
            $or: [
                { user: { $in: followingIds } }, // Posts from followed users
                { featured: true }, // Featured posts
                { 
                    createdAt: { 
                        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
                    } 
                } // Recent posts
            ]
        };

        // Add timestamp filter for pagination
        if (lastTimestamp) {
            query.createdAt = { $lt: new Date(lastTimestamp) };
        }

        const feedBlogs = await Blog.find(query)
            .populate('user', 'name profile')
            .populate('likes.user', 'name profile')
            .populate('comments.user', 'name profile')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({ 
            blogs: feedBlogs,
            hasMore: feedBlogs.length === parseInt(limit)
        });
    } catch (error) {
        console.error("Error getting real-time content feed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time search with live results
export const performRealTimeSearch = async (req, res) => {
    try {
        const { query, filters = {}, limit = 10 } = req.body;
        const userId = req.user?.id;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const searchRegex = new RegExp(query.trim(), 'i');
        
        let searchQuery = {
            status: 'published',
            $or: [
                { title: searchRegex },
                { description: searchRegex },
                { content: searchRegex },
                { tags: { $in: [searchRegex] } },
                { hashtags: { $in: [searchRegex] } }
            ]
        };

        // Apply filters
        if (filters.category) searchQuery.category = filters.category;
        if (filters.author) {
            const author = await User.findOne({ name: new RegExp(filters.author, 'i') });
            if (author) searchQuery.user = author._id;
        }
        if (filters.tags) searchQuery.tags = { $in: filters.tags };
        if (filters.dateRange) {
            searchQuery.createdAt = {
                $gte: new Date(filters.dateRange.start),
                $lte: new Date(filters.dateRange.end)
            };
        }

        const results = await Blog.find(searchQuery)
            .populate('user', 'name profile')
            .sort({ 
                score: { $meta: 'textScore' },
                createdAt: -1 
            })
            .limit(parseInt(limit));

        // Track search analytics
        await Analytics.create({
            event: 'search',
            user: userId,
            metadata: {
                searchQuery: query,
                filters,
                resultsCount: results.length,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        res.json({ 
            results,
            query,
            filters,
            totalResults: results.length
        });
    } catch (error) {
        console.error("Error performing real-time search:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time user status updates
export const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, activity, location } = req.body;

        await User.findByIdAndUpdate(userId, {
            isOnline: status === 'online',
            lastActive: new Date(),
            'profile.currentActivity': activity,
            'profile.location': location
        });

        // Emit status update to followers
        const user = await User.findById(userId).populate('followers', '_id');
        user.followers.forEach(follower => {
            req.io.to(`user-${follower._id}`).emit('user-status-updated', {
                userId,
                status,
                activity,
                location,
                timestamp: new Date()
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Real-time content moderation
export const moderateContent = async (req, res) => {
    try {
        const { contentId, contentType, action, reason } = req.body;
        const moderatorId = req.user.id;

        let content;
        let notificationRecipient;

        switch (contentType) {
            case 'blog':
                content = await Blog.findById(contentId).populate('user');
                if (content) {
                    content.status = action === 'approve' ? 'published' : 'rejected';
                    content.moderationReason = reason;
                    await content.save();
                    notificationRecipient = content.user._id;
                }
                break;
            case 'comment':
                content = await Blog.findOne({ 'comments._id': contentId });
                if (content) {
                    const comment = content.comments.id(contentId);
                    comment.isDeleted = action === 'remove';
                    comment.moderationReason = reason;
                    await content.save();
                    notificationRecipient = comment.user;
                }
                break;
        }

        // Send real-time notification to content owner
        if (notificationRecipient) {
            req.io.to(`user-${notificationRecipient}`).emit('content-moderated', {
                contentId,
                contentType,
                action,
                reason,
                moderator: moderatorId,
                timestamp: new Date()
            });
        }

        // Emit to all connected clients for live updates
        req.io.emit('content-moderation-update', {
            contentId,
            contentType,
            action,
            timestamp: new Date()
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error moderating content:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};