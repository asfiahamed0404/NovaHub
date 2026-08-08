import { io } from "socket.io-client";

const createSocket = () => {
  const token = localStorage.getItem("novahub_token");

  const socket = io("http://localhost:5000", {
    auth: {
      token: token,
    },
  });

  return socket;
};

export default createSocket;