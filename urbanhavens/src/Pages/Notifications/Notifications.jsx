import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import "./Notifications.css";

const Notification = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    socketConnected,
  } = useNotifications();

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.is_read);
    }
    if (filter === "read") {
      return notifications.filter((item) => item.is_read);
    }
    return notifications;
  }, [notifications, filter]);

  const formatDate = (dateString) => {
  if (!dateString) return "Unknown date";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
  const groupedNotifications = useMemo(() => {
    return filteredNotifications.reduce((groups, notification) => {
      const dateKey = formatDate(notification.created_at);

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(notification);
      return groups;
    }, {});
  }, [filteredNotifications]);

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (notification.related_property_id) {
      navigate(`/detail/${notification.related_property_id}`);
    }
  };

  return (
    <div className="notification-page">
      <div className="notification-header">
        <div>
          <h2>Notifications</h2>
          <p>
            {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="notification-header-actions">
          <span className={`socket-status ${socketConnected ? "live" : "offline"}`}>
            {socketConnected ? "Live" : "Offline"}
          </span>

          <button
            className="mark-all-btn"
            onClick={markAllAsRead}
            disabled={notifications.length === 0 || unreadCount === 0}
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div className="notification-filters">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>

        <button
          className={filter === "unread" ? "active" : ""}
          onClick={() => setFilter("unread")}
        >
          Unread
        </button>

        <button
          className={filter === "read" ? "active" : ""}
          onClick={() => setFilter("read")}
        >
          Read
        </button>
      </div>

      <div className="notification-list">
        {Object.keys(groupedNotifications).length > 0 ? (
          Object.entries(groupedNotifications).map(([date, items]) => (
            <div key={date} className="notification-group">
              <h4 className="notification-date">{date}</h4>

              {items.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-card ${
                    notification.is_read ? "read" : "unread"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-content">
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-type">
                      {notification.notification_type}
                    </span>
                  </div>

                  {!notification.is_read && (
                    <span className="notification-dot"></span>
                  )}
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="empty-notifications">
            <p>No notifications found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notification;