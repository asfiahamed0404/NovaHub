import { io } from "socket.io-client";

const createSocket = () => {
  const token = localStorage.getItem("novahub_token");

  const socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: {
      token: token,
    },
  });

  return socket;
};

export default createSocket;