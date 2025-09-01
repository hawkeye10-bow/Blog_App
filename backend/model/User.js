import mongoose from "mongoose";

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'Please provide a valid email address'
        },
        index: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    role: {
        type: String,
        enum: ['admin', 'author', 'reader'],
        default: 'reader',
        required: true
    },
    blogs: [{
        type: mongoose.Types.ObjectId, 
        ref: 'Blog'
    }],
    profile: {
        bio: {
            type: String,
            maxlength: [500, 'Bio cannot exceed 500 characters'],
            trim: true,
            default: ''
        },
        profilePicture: {
            type: String,
            trim: true,
            default: ''
        },
        website: {
            type: String,
            trim: true,
            default: ''
        },
        location: {
            type: String,
            trim: true,
            maxlength: [100, 'Location cannot exceed 100 characters'],
            default: ''
        },
        socialLinks: {
            twitter: { type: String, trim: true, default: '' },
            linkedin: { type: String, trim: true, default: '' },
            github: { type: String, trim: true, default: '' },
            instagram: { type: String, trim: true, default: '' },
            facebook: { type: String, trim: true, default: '' }
        }
    },
    preferences: {
        emailNotifications: {
            type: Boolean,
            default: true
        },
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'light'
        },
        language: {
            type: String,
            default: 'en'
        }
    },
    bookmarks: [{
        type: mongoose.Types.ObjectId,
        ref: 'Blog'
    }],
    following: [{
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }],
    followers: [{
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }],
    notifications: [{
        type: {
            type: String,
            enum: ['like', 'comment', 'follow', 'new_post', 'mention'],
            required: true
        },
        message: {
            type: String,
            required: true
        },
        from: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        blog: {
            type: mongoose.Types.ObjectId,
            ref: 'Blog'
        },
        read: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    lastActive: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        default: null
    },
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.verificationToken;
            delete ret.resetPasswordToken;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Virtual for blog count
userSchema.virtual('blogCount').get(function() {
    return this.blogs ? this.blogs.length : 0;
});

// Virtual for follower count
userSchema.virtual('followerCount').get(function() {
    return this.followers ? this.followers.length : 0;
});

// Virtual for following count
userSchema.virtual('followingCount').get(function() {
    return this.following ? this.following.length : 0;
});

// Virtual for user initials
userSchema.virtual('initials').get(function() {
    if (!this.name) return '';
    const initials = this.name.split(' ').map(word => word[0]).join('');
    return initials.substring(0, 2).toUpperCase();
});

// Virtual for unread notifications count
userSchema.virtual('unreadNotificationsCount').get(function() {
    return this.notifications ? this.notifications.filter(n => !n.read).length : 0;
});

// Index for search functionality
userSchema.index({ name: 'text', 'profile.bio': 'text' });
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Pre-save middleware to update the updatedAt field
userSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = new Date();
    }
    next();
});

// Method to update last active timestamp
userSchema.methods.updateLastActive = function() {
    this.lastActive = new Date();
    return this.save();
};

// Method to add notification
userSchema.methods.addNotification = function(type, message, from, blog) {
    // Initialize notifications array if it doesn't exist
    if (!this.notifications) {
        this.notifications = [];
    }
    
    this.notifications.unshift({
        type,
        message,
        from,
        blog,
        createdAt: new Date()
    });
    
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
        this.notifications = this.notifications.slice(0, 50);
    }
    
    return this.save();
};

// Method to mark notifications as read
userSchema.methods.markNotificationsAsRead = function(notificationIds) {
    // Initialize notifications array if it doesn't exist
    if (!this.notifications) {
        this.notifications = [];
    }
    
    if (notificationIds && notificationIds.length > 0) {
        this.notifications.forEach(notification => {
            if (notificationIds.includes(notification._id.toString())) {
                notification.read = true;
            }
        });
    } else {
        // Mark all as read
        this.notifications.forEach(notification => {
            notification.read = true;
        });
    }
    return this.save();
};

export default mongoose.model("User", userSchema);