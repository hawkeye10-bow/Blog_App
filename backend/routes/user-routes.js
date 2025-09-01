import express from "express";
import { 
    getAllUsers, 
    getUserById, 
    login, 
    signup,
    updateProfile,
    getUserStats,
    followUser,
    getNotifications,
    markNotificationsAsRead,
    updateUserRole,
    getUserBookmarks,
    getOnlineUsers,
    logout
} from "../controllers/user-controller.js";
import { authenticateToken, requireUser, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

// Protected routes
router.get("/", authenticateToken, requireUser, getAllUsers);
router.get("/online", authenticateToken, requireUser, getOnlineUsers);
router.get("/:id", authenticateToken, requireUser, getUserById);
router.put("/profile/:id", authenticateToken, requireUser, updateProfile);
router.get("/stats/:id", authenticateToken, requireUser, getUserStats);
router.get("/bookmarks/:id", authenticateToken, requireUser, getUserBookmarks);

// Social features
router.post("/follow/:id", authenticateToken, requireUser, followUser);

// Notifications
router.get("/notifications/:id", authenticateToken, requireUser, getNotifications);
router.put("/notifications/:id/read", authenticateToken, requireUser, markNotificationsAsRead);

// Admin routes
router.put("/role/:id", authenticateToken, requireAdmin, updateUserRole);

export default router;