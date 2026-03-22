import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import notificationSound from "../notificationSound/sound.mp3";
import { api, refreshAccessToken } from "../Dashboard/Owner/UploadDetails/api/api";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [toasts, setToasts] = useState([]);

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  const removeToast = (toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  };

  // ─── Fetch notifications (always refresh token first) ──────────────────────
  const fetchNotifications = useCallback(async () => {
    // Refresh token before making the request so we never hit a stale token
    const token = await refreshAccessToken();

    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const res = await api.get("/notifications/");
      const data = res.data;
      const results = Array.isArray(data) ? data : data.results || [];

      if (!isMountedRef.current) return;
      setNotifications(results);
      setUnreadCount(results.filter((item) => !item.is_read).length);
    } catch (error) {
      console.error("Notification fetch error:", error);
    }
  }, []);

  // ─── Connect WebSocket (always refresh token first) ────────────────────────
  const connectSocket = useCallback(async () => {
    // Clear any pending reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Close any existing socket cleanly before opening a new one
    if (socketRef.current) {
      socketRef.current.onclose = null; // prevent triggering reconnect on manual close
      socketRef.current.close();
      socketRef.current = null;
    }

    // Always get a fresh token before connecting
    const token = await refreshAccessToken();

    if (!token || !isMountedRef.current) {
      setSocketConnected(false);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? "127.0.0.1:8000"
        : window.location.host;

    const socket = new WebSocket(
      `${protocol}://${host}/ws/notifications/?token=${token}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      if (!isMountedRef.current) return;
      setSocketConnected(true);
      console.log("Notification socket connected");
    };

    socket.onclose = (event) => {
      if (!isMountedRef.current) return;
      setSocketConnected(false);
      console.log("Notification socket disconnected, code:", event.code);

      // code 4001 = rejected by consumer (bad/expired token) — still retry
      // Don't retry only if the component has unmounted
      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          console.log("Attempting socket reconnect...");
          connectSocket();
        }
      }, 5000);
    };

    socket.onerror = (error) => {
      console.error("Notification socket error:", error);
    };

    socket.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data);

        if (data.event === "notification_counter_update") {
          setUnreadCount(data.unread_count);
          return;
        }

        if (!data.id || !data.created_at) return;

        // Deduplicate — don't add if already in the list
        setNotifications((prev) => {
          if (prev.some((n) => n.id === data.id)) return prev;
          return [data, ...prev];
        });

        setUnreadCount((prev) => prev + 1);

        // Deduplicate toasts too
        setToasts((prev) => {
          if (prev.some((t) => t.id === data.id)) return prev;
          return [data, ...prev];
        });

        new Audio(notificationSound).play().catch(() => {});
      } catch (error) {
        console.error("Invalid socket payload:", error);
      }
    };
  }, []);

  // ─── Boot on mount, clean up on unmount ────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    fetchNotifications();
    connectSocket();

    return () => {
      isMountedRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      if (socketRef.current) {
        socketRef.current.onclose = null; // prevent reconnect on intentional unmount
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [fetchNotifications, connectSocket]);

  // ─── Mark single notification as read ─────────────────────────────────────
  const markAsRead = async (notificationId) => {
    try {
      const res = await api.post(`/notifications/${notificationId}/mark_as_read/`);
      const data = res.data;

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item
        )
      );

      if (typeof data.unread_count === "number") {
        setUnreadCount(data.unread_count);
      } else {
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }
    } catch (error) {
      console.error("markAsRead error:", error);
    }
  };

  // ─── Mark all notifications as read ───────────────────────────────────────
  const markAllAsRead = async () => {
    try {
      const res = await api.post("/notifications/mark_all_as_read/");
      const data = res.data;

      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );

      if (typeof data.unread_count === "number") {
        setUnreadCount(data.unread_count);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("markAllAsRead error:", error);
    }
  };

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      socketConnected,
      toasts,
      removeToast,
      markAsRead,
      markAllAsRead,
      refreshNotifications: fetchNotifications,
      reconnectNotifications: connectSocket,
      setNotifications,
      setUnreadCount,
    }),
    [notifications, unreadCount, socketConnected, toasts, fetchNotifications, connectSocket]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }

  return context;
};
