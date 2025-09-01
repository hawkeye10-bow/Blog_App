import Blog from "../model/Blog.js";
import User from "../model/User.js";
import Category from "../model/Category.js";
import Analytics from "../model/Analytics.js";
import mongoose from "mongoose";

export const getAllBlogs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const status = req.query.status || 'published';
        const featured = req.query.featured;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        
        // Build query
        let query = { status };
        if (category) query.category = category;
        if (featured !== undefined) query.featured = featured === 'true';
        
        const blogs = await Blog.find(query)
            .populate('user', 'name email profile role')
            .populate('category')
            .populate('likes.user', 'name profile')
            .populate('comments.user', 'name profile')
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit);
            
        const totalBlogs = await Blog.countDocuments(query);
        const totalPages = Math.ceil(totalBlogs / limit);
        
        // Track analytics for this request
        if (req.user) {
            await Analytics.create({
                user: req.user._id,
                event: 'view',
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    referrer: req.get('Referrer')
                }
            });
        }
        
        return res.status(200).json({
            blogs,
            pagination: {
                currentPage: page,
                totalPages,
                totalBlogs,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error fetching blogs:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch blogs',
            error: err.message 
        });
    }
};

export const addBlog = async (req, res, next) => {
    const { 
        title, 
        description, 
        content, 
        image, 
        images, 
        category, 
        tags, 
        hashtags, 
        status, 
        scheduledFor,
        seoTitle,
        seoDescription,
        allowComments,
        isCollaborative,
        collaborators
    } = req.body;
    
    const userId = req.body.user || localStorage.getItem("userId");
    
    // Validation
    if (!title || !description || !content || !image || !userId) {
        return res.status(400).json({ 
            message: 'Title, description, content, image, and user are required' 
        });
    }
    
    if (title.trim().length < 3) {
        return res.status(400).json({ 
            message: 'Title must be at least 3 characters long' 
        });
    }
    
    if (description.trim().length < 10) {
        return res.status(400).json({ 
            message: 'Description must be at least 10 characters long' 
        });
    }

    let existingUser;
    try {
        existingUser = await User.findById(userId);
    } catch (err) {
        console.error('Error finding user:', err);
        return res.status(400).json({ 
            message: 'Invalid user ID format' 
        });
    }

    if (!existingUser) {
        return res.status(404).json({ 
            message: 'User not found' 
        });
    }

    // Check if user has permission to create blogs
    if (!['admin', 'author'].includes(existingUser.role)) {
        return res.status(403).json({
            message: 'Only authors and admins can create blog posts'
        });
    }

    const blog = new Blog({
        title: title.trim(),
        description: description.trim(),
        content: content.trim(),
        image: image.trim(),
        images: images || [],
        category: category || 'General',
        tags: tags || [],
        hashtags: hashtags || [],
        status: status || 'draft',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        seoTitle: seoTitle || title.trim(),
        seoDescription: seoDescription || description.substring(0, 160),
        allowComments: allowComments !== false,
        isCollaborative: isCollaborative || false,
        collaborators: collaborators || [],
        user: userId,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();
        
        const savedBlog = await blog.save({ session });
        existingUser.blogs.push(savedBlog._id);
        await existingUser.save({ session });
        
        // Update category blog count
        if (category) {
            await Category.findOneAndUpdate(
                { name: category },
                { $inc: { blogCount: 1 } },
                { session, upsert: true, setDefaultsOnInsert: true }
            );
        }
        
        await session.commitTransaction();
        
        // Populate the user data for the response
        const populatedBlog = await Blog.findById(savedBlog._id)
            .populate('user', 'name email profile role')
            .populate('category');
        
        // Emit real-time update to all connected clients
        if (req.io) {
            req.io.to('blogs-room').emit('new-blog', {
                blog: populatedBlog,
                message: `New blog "${title}" published by ${existingUser.name}`
            });
            
            // Notify followers
            if (existingUser.followers && existingUser.followers.length > 0) {
                existingUser.followers.forEach(followerId => {
                    req.io.to(`user-${followerId}`).emit('new-blog-from-following', {
                        blog: populatedBlog,
                        message: `${existingUser.name} published a new blog: "${title}"`
                    });
                });
            }
            
            // Notify the user
            req.io.to(`user-${userId}`).emit('blog-created', {
                blog: populatedBlog,
                message: 'Your blog has been published successfully!'
            });
        }
        
        // Track analytics
        await Analytics.create({
            blog: savedBlog._id,
            user: userId,
            event: 'create',
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
        
        return res.status(201).json({ 
            blog: populatedBlog,
            message: 'Blog created successfully'
        });
    } catch (err) {
        await session.abortTransaction();
        console.error('Error creating blog:', err);
        return res.status(500).json({ 
            message: 'Failed to create blog',
            error: err.message 
        });
    } finally {
        session.endSession();
    }
};

export const updateBlog = async (req, res, next) => {
    const { 
        title, 
        description, 
        content, 
        image, 
        images, 
        category, 
        tags, 
        hashtags, 
        status,
        seoTitle,
        seoDescription,
        allowComments
    } = req.body;
    const blogId = req.params.id;
    const userId = req.body.userId || localStorage.getItem("userId");
    
    // Validation
    if (!title || !description || !content) {
        return res.status(400).json({ 
            message: 'Title, description, and content are required' 
        });
    }
    
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
        return res.status(400).json({ 
            message: 'Invalid blog ID format' 
        });
    }

    try {
        const existingBlog = await Blog.findById(blogId).populate('user', 'name email role');
        
        if (!existingBlog) {
            return res.status(404).json({ 
                message: 'Blog not found' 
            });
        }

        // Check permissions
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const canEdit = existingBlog.user._id.toString() === userId || 
                       currentUser.role === 'admin' ||
                       existingBlog.collaborators.some(c => 
                           c.user.toString() === userId && c.role === 'editor'
                       );

        if (!canEdit) {
            return res.status(403).json({
                message: 'You do not have permission to edit this blog'
            });
        }

        // Store edit history
        const changes = {
            title: existingBlog.title !== title,
            description: existingBlog.description !== description,
            content: existingBlog.content !== content,
            image: existingBlog.image !== image,
            category: existingBlog.category !== category,
            status: existingBlog.status !== status
        };

        const updatedBlog = await Blog.findByIdAndUpdate(
            blogId,
            {
                title: title.trim(),
                description: description.trim(),
                content: content.trim(),
                image: image ? image.trim() : existingBlog.image,
                images: images || existingBlog.images,
                category: category || existingBlog.category,
                tags: tags || existingBlog.tags,
                hashtags: hashtags || existingBlog.hashtags,
                status: status || existingBlog.status,
                seoTitle: seoTitle || title.trim(),
                seoDescription: seoDescription || description.substring(0, 160),
                allowComments: allowComments !== undefined ? allowComments : existingBlog.allowComments,
                updatedAt: new Date(),
                $push: {
                    editHistory: {
                        user: userId,
                        changes: JSON.stringify(changes),
                        timestamp: new Date()
                    }
                }
            },
            { new: true, runValidators: true }
        ).populate('user', 'name email profile role');

        // Emit real-time update
        if (req.io) {
            req.io.to('blogs-room').emit('blog-updated', {
                blog: updatedBlog,
                message: `Blog "${title}" has been updated`,
                changes
            });
            
            // Notify collaborators
            if (existingBlog.collaborators && existingBlog.collaborators.length > 0) {
                existingBlog.collaborators.forEach(collaborator => {
                    if (collaborator.user.toString() !== userId) {
                        req.io.to(`user-${collaborator.user}`).emit('blog-updated', {
                            blog: updatedBlog,
                            message: `Blog "${title}" has been updated by ${currentUser.name}`
                        });
                    }
                });
            }
            
            req.io.to(`user-${existingBlog.user._id}`).emit('blog-updated', {
                blog: updatedBlog,
                message: 'Your blog has been updated successfully!'
            });
        }

        // Track analytics
        await Analytics.create({
            blog: blogId,
            user: userId,
            event: 'edit',
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                changes: JSON.stringify(changes)
            }
        });

        return res.status(200).json({ 
            blog: updatedBlog,
            message: 'Blog updated successfully'
        });
    } catch (err) {
        console.error('Error updating blog:', err);
        return res.status(500).json({ 
            message: 'Failed to update blog',
            error: err.message 
        });
    }
};

export const getById = async (req, res, next) => {
    const id = req.params.id;
    const userId = req.query.userId || req.headers['x-user-id'];
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            message: 'Invalid blog ID format' 
        });
    }

    try {
        const blog = await Blog.findById(id)
            .populate('user', 'name email profile role createdAt')
            .populate('comments.user', 'name profile')
            .populate('likes.user', 'name profile')
            .populate('collaborators.user', 'name email profile');
        
        if (!blog) {
            return res.status(404).json({ 
                message: 'Blog not found' 
            });
        }
        
        // Track blog view
        const viewUpdate = { $inc: { views: 1 }, lastViewed: new Date() };
        
        // Track unique view if user is provided
        if (userId) {
            const existingView = blog.uniqueViews.find(v => 
                v.user && v.user.toString() === userId
            );
            
            if (!existingView) {
                viewUpdate.$push = {
                    uniqueViews: {
                        user: userId,
                        viewedAt: new Date(),
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent')
                    }
                };
            }
        }
        
        await Blog.findByIdAndUpdate(id, viewUpdate);

        // Track analytics
        await Analytics.create({
            blog: id,
            user: userId || null,
            event: 'view',
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                referrer: req.get('Referrer')
            }
        });

        return res.status(200).json({ blog });
    } catch (err) {
        console.error('Error fetching blog:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch blog',
            error: err.message 
        });
    }
};

export const deleteBlog = async (req, res, next) => {
    const blogId = req.params.id;
    const userId = req.body.userId || localStorage.getItem("userId");
    
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
        return res.status(400).json({ 
            message: 'Invalid blog ID format' 
        });
    }

    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();
        
        const blog = await Blog.findById(blogId).populate('user', 'name email role');
        
        if (!blog) {
            await session.abortTransaction();
            return res.status(404).json({ 
                message: 'Blog not found' 
            });
        }
        
        // Check permissions
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            await session.abortTransaction();
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const canDelete = blog.user._id.toString() === userId || currentUser.role === 'admin';
        if (!canDelete) {
            await session.abortTransaction();
            return res.status(403).json({
                message: 'You do not have permission to delete this blog'
            });
        }
        
        // Remove blog from user's blogs array
        await User.findByIdAndUpdate(
            blog.user._id,
            { $pull: { blogs: blogId } },
            { session }
        );
        
        // Update category blog count
        if (blog.category) {
            await Category.findOneAndUpdate(
                { name: blog.category },
                { $inc: { blogCount: -1 } },
                { session }
            );
        }
        
        // Delete related analytics
        await Analytics.deleteMany({ blog: blogId }, { session });
        
        // Delete the blog
        await Blog.findByIdAndDelete(blogId, { session });
        
        await session.commitTransaction();
        
        // Emit real-time update
        if (req.io) {
            req.io.to('blogs-room').emit('blog-deleted', {
                blogId,
                message: `Blog "${blog.title}" has been deleted`
            });
            
            req.io.to(`user-${blog.user._id}`).emit('blog-deleted', {
                blogId,
                message: 'Your blog has been deleted successfully!'
            });
        }
        
        return res.status(200).json({ 
            message: 'Blog deleted successfully',
            deletedBlogId: blogId
        });
    } catch (err) {
        await session.abortTransaction();
        console.error('Error deleting blog:', err);
        return res.status(500).json({ 
            message: 'Failed to delete blog',
            error: err.message 
        });
    } finally {
        session.endSession();
    }
};

export const getByUserId = async (req, res, next) => {
    const id = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
            message: 'Invalid user ID format' 
        });
    }

    try {
        let query = { user: id };
        if (status) query.status = status;
        
        const skip = (page - 1) * limit;
        
        const blogs = await Blog.find(query)
            .populate('user', 'name email profile')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalBlogs = await Blog.countDocuments(query);
        const totalPages = Math.ceil(totalBlogs / limit);

        const user = await User.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            user: { ...user.toObject(), blogs },
            pagination: {
                currentPage: page,
                totalPages,
                totalBlogs,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error fetching user blogs:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch user blogs',
            error: err.message 
        });
    }
};

export const getBlogStats = async (req, res, next) => {
    try {
        const totalBlogs = await Blog.countDocuments({ status: 'published' });
        const totalUsers = await User.countDocuments({ isActive: true });
        const recentBlogs = await Blog.countDocuments({
            status: 'published',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        const topAuthors = await Blog.aggregate([
            { $match: { status: 'published' } },
            {
                $group: {
                    _id: '$user',
                    blogCount: { $sum: 1 },
                    totalViews: { $sum: '$views' },
                    totalLikes: { $sum: { $size: '$likes' } }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            {
                $unwind: '$userInfo'
            },
            {
                $project: {
                    name: '$userInfo.name',
                    blogCount: 1,
                    totalViews: 1,
                    totalLikes: 1
                }
            },
            {
                $sort: { blogCount: -1 }
            },
            {
                $limit: 5
            }
        ]);

        const categories = await Category.find({ isActive: true })
            .sort({ blogCount: -1 })
            .limit(10);

        const trendingTags = await Blog.aggregate([
            { $match: { status: 'published' } },
            { $unwind: '$tags' },
            {
                $group: {
                    _id: '$tags',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        return res.status(200).json({
            stats: {
                totalBlogs,
                totalUsers,
                recentBlogs,
                topAuthors,
                categories,
                trendingTags
            }
        });
    } catch (err) {
        console.error('Error fetching blog stats:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch blog statistics',
            error: err.message 
        });
    }
};

export const searchBlogs = async (req, res, next) => {
    try {
        const { query, page = 1, limit = 10, category, tags, author } = req.query;
        
        if (!query || query.trim().length === 0) {
            return res.status(400).json({ 
                message: 'Search query is required' 
            });
        }
        
        const searchRegex = new RegExp(query.trim(), 'i');
        const skip = (page - 1) * limit;
        
        let searchQuery = {
            status: 'published',
            $or: [
                { title: searchRegex },
                { description: searchRegex },
                { content: searchRegex },
                { tags: { $in: [searchRegex] } },
                { hashtags: { $in: [searchRegex] } }
            ]
        };

        // Add filters
        if (category) searchQuery.category = category;
        if (tags) searchQuery.tags = { $in: tags.split(',') };
        if (author) {
            const authorUser = await User.findOne({ name: new RegExp(author, 'i') });
            if (authorUser) searchQuery.user = authorUser._id;
        }
        
        const blogs = await Blog.find(searchQuery)
            .populate('user', 'name email profile')
            .populate('likes.user', 'name profile')
            .populate('comments.user', 'name profile')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const totalResults = await Blog.countDocuments(searchQuery);
        
        // Track search analytics
        try {
            await Analytics.create({
                event: 'search',
                user: req.user?._id, // Include user ID if authenticated
                metadata: {
                    searchQuery: query,
                    resultsCount: totalResults,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });
        } catch (analyticsError) {
            // Log analytics error but don't fail the search
            console.warn('Failed to track search analytics:', analyticsError.message);
        }
        
        return res.status(200).json({
            blogs,
            searchQuery: query,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalResults / limit),
                totalResults,
                hasNext: page < Math.ceil(totalResults / limit),
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error searching blogs:', err);
        return res.status(500).json({ 
            message: 'Failed to search blogs',
            error: err.message 
        });
    }
};

export const likeBlog = async (req, res, next) => {
    const blogId = req.params.id;
    const userId = req.body.userId;
    
    try {
        const blog = await Blog.findById(blogId).populate('user', 'name');
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        const existingLike = blog.likes.find(like => 
            like.user.toString() === userId
        );

        if (existingLike) {
            // Unlike
            blog.likes = blog.likes.filter(like => 
                like.user.toString() !== userId
            );
        } else {
            // Like
            blog.likes.push({ user: userId, createdAt: new Date() });
            
            // Notify blog author
            if (blog.user._id.toString() !== userId) {
                const liker = await User.findById(userId);
                const blogAuthor = await User.findById(blog.user._id);
                
                if (blogAuthor) {
                    await blogAuthor.addNotification(
                        'like',
                        `${liker.name} liked your blog "${blog.title}"`,
                        userId,
                        blogId
                    );
                    
                    // Real-time notification
                    if (req.io) {
                        req.io.to(`user-${blog.user._id}`).emit('new-notification', {
                            type: 'like',
                            message: `${liker.name} liked your blog "${blog.title}"`,
                            from: liker,
                            blog: blog
                        });
                    }
                }
            }
        }

        await blog.save();

        // Track analytics
        try {
            await Analytics.create({
                blog: blogId,
                user: userId,
                event: existingLike ? 'unlike' : 'like',
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                }
            });
        } catch (analyticsError) {
            // Log analytics error but don't fail the like operation
            console.warn('Failed to track like analytics:', analyticsError.message);
        }

        // Emit real-time update
        if (req.io) {
            req.io.to('blogs-room').emit('blog-like-updated', {
                blogId,
                likeCount: blog.likes.length,
                isLiked: !existingLike
            });
        }

        return res.status(200).json({
            message: existingLike ? 'Blog unliked' : 'Blog liked',
            likeCount: blog.likes.length,
            isLiked: !existingLike
        });
    } catch (err) {
        console.error('Error toggling like:', err);
        return res.status(500).json({ 
            message: 'Failed to toggle like',
            error: err.message 
        });
    }
};

export const addComment = async (req, res, next) => {
    const blogId = req.params.id;
    const { content, userId, parentCommentId } = req.body;
    
    try {
        const blog = await Blog.findById(blogId).populate('user', 'name');
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        if (!blog.allowComments) {
            return res.status(403).json({ message: 'Comments are disabled for this blog' });
        }

        const commenter = await User.findById(userId);
        if (!commenter) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newComment = {
            user: userId,
            content: content.trim(),
            parentComment: parentCommentId || null,
            createdAt: new Date()
        };

        blog.comments.push(newComment);
        await blog.save();

        const savedComment = blog.comments[blog.comments.length - 1];
        await Blog.populate(savedComment, { path: 'user', select: 'name profile' });

        // Notify blog author
        if (blog.user._id.toString() !== userId) {
            const blogAuthor = await User.findById(blog.user._id);
            
            if (blogAuthor) {
                await blogAuthor.addNotification(
                    'comment',
                    `${commenter.name} commented on your blog "${blog.title}"`,
                    userId,
                    blogId
                );
                
                // Real-time notification
                if (req.io) {
                    req.io.to(`user-${blog.user._id}`).emit('new-notification', {
                        type: 'comment',
                        message: `${commenter.name} commented on your blog "${blog.title}"`,
                        from: commenter,
                        blog: blog
                    });
                }
            }
        }

        // Emit real-time comment update
        if (req.io) {
            req.io.to('blogs-room').emit('new-comment', {
                blogId,
                comment: savedComment,
                message: `New comment on "${blog.title}"`
            });
        }

        // Track analytics
        await Analytics.create({
            blog: blogId,
            user: userId,
            event: 'comment',
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                commentLength: content.length
            }
        });

        return res.status(201).json({
            message: 'Comment added successfully',
            comment: savedComment
        });
    } catch (err) {
        console.error('Error adding comment:', err);
        return res.status(500).json({ 
            message: 'Failed to add comment',
            error: err.message 
        });
    }
};

export const getTrendingBlogs = async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe || '7d'; // 1d, 7d, 30d
        const limit = parseInt(req.query.limit) || 10;
        
        let dateFilter;
        switch (timeframe) {
            case '1d':
                dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }

        const trendingBlogs = await Blog.aggregate([
            {
                $match: {
                    status: 'published',
                    publishedAt: { $gte: dateFilter }
                }
            },
            {
                $addFields: {
                    engagementScore: {
                        $add: [
                            { $multiply: [{ $size: '$likes' }, 3] },
                            { $multiply: [{ $size: '$comments' }, 5] },
                            { $multiply: [{ $size: '$shares' }, 7] },
                            { $multiply: ['$views', 1] }
                        ]
                    }
                }
            },
            {
                $sort: { engagementScore: -1 }
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    'user.password': 0
                }
            }
        ]);

        return res.status(200).json({
            trendingBlogs,
            timeframe
        });
    } catch (err) {
        console.error('Error fetching trending blogs:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch trending blogs',
            error: err.message 
        });
    }
};

export const getRecommendedBlogs = async (req, res, next) => {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 5;
    
    try {
        const user = await User.findById(userId).populate('bookmarks');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user's reading history and preferences
        const userBlogs = await Blog.find({ user: userId });
        const userCategories = [...new Set(userBlogs.map(blog => blog.category))];
        const userTags = [...new Set(userBlogs.flatMap(blog => blog.tags))];

        // Find similar blogs
        const recommendedBlogs = await Blog.find({
            status: 'published',
            user: { $ne: userId },
            $or: [
                { category: { $in: userCategories } },
                { tags: { $in: userTags } }
            ]
        })
        .populate('user', 'name profile')
        .sort({ views: -1, createdAt: -1 })
        .limit(limit);

        return res.status(200).json({
            recommendedBlogs
        });
    } catch (err) {
        console.error('Error fetching recommended blogs:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch recommended blogs',
            error: err.message 
        });
    }
};

export const bookmarkBlog = async (req, res, next) => {
    const blogId = req.params.id;
    const userId = req.body.userId;
    
    try {
        const user = await User.findById(userId);
        const blog = await Blog.findById(blogId);
        
        if (!user || !blog) {
            return res.status(404).json({ message: 'User or blog not found' });
        }

        const isBookmarked = user.bookmarks.includes(blogId);
        
        if (isBookmarked) {
            user.bookmarks = user.bookmarks.filter(id => id.toString() !== blogId);
        } else {
            user.bookmarks.push(blogId);
        }

        await user.save();

        // Track analytics
        await Analytics.create({
            blog: blogId,
            user: userId,
            event: 'bookmark',
            metadata: {
                action: isBookmarked ? 'remove' : 'add',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        return res.status(200).json({
            message: isBookmarked ? 'Bookmark removed' : 'Blog bookmarked',
            isBookmarked: !isBookmarked
        });
    } catch (err) {
        console.error('Error toggling bookmark:', err);
        return res.status(500).json({ 
            message: 'Failed to toggle bookmark',
            error: err.message 
        });
    }
};

export const shareBlog = async (req, res, next) => {
    const blogId = req.params.id;
    const { userId, platform } = req.body;
    
    try {
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found' });
        }

        blog.shares.push({
            user: userId,
            platform,
            createdAt: new Date()
        });

        await blog.save();

        // Track analytics
        await Analytics.create({
            blog: blogId,
            user: userId,
            event: 'share',
            metadata: {
                platform,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        return res.status(200).json({
            message: 'Blog shared successfully',
            shareCount: blog.shares.length
        });
    } catch (err) {
        console.error('Error sharing blog:', err);
        return res.status(500).json({ 
            message: 'Failed to share blog',
            error: err.message 
        });
    }
};

export const getBlogAnalytics = async (req, res, next) => {
    const blogId = req.params.id;
    const timeframe = req.query.timeframe || '7d';
    
    try {
        let dateFilter;
        switch (timeframe) {
            case '1d':
                dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }

        const analytics = await Analytics.aggregate([
            {
                $match: {
                    blog: new mongoose.Types.ObjectId(blogId),
                    timestamp: { $gte: dateFilter }
                }
            },
            {
                $group: {
                    _id: {
                        event: '$event',
                        date: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$timestamp'
                            }
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.event',
                    data: {
                        $push: {
                            date: '$_id.date',
                            count: '$count'
                        }
                    },
                    total: { $sum: '$count' }
                }
            }
        ]);

        const blog = await Blog.findById(blogId);
        
        return res.status(200).json({
            analytics,
            summary: {
                totalViews: blog.views,
                uniqueViews: blog.uniqueViews.length,
                likes: blog.likes.length,
                comments: blog.comments.filter(c => !c.isDeleted).length,
                shares: blog.shares.length,
                engagementRate: blog.engagementScore
            }
        });
    } catch (err) {
        console.error('Error fetching blog analytics:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch blog analytics',
            error: err.message 
        });
    }
};