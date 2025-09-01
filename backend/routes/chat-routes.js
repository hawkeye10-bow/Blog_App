import express from "express";
import { authenticateToken, requireUser } from "../middleware/auth.js";
import {
    getUserChats,
    getChat,
    createChat,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    addReaction,
    removeReaction,
    getChatParticipants,
    addParticipant,
    removeParticipant,
    archiveChat,
    searchMessages
} from "../controllers/chat-controller.js";

const router = express.Router();

// Chat management routes
router.get("/", authenticateToken, getUserChats);
router.post("/", authenticateToken, createChat);
router.get("/:chatId", authenticateToken, getChat);
router.post("/:chatId/archive", authenticateToken, archiveChat);

// Message routes
router.post("/:chatId/messages", authenticateToken, sendMessage);
router.put("/:chatId/messages/:messageId", authenticateToken, editMessage);
router.delete("/:chatId/messages/:messageId", authenticateToken, deleteMessage);
router.post("/:chatId/messages/:messageId/reactions", authenticateToken, addReaction);
router.delete("/:chatId/messages/:messageId/reactions", authenticateToken, removeReaction);

// Chat interaction routes
router.post("/:chatId/read", authenticateToken, markAsRead);
router.get("/:chatId/participants", authenticateToken, getChatParticipants);
router.post("/:chatId/participants", authenticateToken, addParticipant);
router.delete("/:chatId/participants/:participantId", authenticateToken, removeParticipant);

// Search routes
router.get("/:chatId/search", authenticateToken, searchMessages);

export default router;
