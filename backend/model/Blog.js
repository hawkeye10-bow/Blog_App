import mongoose from "mongoose";

const Schema = mongoose.Schema;

const commentSchema = new Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    parentComment: {
        type: mongoose.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    replies: [{
        type: mongoose.Types.ObjectId,
        ref: 'Comment'
    }],
    likes: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const blogSchema = new Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        minlength: [3, 'Title must be at least 3 characters long'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minlength: [10, 'Description must be at least 10 characters long']
    },
    content: {
        type: String,
        required: [true, 'Content is required'],
        trim: true
    },
    excerpt: {
        type: String,
        maxlength: 300,
        trim: true
    },
    image: {
        type: String,
        required: [true, 'Image URL is required'],
        trim: true
    },
    images: [{
        url: String,
        caption: String,
        alt: String
    }],
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required'],
        index: true
    },
    category: {
        type: String,
        required: true,
        trim: true,
        default: 'General'
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    hashtags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    status: {
        type: String,
        enum: ['draft', 'published', 'archived', 'pending_approval'],
        default: 'draft'
    },
    publishedAt: {
        type: Date
    },
    scheduledFor: {
        type: Date
    },
    views: {
        type: Number,
        default: 0,
        min: 0
    },
    uniqueViews: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        viewedAt: {
            type: Date,
            default: Date.now
        },
        ipAddress: String,
        userAgent: String
    }],
    likes: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    shares: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        platform: {
            type: String,
            enum: ['facebook', 'twitter', 'linkedin', 'whatsapp', 'email', 'copy']
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    comments: [commentSchema],
    reactions: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        type: {
            type: String,
            enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry'],
            default: 'like'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    readingTime: {
        type: Number,
        default: 1
    },
    seoTitle: {
        type: String,
        maxlength: 60
    },
    seoDescription: {
        type: String,
        maxlength: 160
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true
    },
    featured: {
        type: Boolean,
        default: false
    },
    allowComments: {
        type: Boolean,
        default: true
    },
    isCollaborative: {
        type: Boolean,
        default: false
    },
    collaborators: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['editor', 'viewer'],
            default: 'viewer'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    editHistory: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        changes: {
            type: String
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    analytics: {
        totalViews: { type: Number, default: 0 },
        uniqueViews: { type: Number, default: 0 },
        totalShares: { type: Number, default: 0 },
        totalComments: { type: Number, default: 0 },
        totalLikes: { type: Number, default: 0 },
        avgReadingTime: { type: Number, default: 0 },
        bounceRate: { type: Number, default: 0 },
        engagementRate: { type: Number, default: 0 }
    },
    lastViewed: {
        type: Date,
        default: Date.now
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for like count
blogSchema.virtual('likeCount').get(function() {
    return this.likes ? this.likes.length : 0;
});

// Virtual for comment count
blogSchema.virtual('commentCount').get(function() {
    return this.comments ? this.comments.filter(c => !c.isDeleted).length : 0;
});

// Virtual for share count
blogSchema.virtual('shareCount').get(function() {
    return this.shares ? this.shares.length : 0;
});

// Virtual for reading time estimation
blogSchema.virtual('estimatedReadingTime').get(function() {
    const wordsPerMinute = 200;
    const wordCount = this.content ? this.content.split(' ').length : this.description.split(' ').length;
    const readingTime = Math.ceil(wordCount / wordsPerMinute);
    return readingTime < 1 ? 1 : readingTime;
});

// Virtual for engagement score
blogSchema.virtual('engagementScore').get(function() {
    const likes = this.likes ? this.likes.length : 0;
    const comments = this.comments ? this.comments.filter(c => !c.isDeleted).length : 0;
    const shares = this.shares ? this.shares.length : 0;
    const views = this.views || 0;
    
    if (views === 0) return 0;
    return ((likes * 3 + comments * 5 + shares * 7) / views * 100).toFixed(2);
});

// Generate slug from title
blogSchema.pre('save', function(next) {
    if (this.isModified('title') || this.isNew) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
        
        // Ensure uniqueness
        const timestamp = Date.now();
        this.slug = `${this.slug}-${timestamp}`;
    }
    
    if (this.isModified() && !this.isNew) {
        this.updatedAt = new Date();
    }
    
    // Calculate reading time
    if (this.isModified('content') || this.isModified('description')) {
        const text = this.content || this.description;
        const wordsPerMinute = 200;
        const wordCount = text.split(' ').length;
        this.readingTime = Math.ceil(wordCount / wordsPerMinute);
    }
    
    // Generate excerpt if not provided
    if (!this.excerpt && this.content) {
        this.excerpt = this.content.substring(0, 300) + '...';
    }
    
    // Set published date when status changes to published
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    
    next();
});

// Index for search functionality
blogSchema.index({ title: 'text', description: 'text', content: 'text', tags: 'text' });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ publishedAt: -1 });
blogSchema.index({ user: 1, createdAt: -1 });
blogSchema.index({ status: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ slug: 1 });
blogSchema.index({ featured: 1 });

// Compound indexes for better query performance
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1, publishedAt: -1 });
blogSchema.index({ user: 1, status: 1 });

export default mongoose.model("Blog", blogSchema);