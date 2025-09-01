import express from "express";
import { 
    addBlog, 
    getAllBlogs, 
    updateBlog, 
    getById, 
    deleteBlog, 
    getByUserId,
    getBlogStats,
    searchBlogs,
    likeBlog,
    addComment,
    getTrendingBlogs,
    getRecommendedBlogs,
    bookmarkBlog,
    shareBlog,
    getBlogAnalytics
} from "../controllers/blog-controller.js";
import { authenticateToken, requireUser, requireAuthor } from "../middleware/auth.js";

const blogRouter = express.Router();

// Public routes
blogRouter.get("/", getAllBlogs);
blogRouter.get("/search", searchBlogs);
blogRouter.get("/stats", getBlogStats);
blogRouter.get("/trending", getTrendingBlogs);
blogRouter.get("/:id", getById);
blogRouter.get("/:id/analytics", getBlogAnalytics);

// Protected routes (require authentication)
blogRouter.post("/add", authenticateToken, requireAuthor, addBlog);
blogRouter.put("/update/:id", authenticateToken, requireAuthor, updateBlog);
blogRouter.delete("/:id", authenticateToken, requireAuthor, deleteBlog);
blogRouter.get("/user/:id", authenticateToken, requireUser, getByUserId);
blogRouter.get("/recommended/:userId", authenticateToken, requireUser, getRecommendedBlogs);

// Interaction routes
blogRouter.post("/:id/like", authenticateToken, requireUser, likeBlog);
blogRouter.post("/:id/comment", authenticateToken, requireUser, addComment);
blogRouter.post("/:id/bookmark", authenticateToken, requireUser, bookmarkBlog);
blogRouter.post("/:id/share", authenticateToken, requireUser, shareBlog);

export default blogRouter;