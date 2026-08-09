import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigin =
        process.env.CLIENT_URL;

      if (!origin || origin === allowedOrigin) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },
  })
);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces/:workspaceId/messages", messageRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("NovaHub API is running 🚀");
});

export default app;