import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";

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
app.use("/api/invitations", invitationRoutes);

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

  if (!invitationRequestType || res.headersSent) {
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
      message: "Request body is malformed.",
      code: "INVALID_INVITATION_REQUEST_BODY",
    });
  }

  return res.status(500).json({
    message: "Unable to process the invitation request.",
    code: "INVITATION_REQUEST_FAILED",
  });
});

export default app;
