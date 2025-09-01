import jwt from 'jsonwebtoken';
import User from '../model/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticateToken = async (req, res, next) => {
  try {
    console.log('🔐 Auth Middleware - Headers:', req.headers);
    
    // Try multiple ways to get user ID
    let userId = req.headers['user-id'] || 
                 req.headers['userid'] || 
                 req.headers['x-user-id'] ||
                 req.query.userId ||
                 req.body.userId;
    
    console.log('🔐 Auth Middleware - User ID found:', userId);
    
    if (!userId) {
      console.log('❌ Auth Middleware - No user ID found in any location');
      return res.status(401).json({ 
        message: 'User ID required',
        debug: {
          headers: Object.keys(req.headers),
          query: req.query,
          body: req.body
        }
      });
    }

    // Verify user exists and is active
    const user = await User.findById(userId).select('-password');
    if (!user || !user.isActive) {
      console.log('❌ Auth Middleware - User not found or inactive:', userId);
      return res.status(401).json({ 
        message: 'Invalid or inactive user',
        debug: { userId, userFound: !!user, isActive: user?.isActive }
      });
    }

    console.log('✅ Auth Middleware - User authenticated:', user.name);
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Auth Middleware Error:', error);
    return res.status(500).json({ 
      message: 'Authentication failed',
      error: error.message 
    });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireAuthor = requireRole(['admin', 'author']);
export const requireUser = requireRole(['admin', 'author', 'reader']);
