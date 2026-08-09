import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import User from "../models/User.js";
import Workspace from "../models/Workspace.js";

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(
          new Error(
            "Authentication token is required."
          )
        );
      }

      const decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(
        decodedToken.userId
      ).select("-password");

      if (!user) {
        return next(
          new Error("User not found.")
        );
      }

      socket.user = user;

      next();
    } catch (error) {
      next(
        new Error(
          "Socket authentication failed."
        )
      );
    }
  });

  io.on("connection", (socket) => {
    socket.on(
      "join_workspace",
      async (workspaceId) => {
        try {
          if (
            !mongoose.Types.ObjectId.isValid(
              workspaceId
            )
          ) {
            socket.emit("socket_error", {
              message:
                "Invalid workspace ID.",
            });

            return;
          }

          const workspace =
            await Workspace.findById(
              workspaceId
            );

          if (!workspace) {
            socket.emit("socket_error", {
              message:
                "Workspace not found.",
            });

            return;
          }

          const isMember =
            workspace.members.some(
              (memberId) =>
                memberId.toString() ===
                socket.user._id.toString()
            );

          if (!isMember) {
            socket.emit("socket_error", {
              message:
                "You are not allowed to join this workspace room.",
            });

            return;
          }

          socket.join(workspaceId);

          socket.emit(
            "joined_workspace",
            {
              workspaceId,
              message:
                "Joined workspace room successfully.",
            }
          );
        } catch (error) {
          socket.emit("socket_error", {
            message:
              "Failed to join workspace room.",
          });
        }
      }
    );

    socket.on(
      "leave_workspace",
      (workspaceId) => {
        socket.leave(workspaceId);
      }
    );

    socket.on("disconnect", () => {
      // No action needed currently.
    });
  });
};

export default setupSocket;