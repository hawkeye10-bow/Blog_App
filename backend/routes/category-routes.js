import express from "express";
import { 
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryStats
} from "../controllers/category-controller.js";

const categoryRouter = express.Router();

// Public routes
categoryRouter.get("/", getAllCategories);
categoryRouter.get("/stats", getCategoryStats);

// Protected routes (require authentication)
categoryRouter.post("/", createCategory);
categoryRouter.put("/:id", updateCategory);
categoryRouter.delete("/:id", deleteCategory);

export default categoryRouter;