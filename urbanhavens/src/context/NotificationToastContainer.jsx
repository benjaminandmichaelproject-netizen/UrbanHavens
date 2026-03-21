// src/components/Notifications/NotificationToastContainer.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "./NotificationContext";
import { FaBell, FaTimes } from "react-icons/fa";
import "./NotificationToast.css";

const NotificationToastContainer = () => {
  const navigate = useNavigate();
  const { toasts, removeToast, markAsRead } = useNotifications();

  const handleToastClick = async (toast) => {
    if (!toast.is_read) {
      await markAsRead(toast.id);
    }

    removeToast(toast.id);

    if (toast.related_property_id) {
      navigate(`/detail/${toast.related_property_id}`);
    } else {
      navigate("/notifications");
    }
  };

  if (!toasts.length) return null;

  return (
    <div className="notification-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="notification-toast">
          <div
            className="notification-toast-body"
            onClick={() => handleToastClick(toast)}
          >
            <div className="notification-toast-icon">
              <FaBell />
            </div>

            <div className="notification-toast-content">
              <h4>New Notification</h4>
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
      ))}
    </div>
  );
};

export default NotificationToastContainer;