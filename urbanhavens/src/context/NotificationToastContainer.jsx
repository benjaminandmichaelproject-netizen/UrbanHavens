import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "./NotificationContext";
import { FaBell, FaTimes, FaUserShield } from "react-icons/fa";
import "./NotificationToast.css";

const AUTO_DISMISS_MS = 7000;

const NotificationToastContainer = () => {
  const navigate = useNavigate();
  const { toasts, removeToast, markAsRead } = useNotifications();

  // Auto-dismiss each toast after AUTO_DISMISS_MS
  useEffect(() => {
    if (!toasts.length) return;

    const timers = toasts.map((toast) =>
      setTimeout(() => removeToast(toast.id), AUTO_DISMISS_MS)
    );

    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  const handleToastClick = async (toast) => {
    // Support toasts are already marked read (synthetic), skip API call
    if (!toast.is_read && toast.notification_type !== "support") {
      await markAsRead(toast.id);
    }

    removeToast(toast.id);

    if (toast.related_property_id) {
      navigate(`/detail/${toast.related_property_id}`);
    } else if (toast.notification_type !== "support") {
      navigate("/notifications");
    }
    // Support toasts just dismiss — no navigation needed
  };

  if (!toasts.length) return null;

  return (
    <div className="notification-toast-container">
      {toasts.map((toast) => {
        const isSupport = toast.notification_type === "support";

        return (
          <div
            key={toast.id}
            className={`notification-toast ${isSupport ? "notification-toast--support" : ""}`}
          >
            <div
              className="notification-toast-body"
              onClick={() => handleToastClick(toast)}
            >
              <div className={`notification-toast-icon ${isSupport ? "notification-toast-icon--support" : ""}`}>
                {isSupport ? <FaUserShield /> : <FaBell />}
              </div>

              <div className="notification-toast-content">
                <h4>{isSupport ? "Support Session" : "New Notification"}</h4>
                <p>{toast.message}</p>
              </div>
            </div>

            <button
              className="notification-toast-close"
              onClick={() => removeToast(toast.id)}
            >
              <FaTimes />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationToastContainer;