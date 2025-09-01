import mongoose from "mongoose";

const Schema = mongoose.Schema;

const analyticsSchema = new Schema({
    blog: {
        type: mongoose.Types.ObjectId,
        ref: 'Blog',
        required: function() {
            // Blog is required for all events except search
            return this.event !== 'search';
        },
        index: true
    },
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    event: {
        type: String,
        enum: ['view', 'like', 'share', 'comment', 'bookmark', 'click', 'search', 'unlike'],
        required: true
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        referrer: String,
        country: String,
        city: String,
        device: String,
        browser: String,
        os: String,
        timeOnPage: Number, // in seconds
        scrollDepth: Number, // percentage
        clickPosition: {
            x: Number,
            y: Number
        },
        // Additional fields for search events
        searchQuery: String,
        resultsCount: Number
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Indexes for analytics queries
analyticsSchema.index({ blog: 1, event: 1, timestamp: -1 });
analyticsSchema.index({ user: 1, event: 1, timestamp: -1 });
analyticsSchema.index({ event: 1, timestamp: -1 });
analyticsSchema.index({ timestamp: -1 });

// Compound indexes for complex queries
analyticsSchema.index({ blog: 1, timestamp: -1 });
analyticsSchema.index({ user: 1, timestamp: -1 });

export default mongoose.model("Analytics", analyticsSchema);