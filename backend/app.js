import express from "express";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import router from "./routes/user-routes.js";
import blogRouter from "./routes/blog-routes.js";
import categoryRouter from "./routes/category-routes.js";
import pollRouter from "./routes/poll-routes.js";
import mediaRouter from "./routes/media-routes.js";
import analyticsRouter from "./routes/analytics-routes.js";
import chatRouter from "./routes/chat-routes.js";
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/api/user", router);
app.use("/api/blog", blogRouter);
app.use("/api/category", categoryRouter);
app.use("/api/poll", pollRouter);
app.use("/api/media", mediaRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/chat", chatRouter);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join user to their personal room for notifications
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });
  
  // Join blogs room for real-time blog updates
  socket.on('join-blogs-room', () => {
    socket.join('blogs-room');
    console.log('User joined blogs room');
  });
  
  // Join category room for real-time category updates
  socket.on('join-categories-room', () => {
    socket.join('categories-room');
    console.log('User joined categories room');
  });
  
  // Join chat room for real-time messaging
  socket.on('join-chat-room', (chatId) => {
    socket.join(`chat-${chatId}`);
    console.log(`User joined chat room ${chatId}`);
  });
  
  // Leave chat room
  socket.on('leave-chat-room', (chatId) => {
    socket.leave(`chat-${chatId}`);
    console.log(`User left chat room ${chatId}`);
  });
  
  // Handle real-time collaboration
  socket.on('join-blog-collaboration', (blogId) => {
    socket.join(`blog-${blogId}`);
    console.log(`User joined collaboration room for blog ${blogId}`);
  });
  
  socket.on('blog-content-change', (data) => {
    socket.to(`blog-${data.blogId}`).emit('blog-content-updated', {
      blogId: data.blogId,
      content: data.content,
      user: data.user,
      timestamp: new Date()
    });
  });
  
  // Handle live comments
  socket.on('comment-typing', (data) => {
    socket.to('blogs-room').emit('user-commenting', {
      blogId: data.blogId,
      userId: data.userId,
      userName: data.userName
    });
  });
  
  socket.on('comment-stopped-typing', (data) => {
    socket.to('blogs-room').emit('user-stopped-commenting', {
      blogId: data.blogId,
      userId: data.userId
    });
  });
  
  // Handle chat typing indicators
  socket.on('chat-typing', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-typing-chat', {
      chatId: data.chatId,
      userId: data.userId,
      userName: data.userName
    });
  });
  
  socket.on('chat-stopped-typing', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-stopped-typing-chat', {
      chatId: data.chatId,
      userId: data.userId
    });
  });
  
  // Handle user typing in blog creation/editing
  socket.on('user-typing', (data) => {
    socket.to('blogs-room').emit('user-typing', {
      userId: data.userId,
      userName: data.userName,
      action: data.action // 'creating' or 'editing'
    });
  });
  
  // Handle user stopped typing
  socket.on('user-stopped-typing', (data) => {
    socket.to('blogs-room').emit('user-stopped-typing', {
      userId: data.userId
    });
  });
  
  // Handle user online status
  socket.on('user-online', (userId) => {
    socket.join(`user-${userId}`);
    socket.broadcast.emit('user-status-changed', {
      userId,
      isOnline: true
    });
  });
  
  socket.on('user-offline', (userId) => {
    socket.broadcast.emit('user-status-changed', {
      userId,
      isOnline: false
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Database connection with better error handling
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://sandeepdara44:1234567890@cluster0.5z3d3z6.mongodb.net/blogapp?retryWrites=true&w=majority&appName=Cluster0", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for real-time connections`);
  });
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'BLOGGY API Server',
    status: 'Running',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

export { io };