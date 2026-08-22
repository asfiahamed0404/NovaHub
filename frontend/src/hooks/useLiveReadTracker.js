import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios.js";

/**
 * Custom hook for Live Read Tracking.
 *
 * Rules:
 * 1. On mount / workspace entry, GET read-state.
 *    - If missedCount > 0: PRESERVE checkpoint. Live read mode is OFF.
 *    - If missedCount === 0: Live read mode is ON.
 * 2. When live read mode is ON:
 *    - Active messages received or sent while document.visibilityState === "visible"
 *      advance checkpoint via debounced PUT /read-state { messageId }.
 * 3. When missedCount > 0:
 *    - Checkpoint is NOT advanced automatically by message fetch, socket reconnect,
 *      or active message events.
 * 4. After "Mark as read" succeeds (missedCount becomes 0), live read mode RESUMES.
 */
export function useLiveReadTracker({ workspaceId, logout }) {
  const [missedCount, setMissedCount] = useState(0);
  const [isLiveReadMode, setIsLiveReadMode] = useState(false);

  const pendingMessageIdRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isLiveReadModeRef = useRef(false);

  useEffect(() => {
    isLiveReadModeRef.current = isLiveReadMode;
  }, [isLiveReadMode]);

  const flushReadState = useCallback(async () => {
    const messageId = pendingMessageIdRef.current;
    if (!messageId) {
      return;
    }
    pendingMessageIdRef.current = null;

    try {
      await api.put(`/workspaces/${workspaceId}/read-state`, { messageId });
    } catch (err) {
      if (err.response?.status === 401 && typeof logout === "function") {
        logout();
      }
    }
  }, [workspaceId, logout]);

  const advanceReadStateDebounced = useCallback(
    (messageId) => {
      if (!isLiveReadModeRef.current) {
        return;
      }
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (!messageId) {
        return;
      }

      pendingMessageIdRef.current = messageId;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        flushReadState();
      }, 300);
    },
    [flushReadState]
  );

  const fetchReadState = useCallback(async () => {
    try {
      const response = await api.get(`/workspaces/${workspaceId}/read-state`);
      const count = response.data?.missedCount ?? 0;
      const latestId = response.data?.latestMessageId;

      setMissedCount(count);

      if (count === 0) {
        setIsLiveReadMode(true);
        isLiveReadModeRef.current = true;

        if (
          latestId &&
          typeof document !== "undefined" &&
          document.visibilityState === "visible"
        ) {
          advanceReadStateDebounced(latestId);
        }
      } else {
        setIsLiveReadMode(false);
        isLiveReadModeRef.current = false;
      }
    } catch (err) {
      if (err.response?.status === 401 && typeof logout === "function") {
        logout();
      }
    }
  }, [workspaceId, logout, advanceReadStateDebounced]);

  // Initial read-state load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(
          `/workspaces/${workspaceId}/read-state`
        );
        if (cancelled) {
          return;
        }

        const count = response.data?.missedCount ?? 0;
        const latestId = response.data?.latestMessageId;

        setMissedCount(count);

        if (count === 0) {
          setIsLiveReadMode(true);
          isLiveReadModeRef.current = true;

          if (
            latestId &&
            typeof document !== "undefined" &&
            document.visibilityState === "visible"
          ) {
            advanceReadStateDebounced(latestId);
          }
        } else {
          setIsLiveReadMode(false);
          isLiveReadModeRef.current = false;
        }
      } catch (err) {
        if (!cancelled && err.response?.status === 401 && typeof logout === "function") {
          logout();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (pendingMessageIdRef.current && isLiveReadModeRef.current) {
        flushReadState();
      }
    };
  }, [workspaceId, logout, advanceReadStateDebounced, flushReadState]);

  const onMessageActivity = useCallback(
    (message) => {
      if (!message?._id) {
        return;
      }
      if (isLiveReadModeRef.current) {
        advanceReadStateDebounced(message._id);
      }
    },
    [advanceReadStateDebounced]
  );

  return {
    missedCount,
    isLiveReadMode,
    fetchReadState,
    onMessageActivity,
    advanceReadStateDebounced,
  };
}
