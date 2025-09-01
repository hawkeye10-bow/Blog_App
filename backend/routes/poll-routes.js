import express from "express";
import {
    createPoll,
    getBlogPolls,
    voteOnPoll,
    getPollResults,
    updatePoll,
    deletePoll,
    getTrendingPolls,
    getUserPolls,
    getPollAnalytics
} from "../controllers/poll-controller.js";

const pollRouter = express.Router();

// Public routes
pollRouter.get("/trending", getTrendingPolls);
pollRouter.get("/blog/:blogId", getBlogPolls);
pollRouter.get("/:pollId/results", getPollResults);

// Protected routes (require authentication)
pollRouter.post("/create", createPoll);
pollRouter.post("/:pollId/vote", voteOnPoll);
pollRouter.put("/:pollId", updatePoll);
pollRouter.delete("/:pollId", deletePoll);
pollRouter.get("/user/:userId", getUserPolls);
pollRouter.get("/:pollId/analytics", getPollAnalytics);

export default pollRouter;
