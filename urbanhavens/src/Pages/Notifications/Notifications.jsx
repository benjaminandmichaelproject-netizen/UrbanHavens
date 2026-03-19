import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCalendarCheck, FaSearch, FaHome } from "react-icons/fa";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../../Dashboard/Owner/UploadDetails/api/api";
import "./Notifications.css";

const Notifications = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    if (type === "meeting") return <FaCalendarCheck />;
    if (type === "booking") return <FaHome />;
    return <FaBell />;
  };

  const getGroupLabel = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const cleanDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const cleanToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const cleanYesterday = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    );

    if (cleanDate.getTime() === cleanToday.getTime()) return "Today";
    if (cleanDate.getTime() === cleanYesterday.getTime()) return "Yesterday";

    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const roleFilteredNotifications = useMemo(() => {
    if (role === "owner") {
      return notifications.filter((item) => item.notification_type === "booking");
    }
    return notifications.filter((item) => item.notification_type === "meeting");
  }, [notifications, role]);

  const filteredNotifications = useMemo(() => {
    let data = [...roleFilteredNotifications];

    if (activeTab === "unread") {
      data = data.filter((item) => !item.is_read);
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      data = data.filter(
        (item) =>
          item.title?.toLowerCase().includes(query) ||
          item.message?.toLowerCase().includes(query)
      );
    }

    return data;
  }, [roleFilteredNotifications, activeTab, searchTerm]);

  const unreadCount = useMemo(() => {
    return roleFilteredNotifications.filter((item) => !item.is_read).length;
  }, [roleFilteredNotifications]);

  const groupedNotifications = useMemo(() => {
    return filteredNotifications.reduce((acc, notification) => {
      const group = getGroupLabel(notification.created_at || new Date().toISOString());
      if (!acc[group]) acc[group] = [];
      acc[group].push(notification);
      return acc;
    }, {});
  }, [filteredNotifications]);

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item
          )
        );
      }

      navigate(notification.link);
    } catch (error) {
      console.error("Failed to open notification:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  if (loading) {
    return (
      <div className="notifications-page modern-notifications">
        <div className="notifications-loading-card">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="notifications-page modern-notifications">
      <div className="notifications-shell">
        <div className="notifications-topbar">
          <h1>Notifications</h1>
        </div>

        <div className="notifications-search-wrap">
          <FaSearch className="notifications-search-icon" />
          <input
            type="text"
            placeholder="Search notifications"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="notifications-search-input"
          />
        </div>

        <div className="notifications-toolbar">
          <div className="notifications-tabs">
            <button
              className={`notifications-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <span>All</span>
              <strong>{roleFilteredNotifications.length}</strong>
            </button>

            <button
              className={`notifications-tab ${activeTab === "unread" ? "active" : ""}`}
              onClick={() => setActiveTab("unread")}
            >
              <span>Unread</span>
              <strong>{unreadCount}</strong>
            </button>
          </div>

          {roleFilteredNotifications.length > 0 && unreadCount > 0 && (
            <button className="mark-all-read-link" onClick={handleMarkAllRead}>
              Mark all as read
            </button>
          )}
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="notifications-empty-state">
            <div className="notifications-empty-illustration">
              <FaBell />
            </div>
            <p>Looks like there's nothing here</p>
          </div>
        ) : (
          <div className="notifications-groups">
            {Object.entries(groupedNotifications).map(([groupTitle, items]) => (
              <div key={groupTitle} className="notification-group">
                <h3 className="notification-group-title">{groupTitle}</h3>

                <div className="notification-group-list">
                  {items.map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-row ${
                        notification.is_read ? "read" : "unread"
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div
                        className={`notification-row-icon ${
                          notification.notification_type === "meeting"
                            ? "meeting-icon"
                            : "booking-icon"
                        }`}
                      >
                        {getNotificationIcon(notification.notification_type)}
                      </div>

                      <div className="notification-row-content">
                        <div className="notification-row-main">
                          <h4>{notification.title}</h4>
                          <p>{notification.message}</p>
                        </div>

                        <div className="notification-row-meta">
                          {!notification.is_read && <span className="row-unread-dot"></span>}
                          <span>{notification.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;