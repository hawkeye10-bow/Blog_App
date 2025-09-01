import mongoose from "mongoose";

const Schema = mongoose.Schema;

const pollOptionSchema = new Schema({
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    votes: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            required: true
        },
        votedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isCorrect: {
        type: Boolean,
        default: false
    }
});

const pollSchema = new Schema({
    blog: {
        type: mongoose.Types.ObjectId,
        ref: 'Blog',
        required: true,
        index: true
    },
    question: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    type: {
        type: String,
        enum: ['single_choice', 'multiple_choice', 'quiz', 'rating', 'open_ended'],
        default: 'single_choice'
    },
    options: [pollOptionSchema],
    allowMultipleVotes: {
        type: Boolean,
        default: false
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date
    },
    totalVotes: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
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

// Virtual for total votes
pollSchema.virtual('totalVoteCount').get(function() {
    return this.totalVotes;
});

// Virtual for option vote counts
pollSchema.virtual('optionVoteCounts').get(function() {
    return this.options.map(option => ({
        text: option.text,
        votes: option.votes.length,
        percentage: this.totalVotes > 0 ? ((option.votes.length / this.totalVotes) * 100).toFixed(1) : 0
    }));
});

// Pre-save middleware
pollSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = new Date();
    }
    
    // Calculate total votes
    this.totalVotes = this.options.reduce((total, option) => total + option.votes.length, 0);
    
    next();
});

// Indexes
pollSchema.index({ blog: 1, isActive: 1 });
pollSchema.index({ createdBy: 1, createdAt: -1 });
pollSchema.index({ expiresAt: 1, isActive: 1 });
pollSchema.index({ createdAt: -1 });

export default mongoose.model("Poll", pollSchema);
