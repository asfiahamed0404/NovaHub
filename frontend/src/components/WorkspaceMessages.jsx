import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import createSocket from "../socket/socket.js";

import api from "../api/axios.js";

function formatMessageTime(dateString) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WorkspaceMessages({ workspaceId }) {
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setError("");
        setIsLoading(true);

        const response = await api.get(
          `/workspaces/${workspaceId}/messages`
        );

        setMessages(response.data.messages);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Failed to load messages."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [workspaceId]);

  // useEffect(() => {
  //   const socket = createSocket();

  //   socket.on("connect", () => {
  //     console.log(
  //       "Socket connected:",
  //       socket.id
  //     );
  //   });

  //   socket.on("connect_error", (error) => {
  //     console.error(
  //       "Socket connection failed:",
  //       error.message
  //     );
  //   });

  //   return () => {
  //     socket.disconnect();
  //   };
  // }, []);

  useEffect(() => {
    const socket = createSocket();

    const handleNewMessage = (newMessage) => {
      setMessages((currentMessages) => {
        const alreadyExists = currentMessages.some(
          (message) =>
            message._id === newMessage._id
        );

        if (alreadyExists) {
          return currentMessages;
        }

        return [
          ...currentMessages,
          newMessage,
        ];
      });
    };

    socket.on("connect", () => {
      console.log(
        "Socket connected:",
        socket.id
      );

      socket.emit(
        "join_workspace",
        workspaceId
      );
    });

    socket.on("joined_workspace", (data) => {
      console.log(
        "Joined workspace room:",
        data
      );
    });

    // socket.on("new_message", (newMessage) => {
    //   setMessages((currentMessages) => {
    //     const alreadyExists = currentMessages.some(
    //       (message) => message._id === newMessage._id
    //     );

    //     if (alreadyExists) {
    //       return currentMessages;
    //     }

    //     return [
    //       ...currentMessages,
    //       newMessage,
    //     ];
    //   });
    // });
    socket.on(
      "new_message",
      handleNewMessage
    );

    socket.on("socket_error", (data) => {
      console.error(
        "Socket error:",
        data.message
      );
    });

    socket.on("connect_error", (error) => {
      console.error(
        "Socket connection failed:",
        error.message
      );
    });

    return () => {
      socket.off(
        "new_message",
        handleNewMessage
      );
      
      socket.emit(
        "leave_workspace",
        workspaceId
      );

      socket.disconnect();
    };
  }, [workspaceId]);

  const handleSendMessage = async (event) => {
    event.preventDefault();

    try {
      setSendError("");
      setIsSending(true);

      const response = await api.post(
        `/workspaces/${workspaceId}/messages`,
        {
          content: content,
        }
      );

      // setMessages((currentMessages) => [
      //   ...currentMessages,
      //   response.data.chatMessage,
      // ]);

      setMessages((currentMessages) => {
        const newMessage =
          response.data.chatMessage;

        const alreadyExists =
          currentMessages.some(
            (message) =>
              message._id === newMessage._id
          );

        if (alreadyExists) {
          return currentMessages;
        }

        return [
          ...currentMessages,
          newMessage,
        ];
      });

      setContent("");
    } catch (error) {
      setSendError(
        error.response?.data?.message ||
          "Failed to send message."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-semibold">
        Messages
      </h2>

      {isLoading && (
        <p className="mt-3 text-slate-400">
          Loading messages...
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {!isLoading &&
        !error &&
        messages.length === 0 && (
          <p className="mt-3 text-slate-500">
            No messages yet.
          </p>
        )}

      {!isLoading && !error && messages.length > 0 && (
        <div className="mt-4 space-y-3">
          {messages.map((message) => {
            const isOwnMessage = message.sender._id === user.id;

            return (
              <div
                key={message._id}
                className={`flex ${
                  isOwnMessage
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-xl p-4 ${
                    isOwnMessage
                      ? "bg-blue-600"
                      : "bg-slate-950"
                  }`}
                >
                  {!isOwnMessage && (
                    <p className="text-sm font-medium text-blue-300">
                      {message.sender.name}
                    </p>
                  )}

                  <p
                    className={
                      isOwnMessage
                        ? "text-white"
                        : "mt-1 text-slate-300"
                    }
                  >
                    {message.content}
                  </p>

                  <p
                    className={`mt-2 text-xs ${
                      isOwnMessage
                        ? "text-blue-200"
                        : "text-slate-500"
                    }`}
                  >
                    {formatMessageTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="mt-5 flex gap-3"
      >
        <input
          type="text"
          value={content}
          onChange={(event) =>
            setContent(event.target.value)
          }
          placeholder="Type a message..."
          required
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
        />

        <button
          type="submit"
          disabled={isSending}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>

      {sendError && (
        <p className="mt-3 text-sm text-red-400">
          {sendError}
        </p>
      )}

    </div>
  );
}

export default WorkspaceMessages;