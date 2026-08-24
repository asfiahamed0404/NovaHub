import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import readStateRoutes from "./routes/readStateRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

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

const preventInvitationCaching = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

const getInvitationRequestType = (originalUrl) => {
  if (/^\/api\/invitations(?:[/?]|$)/i.test(originalUrl)) {
    return "token";
  }

  if (
    /^\/api\/workspaces\/[^/]+\/invitations(?:[/?]|$)/i.test(
      originalUrl
    )
  ) {
    return "workspace";
  }

  return null;
};

const isAiRequest = (originalUrl) =>
  /^\/api\/workspaces\/[^/]+\/ai(?:[/?]|$)/i.test(originalUrl);

const isAdminRequest = (originalUrl) =>
  /^\/api\/admin(?:[/?]|$)/i.test(originalUrl);

app.use(
  "/api/workspaces/:workspaceId/invitations",
  preventInvitationCaching
);
app.use(
  "/api/invitations",
  preventInvitationCaching
);

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces/:workspaceId/messages", messageRoutes);
app.use("/api/workspaces/:workspaceId/read-state", readStateRoutes);
app.use("/api/workspaces/:workspaceId/ai", aiRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/admin", adminRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("NovaHub API is running 🚀");
});

app.use((req, res, next) => {
  if (!getInvitationRequestType(req.originalUrl)) {
    return next();
  }

  res.set("Cache-Control", "no-store");

  return res.status(404).json({
    message: "Invitation route not found.",
    code: "INVITATION_ROUTE_NOT_FOUND",
  });
});

app.use((error, req, res, next) => {
  const invitationRequestType =
    getInvitationRequestType(req.originalUrl);
  const aiRequest = isAiRequest(req.originalUrl);

  if ((!invitationRequestType && !aiRequest) || res.headersSent) {
    return next(error);
  }

  res.set("Cache-Control", "no-store");

  if (error instanceof URIError) {
    return res.status(400).json({
      message: invitationRequestType === "token"
        ? "Invitation token is malformed."
        : "Invalid workspace ID.",
      code: invitationRequestType === "token"
        ? "INVALID_INVITATION_TOKEN"
        : "INVALID_WORKSPACE_ID",
    });
  }

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    error.type === "entity.parse.failed"
  ) {
    return res.status(400).json({
      message: aiRequest
        ? "AI request body is malformed."
        : "Request body is malformed.",
      code: aiRequest
        ? "INVALID_AI_REQUEST_BODY"
        : "INVALID_INVITATION_REQUEST_BODY",
    });
  }

  if (aiRequest) {
    return res.status(500).json({
      message: "Unable to process the AI request.",
      code: "AI_REQUEST_FAILED",
    });
  }

  return res.status(500).json({
    message: "Unable to process the invitation request.",
    code: "INVITATION_REQUEST_FAILED",
  });
});

app.use((error, req, res, next) => {
  if (!isAdminRequest(req.originalUrl) || res.headersSent) {
    return next(error);
  }

  res.set("Cache-Control", "no-store");

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    error.type === "entity.parse.failed"
  ) {
    return res.status(400).json({
      message: "Request body is malformed.",
      code: "INVALID_ADMIN_REQUEST_BODY",
    });
  }

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large.",
      code: "ADMIN_REQUEST_BODY_TOO_LARGE",
    });
  }

  if (error instanceof URIError) {
    return res.status(400).json({
      message: "Admin request path is malformed.",
      code: "INVALID_ADMIN_REQUEST_PATH",
    });
  }

  return res.status(500).json({
    message: "Unable to process the admin request.",
    code: "ADMIN_REQUEST_FAILED",
  });
});

export default app;
