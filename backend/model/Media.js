import mongoose from "mongoose";

const Schema = mongoose.Schema;

const mediaSchema = new Schema({
    filename: {
        type: String,
        required: true,
        trim: true
    },
    originalName: {
        type: String,
        required: true,
        trim: true
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    thumbnailUrl: {
        type: String,
        trim: true
    },
    alt: {
        type: String,
        maxlength: 200,
        trim: true
    },
    caption: {
        type: String,
        maxlength: 500,
        trim: true
    },
    type: {
        type: String,
        enum: ['image', 'video', 'document', 'audio'],
        required: true
    },
    dimensions: {
        width: Number,
        height: Number
    },
    duration: Number, // for video/audio in seconds
    metadata: {
        exif: Schema.Types.Mixed,
        colors: [String],
        dominantColor: String,
        tags: [String]
    },
    uploadedBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    blog: {
        type: mongoose.Types.ObjectId,
        ref: 'Blog'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    isProcessed: {
        type: Boolean,
        default: false
    },
    processingStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    storageProvider: {
        type: String,
        enum: ['local', 'aws_s3', 'cloudinary', 'firebase'],
        default: 'local'
    },
    storagePath: {
        type: String,
        trim: true
    },
    cdnUrl: {
        type: String,
        trim: true
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    usageCount: {
        type: Number,
        default: 0
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

// Virtual for file size in human readable format
mediaSchema.virtual('sizeFormatted').get(function() {
    const bytes = this.size;
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for media type icon
mediaSchema.virtual('typeIcon').get(function() {
    const icons = {
        image: '🖼️',
        video: '🎥',
        document: '📄',
        audio: '🎵'
    };
    return icons[this.type] || '📎';
});

// Virtual for isImage
mediaSchema.virtual('isImage').get(function() {
    return this.type === 'image';
});

// Virtual for isVideo
mediaSchema.virtual('isVideo').get(function() {
    return this.type === 'video';
});

// Indexes for efficient querying
mediaSchema.index({ uploadedBy: 1, createdAt: -1 });
mediaSchema.index({ type: 1, createdAt: -1 });
mediaSchema.index({ blog: 1 });
mediaSchema.index({ tags: 1 });
mediaSchema.index({ isPublic: 1, type: 1 });
mediaSchema.index({ filename: 'text', originalName: 'text', tags: 'text' });

// Compound indexes
mediaSchema.index({ uploadedBy: 1, type: 1, createdAt: -1 });
mediaSchema.index({ isPublic: 1, type: 1, createdAt: -1 });

// Pre-save middleware
mediaSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = new Date();
    }
    
    // Auto-generate alt text if not provided
    if (!this.alt && this.originalName) {
        this.alt = this.originalName.replace(/\.[^/.]+$/, ''); // Remove file extension
    }
    
    next();
});

// Static method to get media by type
mediaSchema.statics.getByType = function(type, limit = 20) {
    return this.find({ type, isPublic: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('uploadedBy', 'name profile.profilePicture');
};

// Static method to search media
mediaSchema.statics.search = function(query, limit = 20) {
    return this.find({
        $and: [
            { isPublic: true },
            {
                $or: [
                    { filename: { $regex: query, $options: 'i' } },
                    { originalName: { $regex: query, $options: 'i' } },
                    { tags: { $in: [new RegExp(query, 'i')] } }
                ]
            }
        ]
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('uploadedBy', 'name profile.profilePicture');
};

// Static method to get user media
mediaSchema.statics.getUserMedia = function(userId, type = null, limit = 20) {
    const query = { uploadedBy: userId };
    if (type) query.type = type;
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Method to increment usage count
mediaSchema.methods.incrementUsage = function() {
    this.usageCount += 1;
    return this.save();
};

export default mongoose.model("Media", mediaSchema);
