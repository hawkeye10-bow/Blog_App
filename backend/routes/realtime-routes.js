import express from "express";
import {
    trackUserPresence,
    trackBlogView,
    handleContentCollaboration,
    trackEngagement,
    getRealTimeBlogStats,
    getUserActivityFeed,
    getTrendingContent,
    performRealTimeSearch,
    updateUserStatus,
    moderateContent
} from "../controllers/realtime-controller.js";
import { authenticateToken, requireUser, requireAdmin } from "../middleware/auth.js";

const realtimeRouter = express.Router();

// User presence and activity
realtimeRouter.post("/presence", authenticateToken, trackUserPresence);
realtimeRouter.put("/user/:userId/status", authenticateToken, updateUserStatus);
realtimeRouter.get("/user/:userId/activity", authenticateToken, getUserActivityFeed);

// Blog real-time features
realtimeRouter.post("/blog/:blogId/view", trackBlogView);
realtimeRouter.post("/blog/:blogId/collaborate", authenticateToken, handleContentCollaboration);
realtimeRouter.post("/blog/:blogId/engage", authenticateToken, trackEngagement);
realtimeRouter.get("/blog/:blogId/stats", getRealTimeBlogStats);

// Content discovery
realtimeRouter.get("/trending", getTrendingContent);
realtimeRouter.post("/search", performRealTimeSearch);

// Content moderation (admin only)
realtimeRouter.post("/moderate", authenticateToken, requireAdmin, moderateContent);

export default realtimeRouter;