import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import "dotenv/config"; // Loads environment variables
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import swaggerConfig from "./config/swagger";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import roleRoutes from "./routes/roleRoutes";
import invitationRoutes from "./routes/invitationCodeRoutes";
import contributionRoutes from "./routes/contributionRoutes";

const app = express();
const PORT = process.env.PORT || 2500;

// CORS Configuration with explicit origins
const allowedOrigins: string[] = [
  "http://localhost:4500"
];

// Add CALLBACK_URL if it exists
if (process.env.CALLBACK_URL) {
  allowedOrigins.push(process.env.CALLBACK_URL);
}

// CORS middleware configuration
app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Enable pre-flight across all routes
app.options(/.*/, cors() as any); 

// Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// DB CONNECTION
mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log("DB CONNECTED"))
  .catch((err) => console.log("DB Connection Error:", err.message));

// Static file serving for uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "Saveplan API Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0"
  });
});

// CORS debug endpoint (helpful for troubleshooting)
app.get("/api/debug/cors", (req, res) => {
  res.json({
    allowedOrigins,
    requestOrigin: req.get("origin") || "No origin header",
    corsEnabled: true,
    environmentVariable: process.env.CORS_ORIGIN ? "Set" : "Not Set",
    timestamp: new Date().toISOString()
  });
});

// Swagger Documentation
app.use(
  "/api/docs",
  swaggerConfig.swaggerUi.serve,
  swaggerConfig.swaggerUi.setup(swaggerConfig.specs, swaggerConfig.options)
);

// Route Registrations
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", roleRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/contributions", contributionRoutes);

// Real-time Features (Socket.io)
// Create HTTP server that wraps the Express app
const server = createServer(app);

// Attach Socket.io to the HTTP server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Store socket connections for real-time notifications
const socketConnections = new Map<string, string>();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Listen for user authentication to map socket to user
  socket.on("authenticate", (userId: string) => {
    socketConnections.set(userId, socket.id);
    socket.join(`user_${userId}`);
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    // Remove from connections
    for (const [key, value] of socketConnections.entries()) {
      if (value === socket.id) {
        socketConnections.delete(key);
        break;
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

app.set("io", io); // Make Socket.io instance accessible via app.get('io')
app.set("socketConnections", socketConnections); // Store active socket connections

// Main API endpoint
app.get("/api", (_req, res) => {
  res.json({
    message: "Welcome to Saveplan API",
    version: "1.0.0",
    documentation: "/api/docs",
    endpoints: {
      health: "/api/health"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

// Global error handler
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack); // Log the error stack for debugging

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === "development" && {
        error: err.message,
        stack: err.stack // Only include stack trace in development
      })
    });
  }
);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Saveplan API Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔒 CORS Origins: ${allowedOrigins.join(", ")}`);
  console.log("🔌 Socket.io enabled for real-time features");
});
