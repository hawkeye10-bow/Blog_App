import express from "express";
import {
    uploadMedia,
    getMediaById,
    getUserMedia,
    getMediaByType,
    searchMedia,
    updateMedia,
    deleteMedia,
    getMediaStats,
    bulkDeleteMedia,
    upload
} from "../controllers/media-controller.js";
import { authenticateToken, requireUser } from "../middleware/auth.js";

const mediaRouter = express.Router();

// Public routes
mediaRouter.get("/type/:type", getMediaByType);
mediaRouter.get("/search", searchMedia);
mediaRouter.get("/:mediaId", getMediaById);

// Protected routes (require authentication)
mediaRouter.post("/upload", authenticateToken, requireUser, upload.array('files', 10), uploadMedia);
mediaRouter.get("/user/:userId", authenticateToken, requireUser, getUserMedia);
mediaRouter.put("/:mediaId", authenticateToken, requireUser, updateMedia);
mediaRouter.delete("/:mediaId", authenticateToken, requireUser, deleteMedia);
mediaRouter.get("/stats/user", authenticateToken, requireUser, getMediaStats);
mediaRouter.post("/bulk-delete", authenticateToken, requireUser, bulkDeleteMedia);

export default mediaRouter;
