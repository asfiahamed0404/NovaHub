import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import app from "./app.js";
import setupSocket from "./sockets/socketHandler.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
    },
  });

  app.set("io", io);

  setupSocket(io);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();
