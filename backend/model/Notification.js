import mongoose from "mongoose";

const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    recipient: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: [
            'like', 'comment', 'follow', 'new_post', 'mention', 
            'blog_approved', 'blog_rejected', 'comment_reply',
            'collaboration_invite', 'poll_vote', 'share'
        ],
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    data: {
        blog: {
            type: mongoose.Types.ObjectId,
            ref: 'Blog'
        },
        comment: {
            type: mongoose.Types.ObjectId
        },
        poll: {
            type: mongoose.Types.ObjectId,
            ref: 'Poll'
        },
        metadata: Schema.Types.Mixed
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    isEmailSent: {
        type: Boolean,
        default: false
    },
    isPushSent: {
        type: Boolean,
        default: false
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    expiresAt: {
        type: Date,
        default: function() {
            // Notifications expire after 30 days
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
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

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function() {
    const now = new Date();
    const diffInSeconds = Math.floor((now - this.createdAt) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
});

// Indexes for efficient querying
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 });

// Compound indexes
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, priority: 1, createdAt: -1 });

// Pre-save middleware
notificationSchema.pre('save', function(next) {
    // Auto-expire old notifications
    if (this.expiresAt && this.expiresAt < new Date()) {
        this.isRead = true;
    }
    next();
});

// Static method to create notification
notificationSchema.statics.createNotification = function(data) {
    return this.create(data);
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = function(recipientId, notificationIds) {
    const query = { recipient: recipientId };
    if (notificationIds && notificationIds.length > 0) {
        query._id = { $in: notificationIds };
    }
    
    return this.updateMany(query, { isRead: true });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(recipientId) {
    return this.countDocuments({ recipient: recipientId, isRead: false });
};

// Static method to clean expired notifications
notificationSchema.statics.cleanExpired = function() {
    return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

export default mongoose.model("Notification", notificationSchema);
