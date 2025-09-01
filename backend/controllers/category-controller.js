import Category from "../model/Category.js";
import Blog from "../model/Blog.js";
import mongoose from "mongoose";

export const getAllCategories = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const includeInactive = req.query.includeInactive === 'true';
        
        let query = {};
        if (!includeInactive) {
            query.isActive = true;
        }
        
        const categories = await Category.find(query)
            .populate('createdBy', 'name email')
            .sort({ blogCount: -1, name: 1 })
            .skip(skip)
            .limit(limit);
            
        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);
        
        return res.status(200).json({
            categories,
            pagination: {
                currentPage: page,
                totalPages,
                totalCategories,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error fetching categories:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch categories',
            error: err.message 
        });
    }
};

export const createCategory = async (req, res, next) => {
    const { name, description, color, icon, createdBy } = req.body;
    
    if (!name || !createdBy) {
        return res.status(400).json({ 
            message: 'Category name and creator are required' 
        });
    }
    
    try {
        // Check if user has permission
        const user = await User.findById(createdBy);
        if (!user || !['admin', 'author'].includes(user.role)) {
            return res.status(403).json({
                message: 'Only admins and authors can create categories'
            });
        }

        const existingCategory = await Category.findOne({ 
            name: name.trim(),
            isActive: true 
        });
        
        if (existingCategory) {
            return res.status(409).json({ 
                message: 'Category already exists' 
            });
        }

        const category = new Category({
            name: name.trim(),
            description: description ? description.trim() : '',
            color: color || '#667eea',
            icon: icon || 'ArticleIcon',
            createdBy,
            createdAt: new Date()
        });

        const savedCategory = await category.save();
        const populatedCategory = await Category.findById(savedCategory._id)
            .populate('createdBy', 'name email');
        
        // Emit real-time update
        if (req.io) {
            req.io.emit('new-category', {
                category: populatedCategory,
                message: `New category "${name}" created`
            });
        }
        
        return res.status(201).json({ 
            category: populatedCategory,
            message: 'Category created successfully'
        });
    } catch (err) {
        console.error('Error creating category:', err);
        return res.status(500).json({ 
            message: 'Failed to create category',
            error: err.message 
        });
    }
};

export const updateCategory = async (req, res, next) => {
    const categoryId = req.params.id;
    const { name, description, color, icon, isActive, userId } = req.body;
    
    try {
        // Check permissions
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                message: 'Only admins can update categories'
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            {
                name: name ? name.trim() : undefined,
                description: description ? description.trim() : undefined,
                color: color || undefined,
                icon: icon || undefined,
                isActive: isActive !== undefined ? isActive : undefined,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        if (!updatedCategory) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Emit real-time update
        if (req.io) {
            req.io.emit('category-updated', {
                category: updatedCategory,
                message: `Category "${updatedCategory.name}" updated`
            });
        }

        return res.status(200).json({
            category: updatedCategory,
            message: 'Category updated successfully'
        });
    } catch (err) {
        console.error('Error updating category:', err);
        return res.status(500).json({ 
            message: 'Failed to update category',
            error: err.message 
        });
    }
};

export const deleteCategory = async (req, res, next) => {
    const categoryId = req.params.id;
    const { userId } = req.body;
    
    try {
        // Check permissions
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                message: 'Only admins can delete categories'
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        // Check if category is being used
        const blogsUsingCategory = await Blog.countDocuments({ category: category.name });
        if (blogsUsingCategory > 0) {
            return res.status(400).json({
                message: `Cannot delete category. ${blogsUsingCategory} blogs are using this category.`
            });
        }

        await Category.findByIdAndDelete(categoryId);

        // Emit real-time update
        if (req.io) {
            req.io.emit('category-deleted', {
                categoryId,
                message: `Category "${category.name}" deleted`
            });
        }

        return res.status(200).json({
            message: 'Category deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting category:', err);
        return res.status(500).json({ 
            message: 'Failed to delete category',
            error: err.message 
        });
    }
};

export const getCategoryStats = async (req, res, next) => {
    try {
        const categoryStats = await Blog.aggregate([
            { $match: { status: 'published' } },
            {
                $group: {
                    _id: '$category',
                    blogCount: { $sum: 1 },
                    totalViews: { $sum: '$views' },
                    totalLikes: { $sum: { $size: '$likes' } },
                    avgReadingTime: { $avg: '$readingTime' }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: 'name',
                    as: 'categoryInfo'
                }
            },
            {
                $sort: { blogCount: -1 }
            }
        ]);

        return res.status(200).json({
            categoryStats
        });
    } catch (err) {
        console.error('Error fetching category stats:', err);
        return res.status(500).json({ 
            message: 'Failed to fetch category statistics',
            error: err.message 
        });
    }
};