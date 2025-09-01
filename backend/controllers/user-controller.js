import User from "../model/User.js";
import Blog from "../model/Blog.js";
import Analytics from "../model/Analytics.js";
import bcrypt from 'bcryptjs';
import mongoose from "mongoose";
import crypto from 'crypto';

export const getAllUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const role = req.query.role;
        const search = req.query.search;
        
        let query = { isActive: true };
        if (role) query.role = role;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { 'profile.bio': searchRegex }
            ];
        }
        
        const users = await User.find(query)
            .select('-password -verificationToken -resetPasswordToken')
            .populate('blogs', 'title createdAt status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);
        
        return res.status(200).json({
            users,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch users',
            error: err.message 
        });
    }
};

export const getUserById = async (req, res, next) => {
    const userId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ 
            message: 'Invalid user ID format' 
        });
    }
    
    try {
        const user = await User.findById(userId)
            .select('-password -verificationToken -resetPasswordToken')
            .populate({
                path: 'blogs',
                match: { status: 'published' },
                options: { sort: { createdAt: -1 } }
            })
            .populate('bookmarks', 'title image user createdAt')
            .populate('following', 'name profile')
            .populate('followers', 'name profile');
            
        if (!user) {
            return res.status(404).json({ 
                message: 'User not found' 
            });
        }
        
        // Update last active timestamp
        await User.findByIdAndUpdate(userId, { lastActive: new Date() });
        
        return res.status(200).json({ user });
    } catch (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch user details',
            error: err.message 
        });
    }
};

export const signup = async (req, res, next) => {
    const { name, email, password, role = 'reader' } = req.body;
    
    // Enhanced validation
    if (!name || !email || !password) {
        return res.status(400).json({ 
            message: 'All fields are required: name, email, password' 
        });
    }
    
    if (name.trim().length < 2) {
        return res.status(400).json({ 
            message: 'Name must be at least 2 characters long' 
        });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ 
            message: 'Password must be at least 6 characters long' 
        });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            message: 'Please provide a valid email address' 
        });
    }

    if (!['admin', 'author', 'reader'].includes(role)) {
        return res.status(400).json({
            message: 'Invalid role. Must be admin, author, or reader'
        });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        const existingUser = await User.findOne({ 
            email: normalizedEmail
        });
        
        if (existingUser) {
            return res.status(409).json({ 
                message: 'User already exists with this email. Please login instead.' 
            });
        }

        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const user = new User({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role,
            blogs: [],
            bookmarks: [],
            following: [],
            followers: [],
            notifications: [],
            isActive: true,
            emailVerified: false,
            verificationToken,
            createdAt: new Date(),
            lastActive: new Date()
        });

        const savedUser = await user.save();
        
        // Remove sensitive data from response
        const userResponse = savedUser.toObject();
        delete userResponse.password;
        delete userResponse.verificationToken;
        
        // Emit real-time update for new user registration
        if (req.io) {
            req.io.emit('new-user-registered', {
                message: `Welcome ${name} to BLOGGY!`,
                userCount: await User.countDocuments({ isActive: true }),
                user: {
                    name: userResponse.name,
                    role: userResponse.role
                }
            });
        }

        return res.status(201).json({ 
            user: userResponse,
            message: 'Account created successfully'
        });
    } catch (err) {
        console.error('Error during signup:', err);
        
        if (err.code === 11000) {
            return res.status(409).json({ 
                message: 'Email already exists. Please use a different email.' 
            });
        }
        
        return res.status(500).json({ 
            message: 'Failed to create account',
            error: err.message 
        });
    }
};

export const login = async (req, res, next) => {
    const { email, password } = req.body;
    
    console.log('Login attempt:', { email, hasPassword: !!password });
    
    if (!email || !password) {
        return res.status(400).json({ 
            message: 'Email and password are required' 
        });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        const existingUser = await User.findOne({ 
            email: normalizedEmail,
            isActive: true
        });
        
        if (!existingUser) {
            return res.status(404).json({ 
                message: 'No account found with this email address' 
            });
        }

        const isValidPassword = await bcrypt.compare(password, existingUser.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ 
                message: 'Invalid password. Please try again.' 
            });
        }
        
        // Update user status
        await User.findByIdAndUpdate(existingUser._id, { 
            lastActive: new Date(),
            isOnline: true
        });
        
        const userResponse = {
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            profile: existingUser.profile,
            isActive: existingUser.isActive,
            createdAt: existingUser.createdAt,
            lastActive: new Date(),
            blogCount: existingUser.blogs ? existingUser.blogs.length : 0,
            followerCount: existingUser.followers ? existingUser.followers.length : 0,
            followingCount: existingUser.following ? existingUser.following.length : 0,
            unreadNotificationsCount: existingUser.notifications ? 
                existingUser.notifications.filter(n => !n.read).length : 0
        };
        
        console.log('Login successful for user:', userResponse.email);
        
        // Emit real-time update for user login
        if (req.io) {
            req.io.to(`user-${existingUser._id}`).emit('user-logged-in', {
                message: 'Login successful!',
                timestamp: new Date()
            });
            
            // Notify followers that user is online
            if (existingUser.followers && existingUser.followers.length > 0) {
                existingUser.followers.forEach(followerId => {
                    req.io.to(`user-${followerId}`).emit('user-online', {
                        user: {
                            _id: existingUser._id,
                            name: existingUser.name,
                            profile: existingUser.profile
                        },
                        message: `${existingUser.name} is now online`
                    });
                });
            }
        }

        return res.status(200).json({ 
            message: 'Login successful',
            user: userResponse
        });
    } catch (err) {
        console.error('Error during login:', err);
        return res.status(500).json({ 
            message: 'Login failed',
            error: err.message 
        });
    }
};

export const updateProfile = async (req, res, next) => {
    const userId = req.params.id;
    const { 
        name, 
        bio, 
        website, 
        location, 
        profilePicture,
        socialLinks,
        preferences
    } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ 
            message: 'Invalid user ID format' 
        });
    }
    
    try {
        const updateData = {
            updatedAt: new Date()
        };
        
        if (name) updateData.name = name.trim();
        if (bio !== undefined) updateData['profile.bio'] = bio.trim();
        if (website !== undefined) updateData['profile.website'] = website.trim();
        if (location !== undefined) updateData['profile.location'] = location.trim();
        if (profilePicture !== undefined) updateData['profile.profilePicture'] = profilePicture.trim();
        
        if (socialLinks) {
            Object.keys(socialLinks).forEach(platform => {
                updateData[`profile.socialLinks.${platform}`] = socialLinks[platform].trim();
            });
        }
        
        if (preferences) {
            Object.keys(preferences).forEach(pref => {
                updateData[`preferences.${pref}`] = preferences[pref];
            });
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password -verificationToken -resetPasswordToken')
         .populate('blogs', 'title createdAt status');
        
        if (!updatedUser) {
            return res.status(404).json({ 
                message: 'User not found' 
            });
        }
        
        // Emit real-time update
        if (req.io) {
            req.io.to(`user-${userId}`).emit('profile-updated', {
                user: updatedUser,
                message: 'Profile updated successfully!'
            });
        }
        
        return res.status(200).json({ 
            user: updatedUser,
            message: 'Profile updated successfully'
        });
    } catch (err) {
        console.error('Error updating profile:', err);
        return res.status(500).json({ 
            message: 'Failed to update profile',
            error: err.message 
        });
    }
};

export const followUser = async (req, res, next) => {
    const targetUserId = req.params.id;
    const currentUserId = req.body.userId;
    
    try {
        if (targetUserId === currentUserId) {
            return res.status(400).json({ message: 'You cannot follow yourself' });
        }

        const [currentUser, targetUser] = await Promise.all([
            User.findById(currentUserId),
            User.findById(targetUserId)
        ]);

        if (!currentUser || !targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isFollowing = currentUser.following.includes(targetUserId);

        if (isFollowing) {
            // Unfollow
            currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId);
            targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId);
        } else {
            // Follow
            currentUser.following.push(targetUserId);
            targetUser.followers.push(currentUserId);
            
            // Add notification
            await targetUser.addNotification(
                'follow',
                `${currentUser.name} started following you`,
                currentUserId
            );
            
            // Real-time notification
            if (req.io) {
                req.io.to(`user-${targetUserId}`).emit('new-notification', {
                    type: 'follow',
                    message: `${currentUser.name} started following you`,
                    from: currentUser
                });
            }
        }

        await Promise.all([currentUser.save(), targetUser.save()]);

        return res.status(200).json({
            message: isFollowing ? 'Unfollowed successfully' : 'Following successfully',
            isFollowing: !isFollowing,
            followerCount: targetUser.followers.length
        });
    } catch (err) {
        console.error('Error toggling follow:', err);
        return res.status(500).json({ 
            message: 'Failed to toggle follow',
            error: err.message 
        });
    }
};

export const getUserStats = async (req, res, next) => {
    const userId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ 
            message: 'Invalid user ID format' 
        });
    }
    
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                message: 'User not found' 
            });
        }
        
        const [blogStats, analyticsStats] = await Promise.all([
            Blog.aggregate([
                { $match: { user: new mongoose.Types.ObjectId(userId), status: 'published' } },
                {
                    $group: {
                        _id: null,
                        totalBlogs: { $sum: 1 },
                        totalViews: { $sum: { $ifNull: ['$views', 0] } },
                        totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
                        totalComments: { $sum: { $size: { $ifNull: ['$comments', []] } } },
                        totalShares: { $sum: { $size: { $ifNull: ['$shares', []] } } },
                        avgReadingTime: { $avg: { $ifNull: ['$readingTime', 0] } }
                    }
                }
            ]),
            Analytics.aggregate([
                { 
                    $lookup: {
                        from: 'blogs',
                        localField: 'blog',
                        foreignField: '_id',
                        as: 'blogInfo'
                    }
                },
                { $unwind: '$blogInfo' },
                { $match: { 'blogInfo.user': new mongoose.Types.ObjectId(userId) } },
                {
                    $group: {
                        _id: '$event',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);
        
        const stats = blogStats[0] || {
            totalBlogs: 0,
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            avgReadingTime: 0
        };

        const analyticsData = {};
        analyticsStats.forEach(stat => {
            analyticsData[stat._id] = stat.count;
        });
        
        return res.status(200).json({ 
            stats: {
                ...stats,
                analytics: analyticsData,
                memberSince: user.createdAt,
                lastActive: user.lastActive,
                followerCount: user.followers ? user.followers.length : 0,
                followingCount: user.following ? user.following.length : 0,
                bookmarkCount: user.bookmarks ? user.bookmarks.length : 0
            }
        });
    } catch (err) {
        console.error('Error fetching user stats:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch user statistics',
            error: err.message 
        });
    }
};

export const getNotifications = async (req, res, next) => {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    
    try {
        const user = await User.findById(userId)
            .populate('notifications.from', 'name profile')
            .populate('notifications.blog', 'title');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let notifications = user.notifications;
        if (unreadOnly) {
            notifications = notifications.filter(n => !n.read);
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedNotifications = notifications.slice(startIndex, endIndex);

        return res.status(200).json({
            notifications: paginatedNotifications,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(notifications.length / limit),
                totalNotifications: notifications.length,
                unreadCount: user.notifications.filter(n => !n.read).length
            }
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch notifications',
            error: err.message 
        });
    }
};

export const markNotificationsAsRead = async (req, res, next) => {
    const userId = req.params.id;
    const { notificationIds } = req.body;
    
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await user.markNotificationsAsRead(notificationIds);

        // Emit real-time update
        if (req.io) {
            req.io.to(`user-${userId}`).emit('notifications-read', {
                notificationIds: notificationIds || 'all',
                unreadCount: user.notifications.filter(n => !n.read).length
            });
        }

        return res.status(200).json({
            message: 'Notifications marked as read',
            unreadCount: user.notifications.filter(n => !n.read).length
        });
    } catch (err) {
        console.error('Error marking notifications as read:', err);
        return res.status(500).json({ 
            message: 'Failed to mark notifications as read',
            error: err.message 
        });
    }
};

export const updateUserRole = async (req, res, next) => {
    const userId = req.params.id;
    const { role, adminUserId } = req.body;
    
    try {
        // Check if requesting user is admin
        const adminUser = await User.findById(adminUserId);
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can update user roles' });
        }

        if (!['admin', 'author', 'reader'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { role, updatedAt: new Date() },
            { new: true }
        ).select('-password -verificationToken -resetPasswordToken');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Emit real-time update
        if (req.io) {
            req.io.to(`user-${userId}`).emit('role-updated', {
                newRole: role,
                message: `Your role has been updated to ${role}`
            });
        }

        return res.status(200).json({
            user: updatedUser,
            message: 'User role updated successfully'
        });
    } catch (err) {
        console.error('Error updating user role:', err);
        return res.status(500).json({ 
            message: 'Failed to update user role',
            error: err.message 
        });
    }
};

export const getUserBookmarks = async (req, res, next) => {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    try {
        const user = await User.findById(userId)
            .populate({
                path: 'bookmarks',
                populate: {
                    path: 'user',
                    select: 'name profile'
                },
                options: {
                    sort: { createdAt: -1 },
                    skip: (page - 1) * limit,
                    limit: limit
                }
            });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const totalBookmarks = user.bookmarks.length;
        const totalPages = Math.ceil(totalBookmarks / limit);

        return res.status(200).json({
            bookmarks: user.bookmarks,
            pagination: {
                currentPage: page,
                totalPages,
                totalBookmarks,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error fetching bookmarks:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch bookmarks',
            error: err.message 
        });
    }
};

export const getOnlineUsers = async (req, res, next) => {
    try {
        const onlineUsers = await User.find({ 
            isOnline: true, 
            isActive: true 
        })
        .select('name profile role lastActive')
        .sort({ lastActive: -1 })
        .limit(50);

        return res.status(200).json({
            onlineUsers,
            count: onlineUsers.length
        });
    } catch (err) {
        console.error('Error fetching online users:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch online users',
            error: err.message 
        });
    }
};

export const logout = async (req, res, next) => {
    const userId = req.body.userId;
    
    try {
        await User.findByIdAndUpdate(userId, { 
            isOnline: false,
            lastActive: new Date()
        });

        // Emit real-time update
        if (req.io) {
            req.io.to(`user-${userId}`).emit('user-logged-out', {
                message: 'Logged out successfully'
            });
        }

        return res.status(200).json({
            message: 'Logged out successfully'
        });
    } catch (err) {
        console.error('Error during logout:', err);
        return res.status(500).json({ 
            message: 'Logout failed',
            error: err.message 
        });
    }
};