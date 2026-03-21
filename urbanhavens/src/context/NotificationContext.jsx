import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import notificationSound from "../notificationSound/sound.mp3";
const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [toasts, setToasts] = useState([]);
  const socketRef = useRef(null);

  const token = localStorage.getItem("token");

  const fetchNotifications = async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const res = await fetch("/api/notifications/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await res.json();
      const results = Array.isArray(data) ? data : data.results || [];

      setNotifications(results);
      setUnreadCount(results.filter((item) => !item.is_read).length);
    } catch (error) {
      console.error("Notification fetch error:", error);
    }
  };

  const removeToast = (toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  };

  useEffect(() => {
    if (!token) return;

    fetchNotifications();

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host =
      window.location.hostname === "localhost"
        ? "127.0.0.1:8000"
        : window.location.host;

    const socket = new WebSocket(
      `${protocol}://${host}/ws/notifications/?token=${token}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      setSocketConnected(true);
      console.log("Notification socket connected");
    };

    socket.onclose = () => {
      setSocketConnected(false);
      console.log("Notification socket disconnected");
    };

    socket.onerror = (error) => {
      console.error("Notification socket error:", error);
    };
socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.event === "notification_counter_update") {
      setUnreadCount(data.unread_count);
      return;
    }

    if (!data.id || !data.created_at) return;

    setNotifications((prev) => [data, ...prev]);
    setUnreadCount((prev) => prev + 1);
    setToasts((prev) => [data, ...prev]);

    // 🔊 PLAY SOUND HERE
    new Audio(notificationSound).play().catch(() => {
      // browsers sometimes block autoplay
    });

  } catch (error) {
    console.error("Invalid socket payload:", error);
  }
};

    return () => {
      socket.close();
    };
  }, [token]);

  const markAsRead = async (notificationId) => {
    if (!token) return;

    try {
      const res = await fetch(
        `/api/notifications/${notificationId}/mark_as_read/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to mark notification as read");
      }

      const data = await res.json();

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

  const markAllAsRead = async () => {
    if (!token) return;

    try {
      const res = await fetch("/api/notifications/mark_all_as_read/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to mark all as read");
      }

      const data = await res.json();

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
      setNotifications,
      setUnreadCount,
    }),
    [notifications, unreadCount, socketConnected, toasts]
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