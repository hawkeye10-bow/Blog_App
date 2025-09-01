import AnalyticsDashboard from "../model/AnalyticsDashboard.js";
import Blog from "../model/Blog.js";
import User from "../model/User.js";
import Analytics from "../model/Analytics.js";
import { io } from "../app.js";

// Get real-time analytics for a blog
export const getRealTimeAnalytics = async (req, res) => {
    try {
        const { blogId } = req.params;
        const userId = req.user.id;

        // Verify blog exists and user has permission
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        if (blog.user.toString() !== userId && !blog.collaborators.find(c => c.user.toString() === userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        let analytics = await AnalyticsDashboard.findOne({ blog: blogId });
        
        if (!analytics) {
            // Create analytics dashboard if it doesn't exist
            analytics = new AnalyticsDashboard({ blog: blogId });
            await analytics.save();
        }

        // Get real-time data
        const realTimeData = {
            currentViewers: analytics.currentViewers.slice(-10), // Last 10 viewers
            recentActivity: analytics.recentActivity.slice(-20), // Last 20 activities
            totalViews: analytics.totalViews,
            totalLikes: analytics.totalLikes,
            totalComments: analytics.totalComments,
            totalShares: analytics.totalShares,
            totalBookmarks: analytics.totalBookmarks,
            engagementRate: analytics.engagementRate,
            activeViewersCount: analytics.activeViewersCount
        };

        res.json({ analytics: realTimeData });

    } catch (error) {
        console.error("Error getting real-time analytics:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Track page view
export const trackPageView = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { duration, scrollDepth, bounce } = req.body;
        const userId = req.user?.id;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Create analytics record
        const analyticsRecord = new Analytics({
            blog: blogId,
            user: userId,
            event: 'view',
            metadata: {
                ipAddress,
                userAgent,
                timeOnPage: duration,
                scrollDepth,
                bounce
            }
        });

        await analyticsRecord.save();

        // Update analytics dashboard
        await AnalyticsDashboard.updateViewerActivity(blogId, userId);

        // Emit real-time update
        io.to(`blog-${blogId}`).emit('page-view-tracked', {
            blogId,
            userId,
            timestamp: new Date()
        });

        res.json({ message: "Page view tracked successfully" });

    } catch (error) {
        console.error("Error tracking page view:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Track user engagement
export const trackEngagement = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { event, metadata } = req.body;
        const userId = req.user.id;

        // Validate event type
        const validEvents = ['like', 'share', 'comment', 'bookmark', 'click'];
        if (!validEvents.includes(event)) {
            return res.status(400).json({ message: "Invalid event type" });
        }

        // Create analytics record
        const analyticsRecord = new Analytics({
            blog: blogId,
            user: userId,
            event,
            metadata
        });

        await analyticsRecord.save();

        // Update analytics dashboard
        const dashboard = await AnalyticsDashboard.findOne({ blog: blogId });
        if (dashboard) {
            // Add to recent activity
            dashboard.recentActivity.unshift({
                type: event,
                user: userId,
                timestamp: new Date(),
                metadata
            });

            // Keep only last 100 activities
            if (dashboard.recentActivity.length > 100) {
                dashboard.recentActivity = dashboard.recentActivity.slice(0, 100);
            }

            // Update counts
            switch (event) {
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

        // Emit real-time update
        io.to(`blog-${blogId}`).emit('engagement-tracked', {
            blogId,
            event,
            userId,
            timestamp: new Date()
        });

        res.json({ message: "Engagement tracked successfully" });

    } catch (error) {
        console.error("Error tracking engagement:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get comprehensive analytics for a blog
export const getBlogAnalytics = async (req, res) => {
    try {
        const { blogId } = req.params;
        const { period = '30d' } = req.query;
        const userId = req.user.id;

        // Verify blog exists and user has permission
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }

        if (blog.user.toString() !== userId && !blog.collaborators.find(c => c.user.toString() === userId)) {
            return res.status(403).json({ message: "Access denied" });
        }

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get analytics data
        const analytics = await Analytics.aggregate([
            { $match: { blog: blog._id, timestamp: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        event: '$event',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        // Get dashboard data
        const dashboard = await AnalyticsDashboard.findOne({ blog: blogId });

        // Process analytics data
        const processedData = {
            overview: {
                totalViews: dashboard?.totalViews || 0,
                totalLikes: dashboard?.totalLikes || 0,
                totalComments: dashboard?.totalComments || 0,
                totalShares: dashboard?.totalShares || 0,
                totalBookmarks: dashboard?.totalBookmarks || 0,
                engagementRate: dashboard?.engagementRate || 0,
                bounceRate: dashboard?.bounceRate || 0
            },
            trends: {
                views: [],
                engagement: []
            },
            demographics: {
                devices: dashboard?.viewsByDevice || [],
                browsers: dashboard?.viewsByBrowser || [],
                countries: dashboard?.viewsByCountry || []
            },
            realTime: {
                currentViewers: dashboard?.activeViewersCount || 0,
                recentActivity: dashboard?.recentActivity?.slice(0, 10) || []
            }
        };

        // Process trends data
        const eventTypes = ['view', 'like', 'comment', 'share', 'bookmark'];
        eventTypes.forEach(eventType => {
            const eventData = analytics.filter(a => a._id.event === eventType);
            processedData.trends[eventType] = eventData.map(d => ({
                date: d._id.date,
                count: d.count
            }));
        });

        res.json({ analytics: processedData });

    } catch (error) {
        console.error("Error getting blog analytics:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get user analytics
export const getUserAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = '30d' } = req.query;

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get user's blogs
        const userBlogs = await Blog.find({ user: userId, status: 'published' });

        // Get analytics for user's blogs
        const blogAnalytics = await Analytics.aggregate([
            {
                $match: {
                    blog: { $in: userBlogs.map(b => b._id) },
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        blog: '$blog',
                        event: '$event',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'blogs',
                    localField: '_id.blog',
                    foreignField: '_id',
                    as: 'blogInfo'
                }
            },
            { $unwind: '$blogInfo' }
        ]);

        // Get user engagement data
        const userEngagement = await Analytics.aggregate([
            {
                $match: {
                    user: userBlogs.map(b => b._id),
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        event: '$event',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        // Process data
        const analytics = {
            overview: {
                totalBlogs: userBlogs.length,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0
            },
            blogPerformance: [],
            trends: {
                views: [],
                engagement: []
            },
            topPerformingBlogs: []
        };

        // Calculate overview stats
        blogAnalytics.forEach(record => {
            const event = record._id.event;
            if (event === 'view') analytics.overview.totalViews += record.count;
            else if (event === 'like') analytics.overview.totalLikes += record.count;
            else if (event === 'comment') analytics.overview.totalComments += record.count;
            else if (event === 'share') analytics.overview.totalShares += record.count;
        });

        // Process trends
        const eventTypes = ['view', 'like', 'comment', 'share'];
        eventTypes.forEach(eventType => {
            const eventData = userEngagement.filter(a => a._id.event === eventType);
            analytics.trends[eventType] = eventData.map(d => ({
                date: d._id.date,
                count: d.count
            }));
        });

        // Get top performing blogs
        const blogStats = await Analytics.aggregate([
            {
                $match: {
                    blog: { $in: userBlogs.map(b => b._id) },
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$blog',
                    views: { $sum: { $cond: [{ $eq: ['$event', 'view'] }, 1, 0] } },
                    likes: { $sum: { $cond: [{ $eq: ['$event', 'like'] }, 1, 0] } },
                    comments: { $sum: { $cond: [{ $eq: ['$event', 'comment'] }, 1, 0] } },
                    shares: { $sum: { $cond: [{ $eq: ['$event', 'share'] }, 1, 0] } }
                }
            },
            {
                $lookup: {
                    from: 'blogs',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'blogInfo'
                }
            },
            { $unwind: '$blogInfo' },
            {
                $addFields: {
                    engagementScore: {
                        $add: ['$views', { $multiply: ['$likes', 3] }, { $multiply: ['$comments', 5] }, { $multiply: ['$shares', 7] }]
                    }
                }
            },
            { $sort: { engagementScore: -1 } },
            { $limit: 10 }
        ]);

        analytics.topPerformingBlogs = blogStats;

        res.json({ analytics });

    } catch (error) {
        console.error("Error getting user analytics:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get platform analytics (admin only)
export const getPlatformAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if user is admin
        const user = await User.findById(userId);
        if (user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { period = '30d' } = req.query;

        // Calculate date range
        const now = new Date();
        let startDate;
        switch (period) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get platform-wide analytics
        const platformStats = await Analytics.aggregate([
            { $match: { timestamp: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        event: '$event',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        // Get user growth
        const userGrowth = await User.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        role: '$role'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        // Get blog growth
        const blogGrowth = await Blog.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        status: '$status'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        // Process data
        const analytics = {
            overview: {
                totalUsers: await User.countDocuments(),
                totalBlogs: await Blog.countDocuments(),
                totalViews: 0,
                totalEngagement: 0
            },
            trends: {
                views: [],
                engagement: [],
                userGrowth: [],
                blogGrowth: []
            },
            userStats: {
                byRole: {},
                growth: userGrowth
            },
            blogStats: {
                byStatus: {},
                growth: blogGrowth
            }
        };

        // Calculate overview stats
        platformStats.forEach(record => {
            if (record._id.event === 'view') {
                analytics.overview.totalViews += record.count;
            } else {
                analytics.overview.totalEngagement += record.count;
            }
        });

        // Process trends
        const eventTypes = ['view', 'like', 'comment', 'share', 'bookmark'];
        eventTypes.forEach(eventType => {
            const eventData = platformStats.filter(a => a._id.event === eventType);
            analytics.trends[eventType] = eventData.map(d => ({
                date: d._id.date,
                count: d.count
            }));
        });

        // Process user stats by role
        const roleStats = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);
        roleStats.forEach(stat => {
            analytics.userStats.byRole[stat._id] = stat.count;
        });

        // Process blog stats by status
        const statusStats = await Blog.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        statusStats.forEach(stat => {
            analytics.blogStats.byStatus[stat._id] = stat.count;
        });

        res.json({ analytics });

    } catch (error) {
        console.error("Error getting platform analytics:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Clean up old analytics data
export const cleanupAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if user is admin
        const user = await User.findById(userId);
        if (user.role !== 'admin') {
            return res.status(403).json({ message: "Admin access required" });
        }

        // Clean up old analytics records (older than 1 year)
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const deletedAnalytics = await Analytics.deleteMany({
            timestamp: { $lt: oneYearAgo }
        });

        // Clean up old notification records
        const deletedNotifications = await Notification.cleanExpired();

        // Clean up inactive viewers
        const cleanedViewers = await AnalyticsDashboard.cleanInactiveViewers();

        res.json({
            message: "Cleanup completed successfully",
            deletedAnalytics: deletedAnalytics.deletedCount,
            cleanedViewers: cleanedViewers.modifiedCount
        });

    } catch (error) {
        console.error("Error cleaning up analytics:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
