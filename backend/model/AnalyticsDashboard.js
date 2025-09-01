import mongoose from "mongoose";

const Schema = mongoose.Schema;

const pageViewSchema = new Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    duration: Number, // in seconds
    scrollDepth: Number, // percentage
    bounce: {
        type: Boolean,
        default: false
    }
});

const userEngagementSchema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    sessionId: String,
    pageViews: [pageViewSchema],
    totalTime: Number, // in seconds
    actions: [{
        type: {
            type: String,
            enum: ['like', 'comment', 'share', 'bookmark', 'follow', 'search']
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        metadata: Schema.Types.Mixed
    }]
});

const analyticsDashboardSchema = new Schema({
    blog: {
        type: mongoose.Types.ObjectId,
        ref: 'Blog',
        required: true,
        index: true
    },
    // Real-time metrics
    currentViewers: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        lastActivity: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Engagement metrics
    totalViews: {
        type: Number,
        default: 0
    },
    uniqueViews: {
        type: Number,
        default: 0
    },
    totalLikes: {
        type: Number,
        default: 0
    },
    totalComments: {
        type: Number,
        default: 0
    },
    totalShares: {
        type: Number,
        default: 0
    },
    totalBookmarks: {
        type: Number,
        default: 0
    },
    
    // Time-based analytics
    viewsByHour: [{
        hour: Number, // 0-23
        count: Number
    }],
    viewsByDay: [{
        day: Number, // 0-6 (Sunday = 0)
        count: Number
    }],
    viewsByMonth: [{
        month: Number, // 1-12
        year: Number,
        count: Number
    }],
    
    // Geographic analytics
    viewsByCountry: [{
        country: String,
        count: Number,
        percentage: Number
    }],
    viewsByCity: [{
        city: String,
        country: String,
        count: Number
    }],
    
    // Device analytics
    viewsByDevice: [{
        device: String, // mobile, tablet, desktop
        count: Number,
        percentage: Number
    }],
    viewsByBrowser: [{
        browser: String,
        count: Number,
        percentage: Number
    }],
    viewsByOS: [{
        os: String,
        count: Number,
        percentage: Number
    }],
    
    // Content performance
    averageReadingTime: {
        type: Number,
        default: 0
    },
    bounceRate: {
        type: Number,
        default: 0
    },
    engagementRate: {
        type: Number,
        default: 0
    },
    
    // Social media analytics
    socialShares: [{
        platform: {
            type: String,
            enum: ['facebook', 'twitter', 'linkedin', 'whatsapp', 'email', 'copy']
        },
        count: Number,
        lastShared: Date
    }],
    
    // Referrer analytics
    referrers: [{
        source: String,
        count: Number,
        percentage: Number
    }],
    
    // User engagement details
    userEngagement: [userEngagementSchema],
    
    // Real-time activity
    recentActivity: [{
        type: {
            type: String,
            enum: ['view', 'like', 'comment', 'share', 'bookmark']
        },
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        metadata: Schema.Types.Mixed
    }],
    
    // Performance metrics
    pageLoadTime: {
        average: Number,
        samples: [Number]
    },
    seoScore: {
        type: Number,
        min: 0,
        max: 100
    },
    
    // Heatmap data
    clickHeatmap: [{
        x: Number,
        y: Number,
        count: Number
    }],
    scrollHeatmap: [{
        depth: Number, // percentage
        count: Number
    }],
    
    // A/B testing data
    abTestResults: [{
        variant: String,
        views: Number,
        conversions: Number,
        conversionRate: Number
    }],
    
    lastUpdated: {
        type: Date,
        default: Date.now,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for real-time viewer count
analyticsDashboardSchema.virtual('activeViewersCount').get(function() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    return this.currentViewers.filter(viewer => 
        viewer.lastActivity > fiveMinutesAgo
    ).length;
});

// Virtual for engagement score
analyticsDashboardSchema.virtual('engagementScore').get(function() {
    const totalInteractions = this.totalLikes + this.totalComments + this.totalShares + this.totalBookmarks;
    const totalViews = this.totalViews || 1;
    
    return ((totalInteractions / totalViews) * 100).toFixed(2);
});

// Virtual for trending score
analyticsDashboardSchema.virtual('trendingScore').get(function() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentViews = this.recentActivity.filter(activity => 
        activity.type === 'view' && activity.timestamp > oneDayAgo
    ).length;
    
    const recentEngagement = this.recentActivity.filter(activity => 
        ['like', 'comment', 'share', 'bookmark'].includes(activity.type) && 
        activity.timestamp > oneDayAgo
    ).length;
    
    return (recentViews * 0.3 + recentEngagement * 0.7).toFixed(2);
});

// Indexes for efficient querying
analyticsDashboardSchema.index({ blog: 1, lastUpdated: -1 });
analyticsDashboardSchema.index({ createdAt: -1 });
analyticsDashboardSchema.index({ 'currentViewers.user': 1 });

// Compound indexes
analyticsDashboardSchema.index({ blog: 1, createdAt: -1 });

// Pre-save middleware
analyticsDashboardSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    
    // Calculate engagement rate
    if (this.totalViews > 0) {
        this.engagementRate = ((this.totalLikes + this.totalComments + this.totalShares + this.totalBookmarks) / this.totalViews * 100);
    }
    
    // Calculate bounce rate
    if (this.userEngagement && this.userEngagement.length > 0) {
        const bounces = this.userEngagement.filter(engagement => 
            engagement.pageViews.length === 1 && engagement.pageViews[0].bounce
        ).length;
        this.bounceRate = (bounces / this.userEngagement.length) * 100;
    }
    
    next();
});

// Static method to get real-time analytics
analyticsDashboardSchema.statics.getRealTimeAnalytics = function(blogId) {
    return this.findOne({ blog: blogId })
        .populate('currentViewers.user', 'name profile.profilePicture')
        .populate('recentActivity.user', 'name profile.profilePicture')
        .select('currentViewers recentActivity totalViews totalLikes totalComments totalShares totalBookmarks');
};

// Static method to update viewer activity
analyticsDashboardSchema.statics.updateViewerActivity = function(blogId, userId) {
    return this.findOneAndUpdate(
        { blog: blogId },
        {
            $push: {
                currentViewers: {
                    user: userId,
                    joinedAt: new Date(),
                    lastActivity: new Date()
                }
            }
        },
        { upsert: true, new: true }
    );
};

// Static method to remove inactive viewers
analyticsDashboardSchema.statics.cleanInactiveViewers = function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return this.updateMany(
        {},
        {
            $pull: {
                currentViewers: {
                    lastActivity: { $lt: fiveMinutesAgo }
                }
            }
        }
    );
};

export default mongoose.model("AnalyticsDashboard", analyticsDashboardSchema);
