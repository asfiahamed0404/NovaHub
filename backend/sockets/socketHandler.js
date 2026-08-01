const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`🟢 Socket connected: ${socket.id}`);

    socket.on("join_workspace", (workspaceId) => {
      socket.join(workspaceId);

      console.log(
        `Socket ${socket.id} joined workspace room: ${workspaceId}`
      );
    });

    socket.on("leave_workspace", (workspaceId) => {
      socket.leave(workspaceId);

      console.log(
        `Socket ${socket.id} left workspace room: ${workspaceId}`
      );
    });

    socket.on("disconnect", () => {
      console.log(`🔴 Socket disconnected: ${socket.id}`);
    });
  });
};

export default setupSocket;