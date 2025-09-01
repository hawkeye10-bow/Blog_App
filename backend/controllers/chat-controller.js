import Chat from "../model/Chat.js";
import User from "../model/User.js";
import mongoose from "mongoose";

// Get all chats for a user
export const getUserChats = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const chats = await Chat.find({
            'participants.user': userId,
            isActive: true
        })
        .populate('participants.user', 'name email profile.profilePicture isOnline lastActive')
        .populate('lastMessage')
        .populate('messages.sender', 'name profile.profilePicture')
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limit);

        const totalChats = await Chat.countDocuments({
            'participants.user': userId,
            isActive: true
        });

        // Calculate unread counts for each chat
        const chatsWithUnreadCounts = chats.map(chat => {
            const userParticipant = chat.participants.find(p => p.user._id.toString() === userId);
            const unreadCount = chat.messages.filter(message => 
                !message.isDeleted && 
                !message.readBy.some(read => read.user.toString() === userId) &&
                message.sender.toString() !== userId
            ).length;

            return {
                ...chat.toObject(),
                unreadCount,
                lastSeen: userParticipant?.lastSeen
            };
        });

        return res.status(200).json({
            chats: chatsWithUnreadCounts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalChats / limit),
                totalChats,
                hasNext: page < Math.ceil(totalChats / limit),
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error fetching user chats:', err);
        return res.status(500).json({
            message: 'Failed to fetch chats',
            error: err.message
        });
    }
};

// Get a specific chat with messages
export const getChat = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        })
        .populate('participants.user', 'name email profile.profilePicture isOnline lastActive')
        .populate('messages.sender', 'name profile.profilePicture')
        .populate('messages.replyTo')
        .populate('pinnedMessages');

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        // Mark messages as read
        await chat.markAsRead(userId);

        // Update participant's last seen
        await chat.updateParticipantStatus(userId, true);

        return res.status(200).json({
            chat
        });
    } catch (err) {
        console.error('Error fetching chat:', err);
        return res.status(500).json({
            message: 'Failed to fetch chat',
            error: err.message
        });
    }
};

// Create a new chat (direct or group)
export const createChat = async (req, res, next) => {
    try {
        const { participants, chatType, name, description } = req.body;
        const userId = req.user._id;

        if (!participants || participants.length === 0) {
            return res.status(400).json({
                message: 'At least one participant is required'
            });
        }

        // For direct chat, check if chat already exists
        if (chatType === 'direct' && participants.length === 1) {
            const existingChat = await Chat.findOne({
                chatType: 'direct',
                'participants.user': { $all: [userId, participants[0]] },
                isActive: true
            });

            if (existingChat) {
                return res.status(200).json({
                    message: 'Chat already exists',
                    chat: existingChat
                });
            }
        }

        // Validate participants exist
        const participantUsers = await User.find({
            _id: { $in: participants }
        });

        if (participantUsers.length !== participants.length) {
            return res.status(400).json({
                message: 'Some participants do not exist'
            });
        }

        const chatData = {
            participants: [
                { user: userId, role: 'admin' },
                ...participants.map(p => ({ user: p, role: 'member' }))
            ],
            chatType,
            isActive: true
        };

        if (chatType === 'group') {
            if (!name) {
                return res.status(400).json({
                    message: 'Group name is required'
                });
            }
            chatData.name = name;
            chatData.description = description;
        }

        const chat = new Chat(chatData);
        await chat.save();

        const populatedChat = await Chat.findById(chat._id)
            .populate('participants.user', 'name email profile.profilePicture isOnline lastActive');

        // Emit real-time event
        if (req.io) {
            participants.forEach(participantId => {
                req.io.to(`user-${participantId}`).emit('new-chat', {
                    chat: populatedChat
                });
            });
        }

        return res.status(201).json({
            message: 'Chat created successfully',
            chat: populatedChat
        });
    } catch (err) {
        console.error('Error creating chat:', err);
        return res.status(500).json({
            message: 'Failed to create chat',
            error: err.message
        });
    }
};

// Send a message
export const sendMessage = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { content, messageType, mediaUrl, fileName, fileSize, replyTo } = req.body;
        const userId = req.user._id;

        if (!content && !mediaUrl) {
            return res.status(400).json({
                message: 'Message content or media is required'
            });
        }

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        // Check if user is blocked
        const userParticipant = chat.participants.find(p => p.user.toString() === userId);
        if (userParticipant?.isBlocked) {
            return res.status(403).json({
                message: 'You are blocked from sending messages in this chat'
            });
        }

        const messageData = {
            sender: userId,
            content: content || '',
            messageType: messageType || 'text',
            readBy: [{ user: userId, readAt: new Date() }]
        };

        if (mediaUrl) {
            messageData.mediaUrl = mediaUrl;
            messageData.fileName = fileName;
            messageData.fileSize = fileSize;
        }

        if (replyTo) {
            messageData.replyTo = replyTo;
        }

        chat.messages.push(messageData);
        chat.lastActivity = new Date();
        chat.lastMessage = chat.messages[chat.messages.length - 1]._id;

        await chat.save();

        const populatedChat = await Chat.findById(chatId)
            .populate('messages.sender', 'name profile.profilePicture')
            .populate('messages.replyTo')
            .populate('participants.user', 'name email profile.profilePicture isOnline lastActive');

        const newMessage = populatedChat.messages[populatedChat.messages.length - 1];

        // Emit real-time message to all participants
        if (req.io) {
            chat.participants.forEach(participant => {
                if (participant.user.toString() !== userId) {
                    req.io.to(`user-${participant.user}`).emit('new-message', {
                        chatId,
                        message: newMessage,
                        sender: req.user
                    });
                }
            });

            // Emit typing stopped event
            req.io.to(`chat-${chatId}`).emit('typing-stopped', {
                chatId,
                userId
            });
        }

        return res.status(201).json({
            message: 'Message sent successfully',
            message: newMessage
        });
    } catch (err) {
        console.error('Error sending message:', err);
        return res.status(500).json({
            message: 'Failed to send message',
            error: err.message
        });
    }
};

// Edit a message
export const editMessage = async (req, res, next) => {
    try {
        const { chatId, messageId } = req.params;
        const { content } = req.body;
        const userId = req.user._id;

        if (!content) {
            return res.status(400).json({
                message: 'Message content is required'
            });
        }

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).json({
                message: 'Message not found'
            });
        }

        if (message.sender.toString() !== userId) {
            return res.status(403).json({
                message: 'You can only edit your own messages'
            });
        }

        message.content = content;
        message.isEdited = true;
        message.editedAt = new Date();

        await chat.save();

        // Emit real-time update
        if (req.io) {
            chat.participants.forEach(participant => {
                if (participant.user.toString() !== userId) {
                    req.io.to(`user-${participant.user}`).emit('message-edited', {
                        chatId,
                        messageId,
                        content,
                        editedAt: message.editedAt
                    });
                }
            });
        }

        return res.status(200).json({
            message: 'Message edited successfully',
            message: message
        });
    } catch (err) {
        console.error('Error editing message:', err);
        return res.status(500).json({
            message: 'Failed to edit message',
            error: err.message
        });
    }
};

// Delete a message
export const deleteMessage = async (req, res, next) => {
    try {
        const { chatId, messageId } = req.params;
        const userId = req.user._id;

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).json({
                message: 'Message not found'
            });
        }

        if (message.sender.toString() !== userId) {
            return res.status(403).json({
                message: 'You can only delete your own messages'
            });
        }

        message.isDeleted = true;
        message.deletedAt = new Date();

        await chat.save();

        // Emit real-time update
        if (req.io) {
            chat.participants.forEach(participant => {
                if (participant.user.toString() !== userId) {
                    req.io.to(`user-${participant.user}`).emit('message-deleted', {
                        chatId,
                        messageId
                    });
                }
            });
        }

        return res.status(200).json({
            message: 'Message deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting message:', err);
        return res.status(500).json({
            message: 'Failed to delete message',
            error: err.message
        });
    }
};

// Mark messages as read
export const markAsRead = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { messageId } = req.body;
        const userId = req.user._id;

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        await chat.markAsRead(userId, messageId);

        // Emit read receipt
        if (req.io) {
            chat.participants.forEach(participant => {
                if (participant.user.toString() !== userId) {
                    req.io.to(`user-${participant.user}`).emit('messages-read', {
                        chatId,
                        userId,
                        readAt: new Date()
                    });
                }
            });
        }

        return res.status(200).json({
            message: 'Messages marked as read'
        });
    } catch (err) {
        console.error('Error marking messages as read:', err);
        return res.status(500).json({
            message: 'Failed to mark messages as read',
            error: err.message
        });
    }
};

// Add reaction to message
export const addReaction = async (req, res, next) => {
    try {
        const { chatId, messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;

        if (!emoji) {
            return res.status(400).json({
                message: 'Emoji is required'
            });
        }

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).json({
                message: 'Message not found'
            });
        }

        // Remove existing reaction from this user
        message.reactions = message.reactions.filter(
            reaction => reaction.user.toString() !== userId
        );

        // Add new reaction
        message.reactions.push({
            user: userId,
            emoji,
            createdAt: new Date()
        });

        await chat.save();

        // Emit real-time update
        if (req.io) {
            chat.participants.forEach(participant => {
                req.io.to(`user-${participant.user}`).emit('reaction-added', {
                    chatId,
                    messageId,
                    reaction: {
                        user: userId,
                        emoji,
                        createdAt: new Date()
                    }
                });
            });
        }

        return res.status(200).json({
            message: 'Reaction added successfully',
            reactions: message.reactions
        });
    } catch (err) {
        console.error('Error adding reaction:', err);
        return res.status(500).json({
            message: 'Failed to add reaction',
            error: err.message
        });
    }
};

// Remove reaction from message
export const removeReaction = async (req, res, next) => {
    try {
        const { chatId, messageId } = req.params;
        const userId = req.user._id;

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).json({
                message: 'Message not found'
            });
        }

        // Remove user's reaction
        message.reactions = message.reactions.filter(
            reaction => reaction.user.toString() !== userId
        );

        await chat.save();

        // Emit real-time update
        if (req.io) {
            chat.participants.forEach(participant => {
                req.io.to(`user-${participant.user}`).emit('reaction-removed', {
                    chatId,
                    messageId,
                    userId
                });
            });
        }

        return res.status(200).json({
            message: 'Reaction removed successfully',
            reactions: message.reactions
        });
    } catch (err) {
        console.error('Error removing reaction:', err);
        return res.status(500).json({
            message: 'Failed to remove reaction',
            error: err.message
        });
    }
};

// Get chat participants
export const getChatParticipants = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        })
        .populate('participants.user', 'name email profile.profilePicture isOnline lastActive role');

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        return res.status(200).json({
            participants: chat.participants
        });
    } catch (err) {
        console.error('Error fetching chat participants:', err);
        return res.status(500).json({
            message: 'Failed to fetch participants',
            error: err.message
        });
    }
};

// Add participant to group chat
export const addParticipant = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { userId, role = 'member' } = req.body;
        const currentUserId = req.user._id;

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': currentUserId,
            chatType: 'group',
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        // Check if current user is admin
        const currentParticipant = chat.participants.find(p => p.user.toString() === currentUserId);
        if (currentParticipant?.role !== 'admin') {
            return res.status(403).json({
                message: 'Only admins can add participants'
            });
        }

        await chat.addParticipant(userId, role);

        const populatedChat = await Chat.findById(chatId)
            .populate('participants.user', 'name email profile.profilePicture isOnline lastActive');

        // Emit real-time update
        if (req.io) {
            req.io.to(`user-${userId}`).emit('added-to-chat', {
                chat: populatedChat
            });
        }

        return res.status(200).json({
            message: 'Participant added successfully',
            chat: populatedChat
        });
    } catch (err) {
        console.error('Error adding participant:', err);
        return res.status(500).json({
            message: 'Failed to add participant',
            error: err.message
        });
    }
};

// Remove participant from group chat
export const removeParticipant = async (req, res, next) => {
    try {
        const { chatId, participantId } = req.params;
        const currentUserId = req.user._id;

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': currentUserId,
            chatType: 'group',
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        // Check if current user is admin
        const currentParticipant = chat.participants.find(p => p.user.toString() === currentUserId);
        if (currentParticipant?.role !== 'admin') {
            return res.status(403).json({
                message: 'Only admins can remove participants'
            });
        }

        await chat.removeParticipant(participantId);

        // Emit real-time update
        if (req.io) {
            req.io.to(`user-${participantId}`).emit('removed-from-chat', {
                chatId
            });
        }

        return res.status(200).json({
            message: 'Participant removed successfully'
        });
    } catch (err) {
        console.error('Error removing participant:', err);
        return res.status(500).json({
            message: 'Failed to remove participant',
            error: err.message
        });
    }
};

// Archive chat
export const archiveChat = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        chat.isArchived = true;
        await chat.save();

        return res.status(200).json({
            message: 'Chat archived successfully'
        });
    } catch (err) {
        console.error('Error archiving chat:', err);
        return res.status(500).json({
            message: 'Failed to archive chat',
            error: err.message
        });
    }
};

// Search messages in chat
export const searchMessages = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { query } = req.query;
        const userId = req.user._id;

        if (!query) {
            return res.status(400).json({
                message: 'Search query is required'
            });
        }

        const chat = await Chat.findOne({
            _id: chatId,
            'participants.user': userId,
            isActive: true
        });

        if (!chat) {
            return res.status(404).json({
                message: 'Chat not found'
            });
        }

        const messages = chat.messages.filter(message => 
            !message.isDeleted && 
            message.content.toLowerCase().includes(query.toLowerCase())
        );

        return res.status(200).json({
            messages,
            totalResults: messages.length
        });
    } catch (err) {
        console.error('Error searching messages:', err);
        return res.status(500).json({
            message: 'Failed to search messages',
            error: err.message
        });
    }
};
