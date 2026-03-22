import React, { useEffect, useState } from "react";
import {
  FaUsers,
  FaHome,
  FaCalendarCheck,
  FaClipboardCheck,
  FaArrowUp,
  FaBell,
} from "react-icons/fa";
import "./AdminDashboard.css";
import { useNavigate } from "react-router-dom";
import { api } from "../../Owner/UploadDetails/api/api";
import { useNotifications } from "../../../context/NotificationContext";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { notifications } = useNotifications();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProperties: 0,
    pendingProperties: 0,
    totalBookings: 0,
  });

  const [loading, setLoading] = useState(true);

  const formatActivity = (notification) => {
    const date = notification.created_at
      ? new Date(notification.created_at).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    return {
      id: notification.id,
      message: notification.message,
      type: notification.notification_type || "general",
      date,
      is_read: notification.is_read,
    };
  };

  // Derived directly from NotificationContext — updates in real time
  // when the WebSocket pushes a new notification
  const activities = notifications.slice(0, 5).map(formatActivity);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Notifications are already handled by NotificationContext
        // so we only fetch stats here
        const [usersRes, propertiesRes, bookingsRes] =
          await Promise.allSettled([
            api.get("/users/all-users/"),
            api.get("/properties/admin-list/"),
            api.get("/bookings/"),
          ]);

        // ── Users ──────────────────────────────────────────────────────
        const totalUsers =
          usersRes.status === "fulfilled"
            ? Array.isArray(usersRes.value.data)
              ? usersRes.value.data.length
              : usersRes.value.data.results?.length ?? 0
            : 0;

        // ── Properties ─────────────────────────────────────────────────
        let totalProperties = 0;
        let pendingProperties = 0;

        if (propertiesRes.status === "fulfilled") {
          const propData = propertiesRes.value.data;
          const propList = Array.isArray(propData)
            ? propData
            : propData.results ?? [];

          totalProperties = propList.length;
          pendingProperties = propList.filter(
            (p) => p.approval_status === "pending"
          ).length;
        }

        // ── Bookings ───────────────────────────────────────────────────
        const totalBookings =
          bookingsRes.status === "fulfilled"
            ? Array.isArray(bookingsRes.value.data)
              ? bookingsRes.value.data.length
              : bookingsRes.value.data.results?.length ?? 0
            : 0;

        setStats({
          totalUsers,
          totalProperties,
          pendingProperties,
          totalBookings,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: <FaUsers />,
      note: "All registered users",
    },
    {
      title: "Total Properties",
      value: stats.totalProperties,
      icon: <FaHome />,
      note: "All listings on platform",
    },
    {
      title: "Bookings",
      value: stats.totalBookings,
      icon: <FaCalendarCheck />,
      note: "All booking requests",
    },
    {
      title: "Pending Approvals",
      value: stats.pendingProperties,
      icon: <FaClipboardCheck />,
      note: "Needs review",
    },
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Welcome back. Here's an overview of the UrbanHavens platform.</p>
        </div>

        <div className="action-btn">
          <button className="admin-action-btn">
            <FaArrowUp />
            <span>Generate Report</span>
          </button>
          <button
            className="admin-action-btn"
            onClick={() => navigate("/dashboard/admin/add-property")}
          >
            <FaArrowUp />
            <span>Add Property</span>
          </button>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────── */}
      <div className="admin-stats-grid">
        {statCards.map((item, index) => (
          <div className="admin-stat-card" key={index}>
            <div className="admin-stat-top">
              <div className="admin-stat-icon">{item.icon}</div>
              <h3>{item.title}</h3>
            </div>
            <h2>{loading ? "..." : item.value}</h2>
            <p>{item.note}</p>
          </div>
        ))}
      </div>

      {/* ── Bottom Panels ──────────────────────────────────────────────── */}
      <div className="admin-dashboard-bottom">

        {/* Recent Activity — live from NotificationContext WebSocket */}
        <div className="admin-panel admin-activity-panel">
          <h3>Recent Activity</h3>

          {loading ? (
            <p className="activity-loading">Loading activity...</p>
          ) : activities.length > 0 ? (
            <ul>
              {activities.map((activity) => (
                <li
                  key={activity.id}
                  className={`activity-item ${activity.is_read ? "read" : "unread"}`}
                >
                  <div className="activity-icon">
                    <FaBell />
                  </div>
                  <div className="activity-body">
                    <p>{activity.message}</p>
                    <span className="activity-date">{activity.date}</span>
                  </div>
                  {!activity.is_read && (
                    <span className="activity-dot" />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="activity-empty">No recent activity.</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="admin-panel admin-actions-panel">
          <h3>Quick Actions</h3>
          <div className="admin-quick-actions">
            <button onClick={() => navigate("/dashboard/admin/users")}>
              Manage Users
            </button>
            <button onClick={() => navigate("/dashboard/admin/properties")}>
              View Properties
            </button>
            <button onClick={() => navigate("/dashboard/admin/pending")}>
              Review Approvals
            </button>
            <button onClick={() => navigate("/dashboard/admin/bookings")}>
              Check Bookings
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
