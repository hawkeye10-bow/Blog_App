import express from "express";
import {
    getRealTimeAnalytics,
    trackPageView,
    trackEngagement,
    getBlogAnalytics,
    getUserAnalytics,
    getPlatformAnalytics,
    cleanupAnalytics
} from "../controllers/analytics-controller.js";

const analyticsRouter = express.Router();

// Public routes (for tracking)
analyticsRouter.post("/track/pageview/:blogId", trackPageView);

// Protected routes (require authentication)
analyticsRouter.post("/track/engagement/:blogId", trackEngagement);
analyticsRouter.get("/blog/:blogId/realtime", getRealTimeAnalytics);
analyticsRouter.get("/blog/:blogId", getBlogAnalytics);
analyticsRouter.get("/user", getUserAnalytics);

// Admin routes
analyticsRouter.get("/platform", getPlatformAnalytics);
analyticsRouter.post("/cleanup", cleanupAnalytics);

export default analyticsRouter;
