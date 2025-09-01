import Media from "../model/Media.js";
import Blog from "../model/Blog.js";
import User from "../model/User.js";
import { io } from "../app.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    // Allow images, videos, documents, and audio
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/ogg',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'audio/mpeg', 'audio/wav', 'audio/ogg'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 10 // Max 10 files at once
    }
});

// Upload media files
export const uploadMedia = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }

        const userId = req.user.id;
        const { blogId, tags } = req.body;
        const uploadedMedia = [];

        for (const file of req.files) {
            try {
                // Determine media type
                let mediaType = 'document';
                if (file.mimetype.startsWith('image/')) mediaType = 'image';
                else if (file.mimetype.startsWith('video/')) mediaType = 'video';
                else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';

                // Get file dimensions for images/videos
                let dimensions = {};
                if (mediaType === 'image') {
                    // For images, you might want to use a library like sharp to get dimensions
                    // For now, we'll set default values
                    dimensions = { width: 800, height: 600 };
                }

                // Create media record
                const media = new Media({
                    filename: file.filename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    url: `/uploads/${file.filename}`,
                    type: mediaType,
                    dimensions,
                    uploadedBy: userId,
                    blog: blogId || null,
                    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
                    storageProvider: 'local',
                    storagePath: file.path
                });

                await media.save();
                await media.populate('uploadedBy', 'name profile.profilePicture');

                uploadedMedia.push(media);

                // Emit real-time update if uploaded to a blog
                if (blogId) {
                    io.to(`blog-${blogId}`).emit('media-uploaded', {
                        media,
                        blogId
                    });
                }

            } catch (error) {
                console.error(`Error processing file ${file.originalname}:`, error);
                // Continue with other files
            }
        }

        res.status(201).json({
            message: `${uploadedMedia.length} files uploaded successfully`,
            media: uploadedMedia
        });

    } catch (error) {
        console.error("Error uploading media:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get media by ID
export const getMediaById = async (req, res) => {
    try {
        const { mediaId } = req.params;
        const userId = req.user?.id;

        const media = await Media.findById(mediaId)
            .populate('uploadedBy', 'name profile.profilePicture')
            .populate('blog', 'title slug');

        if (!media) {
            return res.status(404).json({ message: "Media not found" });
        }

        // Check if user can access private media
        if (!media.isPublic && media.uploadedBy.toString() !== userId) {
            return res.status(403).json({ message: "Access denied" });
        }

        res.json({ media });

    } catch (error) {
        console.error("Error getting media:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get user's media
export const getUserMedia = async (req, res) => {
    try {
        const { userId } = req.params;
        const { type, limit = 20, page = 1 } = req.query;
        const currentUserId = req.user?.id;

        // Check if user can view other user's media
        if (userId !== currentUserId) {
            const otherUser = await User.findById(userId);
            if (!otherUser || !otherUser.isActive) {
                return res.status(404).json({ message: "User not found" });
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { uploadedBy: userId };

        if (type) {
            query.type = type;
        }

        // Only show public media to other users
        if (userId !== currentUserId) {
            query.isPublic = true;
        }

        const media = await Media.find(query)
            .populate('blog', 'title slug')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Media.countDocuments(query);

        res.json({
            media,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                hasNext: skip + media.length < total,
                hasPrev: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error("Error getting user media:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get media by type
export const getMediaByType = async (req, res) => {
    try {
        const { type } = req.params;
        const { limit = 20, page = 1 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const media = await Media.find({ type, isPublic: true })
            .populate('uploadedBy', 'name profile.profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Media.countDocuments({ type, isPublic: true });

        res.json({
            media,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                hasNext: skip + media.length < total,
                hasPrev: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error("Error getting media by type:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Search media
export const searchMedia = async (req, res) => {
    try {
        const { q, type, tags, limit = 20, page = 1 } = req.query;

        if (!q && !type && !tags) {
            return res.status(400).json({ message: "Search query, type, or tags required" });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { isPublic: true };

        if (q) {
            query.$or = [
                { filename: { $regex: q, $options: 'i' } },
                { originalName: { $regex: q, $options: 'i' } },
                { tags: { $in: [new RegExp(q, 'i')] } }
            ];
        }

        if (type) {
            query.type = type;
        }

        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            query.tags = { $in: tagArray };
        }

        const media = await Media.find(query)
            .populate('uploadedBy', 'name profile.profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Media.countDocuments(query);

        res.json({
            media,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                hasNext: skip + media.length < total,
                hasPrev: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error("Error searching media:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update media
export const updateMedia = async (req, res) => {
    try {
        const { mediaId } = req.params;
        const updates = req.body;
        const userId = req.user.id;

        const media = await Media.findById(mediaId);
        if (!media) {
            return res.status(404).json({ message: "Media not found" });
        }

        // Check permissions
        if (media.uploadedBy.toString() !== userId) {
            return res.status(403).json({ message: "You can only edit your own media" });
        }

        // Update allowed fields
        const allowedUpdates = ['alt', 'caption', 'tags', 'isPublic'];
        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                media[field] = updates[field];
            }
        });

        await media.save();
        await media.populate('uploadedBy', 'name profile.profilePicture');

        // Emit real-time update if media is associated with a blog
        if (media.blog) {
            io.to(`blog-${media.blog}`).emit('media-updated', {
                media,
                blogId: media.blog
            });
        }

        res.json({
            message: "Media updated successfully",
            media
        });

    } catch (error) {
        console.error("Error updating media:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Delete media
export const deleteMedia = async (req, res) => {
    try {
        const { mediaId } = req.params;
        const userId = req.user.id;

        const media = await Media.findById(mediaId);
        if (!media) {
            return res.status(404).json({ message: "Media not found" });
        }

        // Check permissions
        if (media.uploadedBy.toString() !== userId) {
            return res.status(403).json({ message: "You can only delete your own media" });
        }

        // Delete file from storage
        if (media.storagePath && fs.existsSync(media.storagePath)) {
            fs.unlinkSync(media.storagePath);
        }

        // Emit real-time update if media is associated with a blog
        if (media.blog) {
            io.to(`blog-${media.blog}`).emit('media-deleted', {
                mediaId,
                blogId: media.blog
            });
        }

        await Media.findByIdAndDelete(mediaId);

        res.json({ message: "Media deleted successfully" });

    } catch (error) {
        console.error("Error deleting media:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get media statistics
export const getMediaStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = await Media.aggregate([
            { $match: { uploadedBy: userId } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalSize: { $sum: '$size' },
                    avgSize: { $avg: '$size' }
                }
            }
        ]);

        const totalMedia = await Media.countDocuments({ uploadedBy: userId });
        const totalSize = await Media.aggregate([
            { $match: { uploadedBy: userId } },
            { $group: { _id: null, total: { $sum: '$size' } } }
        ]);

        const mediaByMonth = await Media.aggregate([
            { $match: { uploadedBy: userId } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
        ]);

        res.json({
            stats: {
                totalMedia,
                totalSize: totalSize[0]?.total || 0,
                byType: stats,
                byMonth: mediaByMonth
            }
        });

    } catch (error) {
        console.error("Error getting media stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Bulk delete media
export const bulkDeleteMedia = async (req, res) => {
    try {
        const { mediaIds } = req.body;
        const userId = req.user.id;

        if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
            return res.status(400).json({ message: "Media IDs array is required" });
        }

        // Verify ownership and get media details
        const mediaToDelete = await Media.find({
            _id: { $in: mediaIds },
            uploadedBy: userId
        });

        if (mediaToDelete.length === 0) {
            return res.status(404).json({ message: "No media found to delete" });
        }

        // Delete files from storage
        mediaToDelete.forEach(media => {
            if (media.storagePath && fs.existsSync(media.storagePath)) {
                fs.unlinkSync(media.storagePath);
            }
        });

        // Delete from database
        await Media.deleteMany({ _id: { $in: mediaIds } });

        res.json({
            message: `${mediaToDelete.length} media files deleted successfully`
        });

    } catch (error) {
        console.error("Error bulk deleting media:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
