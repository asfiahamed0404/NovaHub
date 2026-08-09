import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  MessageIcon,
  SendIcon,
} from "./Icons.jsx";
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
  const messageHistoryRef = useRef(null);
  const hasPositionedInitialHistoryRef = useRef(false);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setError("");
        setIsLoading(true);

        const response = await api.get(
          `/workspaces/${workspaceId}/messages`
        );

        hasPositionedInitialHistoryRef.current = false;
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
      // console.log(
      //   "Socket connected:",
      //   socket.id
      // );

      socket.emit(
        "join_workspace",
        workspaceId
      );
    });

    socket.on("joined_workspace", (data) => {
      // console.log(
      //   "Joined workspace room:",
      //   data
      // );
      void data;
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

  useEffect(() => {
    const messageHistory = messageHistoryRef.current;

    if (!messageHistory || isLoading) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const shouldScrollSmoothly =
      hasPositionedInitialHistoryRef.current &&
      !prefersReducedMotion;

    messageHistory.scrollTo({
      top: messageHistory.scrollHeight,
      behavior: shouldScrollSmoothly ? "smooth" : "auto",
    });

    hasPositionedInitialHistoryRef.current = true;
  }, [isLoading, messages]);

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
    <section
      className="surface-panel flex h-[70dvh] min-h-[30rem] max-h-[42rem] min-w-0 flex-col overflow-hidden"
      aria-labelledby="workspace-conversation-heading"
    >
      <header className="border-theme shrink-0 border-b px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span
            className="accent-tile flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]"
            aria-hidden="true"
          >
            <MessageIcon className="size-4" />
          </span>

          <div className="min-w-0">
            <h2
              id="workspace-conversation-heading"
              className="text-heading font-semibold"
            >
              Conversation
            </h2>
            <p className="text-muted text-xs">
              Messages shared with this workspace
            </p>
          </div>
        </div>
      </header>

      <div
        ref={messageHistoryRef}
        id="workspace-message-history"
        className="scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
        role="log"
        aria-label="Workspace conversation"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={isLoading}
        tabIndex={0}
      >
        {isLoading && (
          <div
            className="text-muted flex h-full min-h-48 items-center justify-center gap-3 text-sm"
            role="status"
          >
            <span className="spinner" aria-hidden="true" />
            <span>Loading messages...</span>
          </div>
        )}

        {error && (
          <p
            className="feedback feedback-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {!isLoading &&
          !error &&
          messages.length === 0 && (
            <div className="flex h-full min-h-48 flex-col items-center justify-center px-4 text-center">
              <span
                className="accent-tile flex size-11 items-center justify-center rounded-full"
                aria-hidden="true"
              >
                <MessageIcon className="size-5" />
              </span>
              <h3 className="text-heading mt-4 text-sm font-semibold">
                No messages yet
              </h3>
              <p className="text-muted mt-1 max-w-sm text-sm">
                Start the conversation with your team.
              </p>
            </div>
          )}

        {!isLoading && !error && messages.length > 0 && (
          <ol className="space-y-3">
            {messages.map((message) => {
              const isOwnMessage = message.sender._id === user.id;

              return (
                <li
                  key={message._id}
                  className={`flex min-w-0 ${
                    isOwnMessage
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <article
                    className={`min-w-0 max-w-[88%] rounded-[var(--radius-panel)] px-4 py-3 sm:max-w-[78%] ${
                      isOwnMessage
                        ? "message-own"
                        : "surface-subtle text-body"
                    }`}
                  >
                    {isOwnMessage ? (
                      <p className="sr-only">You</p>
                    ) : (
                      <p className="text-accent break-words text-xs font-semibold">
                        {message.sender.name}
                      </p>
                    )}

                    <p
                      className={`whitespace-pre-wrap break-words text-[0.9375rem] leading-6 [overflow-wrap:anywhere] ${
                        isOwnMessage ? "" : "mt-1"
                      }`}
                    >
                      {message.content}
                    </p>

                    <time
                      dateTime={message.createdAt}
                      className={`mt-2 block text-right text-xs ${
                        isOwnMessage
                          ? "message-own-meta"
                          : "text-muted"
                      }`}
                    >
                      {formatMessageTime(message.createdAt)}
                    </time>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="border-theme composer-surface shrink-0 border-t px-4 py-4 sm:px-6">
        <form
          onSubmit={handleSendMessage}
          className="flex min-w-0 flex-col gap-3 sm:flex-row"
        >
          <label
            htmlFor="workspace-message-input"
            className="sr-only"
          >
            Message
          </label>

          <input
            id="workspace-message-input"
            type="text"
            value={content}
            onChange={(event) => {
              setSendError("");
              setContent(event.target.value);
            }}
            placeholder="Type a message..."
            required
            maxLength={2000}
            disabled={isSending}
            aria-invalid={Boolean(sendError)}
            aria-describedby={
              sendError
                ? "workspace-message-error"
                : undefined
            }
            className="form-input min-w-0 flex-1"
          />

          <button
            type="submit"
            disabled={isSending || content.trim().length === 0}
            className="button button-primary w-full shrink-0 sm:w-auto"
            aria-busy={isSending}
          >
            {isSending ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <SendIcon className="size-4" />
            )}
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>

        {sendError && (
          <p
            id="workspace-message-error"
            className="feedback feedback-error mt-3"
            role="alert"
          >
            {sendError}
          </p>
        )}
      </div>
    </section>
  );
}

export default WorkspaceMessages;
