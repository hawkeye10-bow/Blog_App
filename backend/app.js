import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import userRouter from "./routes/user-routes.js";
import blogRouter from "./routes/blog-routes.js";
import categoryRouter from "./routes/category-routes.js";
import chatRouter from "./routes/chat-routes.js";
import mediaRouter from "./routes/media-routes.js";
import pollRouter from "./routes/poll-routes.js";
import analyticsRouter from "./routes/analytics-routes.js";
import realtimeRouter from "./routes/realtime-routes.js";
import { handleSocketConnection } from "./socket/socketHandlers.js";

const app = express();

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Export io for use in other modules
export { io };

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Routes
app.use("/api/user", userRouter);
app.use("/api/blog", blogRouter);
app.use("/api/category", categoryRouter);
app.use("/api/chat", chatRouter);
app.use("/api/media", mediaRouter);
app.use("/api/poll", pollRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/realtime", realtimeRouter);

// Socket.IO connection handling
io.on('connection', (socket) => {
  handleSocketConnection(io, socket);
});

// Database connection
mongoose.connect("mongodb+srv://sandeepdara44:1234567890@cluster0.5z3d3z6.mongodb.net/blogapp?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ Database connected successfully");
  
  // Start server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.IO server ready for real-time connections`);
  });
})
.catch((err) => {
  console.error("❌ Database connection failed:", err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;