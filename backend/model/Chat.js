import mongoose from "mongoose";

const Schema = mongoose.Schema;

const messageSchema = new Schema({
    sender: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'file', 'link', 'emoji'],
        default: 'text'
    },
    mediaUrl: {
        type: String,
        trim: true
    },
    fileName: {
        type: String,
        trim: true
    },
    fileSize: {
        type: Number
    },
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
    readBy: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    reactions: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        },
        emoji: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    replyTo: {
        type: mongoose.Types.ObjectId,
        ref: 'Message'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

const chatSchema = new Schema({
    participants: [{
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'member'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        lastSeen: {
            type: Date,
            default: Date.now
        },
        isOnline: {
            type: Boolean,
            default: false
        },
        isMuted: {
            type: Boolean,
            default: false
        },
        isBlocked: {
            type: Boolean,
            default: false
        }
    }],
    chatType: {
        type: String,
        enum: ['direct', 'group'],
        default: 'direct',
        required: true
    },
    name: {
        type: String,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    avatar: {
        type: String,
        trim: true
    },
    messages: [messageSchema],
    lastMessage: {
        type: mongoose.Types.ObjectId,
        ref: 'Message'
    },
    lastActivity: {
        type: Date,
        default: Date.now,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    pinnedMessages: [{
        type: mongoose.Types.ObjectId,
        ref: 'Message'
    }],
    settings: {
        allowMedia: {
            type: Boolean,
            default: true
        },
        allowFiles: {
            type: Boolean,
            default: true
        },
        maxFileSize: {
            type: Number,
            default: 10 * 1024 * 1024 // 10MB
        },
        allowedFileTypes: [{
            type: String
        }],
        autoDelete: {
            type: Boolean,
            default: false
        },
        autoDeleteAfter: {
            type: Number, // days
            default: 30
        }
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

// Virtual for unread message count per user
chatSchema.virtual('unreadCount').get(function() {
    return this.messages ? this.messages.filter(m => !m.isDeleted).length : 0;
});

// Virtual for participant count
chatSchema.virtual('participantCount').get(function() {
    return this.participants ? this.participants.length : 0;
});

// Virtual for chat display name
chatSchema.virtual('displayName').get(function() {
    if (this.chatType === 'group' && this.name) {
        return this.name;
    }
    return 'Direct Chat';
});

// Pre-save middleware
chatSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = new Date();
    }
    
    // Update last activity when new message is added
    if (this.isModified('messages') && this.messages.length > 0) {
        this.lastActivity = new Date();
        this.lastMessage = this.messages[this.messages.length - 1]._id;
    }
    
    next();
});

// Indexes for better query performance
chatSchema.index({ 'participants.user': 1, lastActivity: -1 });
chatSchema.index({ chatType: 1, lastActivity: -1 });
chatSchema.index({ isActive: 1, lastActivity: -1 });
chatSchema.index({ 'messages.createdAt': -1 });

// Compound indexes
chatSchema.index({ 'participants.user': 1, isActive: 1 });
chatSchema.index({ chatType: 1, isActive: 1, lastActivity: -1 });

// Methods
chatSchema.methods.addMessage = function(senderId, content, messageType = 'text', mediaUrl = null) {
    const message = {
        sender: senderId,
        content,
        messageType,
        mediaUrl,
        readBy: [{ user: senderId, readAt: new Date() }]
    };
    
    this.messages.push(message);
    this.lastActivity = new Date();
    this.lastMessage = this.messages[this.messages.length - 1]._id;
    
    return this.save();
};

chatSchema.methods.markAsRead = function(userId, messageId = null) {
    if (messageId) {
        // Mark specific message as read
        const message = this.messages.id(messageId);
        if (message && !message.readBy.some(read => read.user.toString() === userId)) {
            message.readBy.push({ user: userId, readAt: new Date() });
        }
    } else {
        // Mark all messages as read
        this.messages.forEach(message => {
            if (!message.readBy.some(read => read.user.toString() === userId)) {
                message.readBy.push({ user: userId, readAt: new Date() });
            }
        });
    }
    
    // Update participant's last seen
    const participant = this.participants.find(p => p.user.toString() === userId);
    if (participant) {
        participant.lastSeen = new Date();
    }
    
    return this.save();
};

chatSchema.methods.addParticipant = function(userId, role = 'member') {
    if (!this.participants.some(p => p.user.toString() === userId)) {
        this.participants.push({
            user: userId,
            role,
            joinedAt: new Date(),
            lastSeen: new Date()
        });
        return this.save();
    }
    return Promise.resolve(this);
};

chatSchema.methods.removeParticipant = function(userId) {
    this.participants = this.participants.filter(p => p.user.toString() !== userId);
    return this.save();
};

chatSchema.methods.updateParticipantStatus = function(userId, isOnline) {
    const participant = this.participants.find(p => p.user.toString() === userId);
    if (participant) {
        participant.isOnline = isOnline;
        participant.lastSeen = new Date();
        return this.save();
    }
    return Promise.resolve(this);
};

export default mongoose.model("Chat", chatSchema);
