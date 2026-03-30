import React, { useEffect, useState, useCallback } from "react";
import {
  FaUsers,
  FaHome,
  FaCalendarCheck,
  FaClipboardCheck,
  FaArrowUp,
  FaBell,
  FaTrash,
  FaUserShield,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaEnvelopeOpenText,
} from "react-icons/fa";
import "./AdminDashboard.css";
import { useNavigate } from "react-router-dom";
import { api } from "../../Owner/UploadDetails/api/api";
import { useNotifications } from "../../../context/NotificationContext";

const SUPPORT_EVENT_MESSAGES = {
  support_invite_received:    "An owner has requested your assistance.",
  support_invite_accepted:    "Support session is now live.",
  support_invite_declined:    "You declined a support invite.",
  support_session_terminated: "A support session was ended.",
  support_session_expired:    "A support session has expired.",
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { notifications, setNotifications, setUnreadCount } = useNotifications();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProperties: 0,
    pendingProperties: 0,
    totalBookings: 0,
  });

  const [loading, setLoading] = useState(true);
  const [supportInvites, setSupportInvites] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [supportActionLoading, setSupportActionLoading] = useState(null);
  const [activeSupportSession, setActiveSupportSession] = useState(null);

  // Local support activity entries — merged into the activity feed
  const [supportActivities, setSupportActivities] = useState([]);

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    setSupportActivities([]);
  };

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

  // Merge real notifications + local support activities, newest first, max 5
  const activities = [
    ...supportActivities,
    ...notifications.slice(0, 5).map(formatActivity),
  ]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 5);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [usersRes, propertiesRes, bookingsRes] = await Promise.allSettled([
        api.get("/users/all-users/"),
        api.get("/properties/admin-list/"),
        api.get("/bookings/"),
      ]);

      const totalUsers =
        usersRes.status === "fulfilled"
          ? Array.isArray(usersRes.value.data)
            ? usersRes.value.data.length
            : usersRes.value.data.results?.length ?? 0
          : 0;

      let totalProperties = 0;
      let pendingProperties = 0;

      if (propertiesRes.status === "fulfilled") {
        const propData = propertiesRes.value.data;
        const propList = Array.isArray(propData) ? propData : propData.results ?? [];
        totalProperties = propList.length;
        pendingProperties = propList.filter(
          (p) => p.approval_status === "pending"
        ).length;
      }

      const totalBookings =
        bookingsRes.status === "fulfilled"
          ? Array.isArray(bookingsRes.value.data)
            ? bookingsRes.value.data.length
            : bookingsRes.value.data.results?.length ?? 0
          : 0;

      setStats({ totalUsers, totalProperties, pendingProperties, totalBookings });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSupportInvites = useCallback(async () => {
    try {
      setSupportLoading(true);
      const res = await api.get("/support/admin/pending/");
      setSupportInvites(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch support invites", err);
    } finally {
      setSupportLoading(false);
    }
  }, []);

  const fetchCurrentSupportSession = useCallback(async () => {
    try {
      const res = await api.get("/support/admin/current/");
      setActiveSupportSession(res.data || null);
    } catch (err) {
      console.error("Failed to fetch current support session", err);
      setActiveSupportSession(null);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchSupportInvites();
    fetchCurrentSupportSession();
  }, [fetchDashboardData, fetchSupportInvites, fetchCurrentSupportSession]);

  // ── Listen for support WebSocket events
  useEffect(() => {
    const handleSupportEvent = async (e) => {
      const data = e.detail;
      if (!data?.event) return;

      if (typeof data.event === "string" && data.event.startsWith("support_")) {
        // Refresh invites & session
        await Promise.all([
          fetchSupportInvites(),
          fetchCurrentSupportSession(),
        ]);

        // Add to local activity feed
        const message =
          SUPPORT_EVENT_MESSAGES[data.event] || "Support session updated.";

        const now = Date.now();
        const activityEntry = {
          id: `support_${data.event}_${data.session_id || now}`,
          message,
          type: "support",
          is_read: true,
          timestamp: now,
          date: new Date(now).toLocaleDateString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        setSupportActivities((prev) => {
          // Deduplicate
          if (prev.some((a) => a.id === activityEntry.id)) return prev;
          return [activityEntry, ...prev].slice(0, 5);
        });
      }
    };

    window.addEventListener("support_event", handleSupportEvent);
    return () => window.removeEventListener("support_event", handleSupportEvent);
  }, [fetchSupportInvites, fetchCurrentSupportSession]);

  const handleRespondToInvite = async (sessionId, action) => {
    try {
      setSupportActionLoading(`${sessionId}-${action}`);
      await api.post(`/support/admin/respond/${sessionId}/`, { action });
      await Promise.all([fetchSupportInvites(), fetchCurrentSupportSession()]);
    } catch (err) {
      console.error(`Failed to ${action} invite`, err);
      alert(err.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setSupportActionLoading(null);
    }
  };

  const statCards = [
    { title: "Total Users",       value: stats.totalUsers,        icon: <FaUsers />,         note: "All registered users" },
    { title: "Total Properties",  value: stats.totalProperties,   icon: <FaHome />,           note: "All listings on platform" },
    { title: "Bookings",          value: stats.totalBookings,     icon: <FaCalendarCheck />,  note: "All booking requests" },
    { title: "Pending Approvals", value: stats.pendingProperties, icon: <FaClipboardCheck />, note: "Needs review" },
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

      <div className="ad-support-section">
        <div className="ad-support-head">
          <div className="ad-support-head-left">
            <FaUserShield className="ad-support-head-icon" />
            <div>
              <h3 className="ad-support-title">Owner Assistance Invites</h3>
              <p className="ad-support-subtitle">
                Accept or decline temporary assistance requests.
              </p>
            </div>
          </div>
        </div>

        {activeSupportSession && (
          <div className="ad-support-empty" style={{ marginBottom: "16px" }}>
            <p>
              <strong>Active session:</strong>{" "}
              {activeSupportSession.owner_name || "Owner linked"}{" "}
              {activeSupportSession.owner_email
                ? `— ${activeSupportSession.owner_email}`
                : ""}
            </p>
          </div>
        )}

        {supportLoading ? (
          <div className="ad-support-empty">Loading support invites...</div>
        ) : supportInvites.length === 0 ? (
          <div className="ad-support-empty">
            <FaEnvelopeOpenText className="ad-support-empty-icon" />
            <p>No pending assistance invites.</p>
          </div>
        ) : (
          <div className="ad-support-grid">
            {supportInvites.map((invite) => (
              <div key={invite.id} className="ad-support-card">
                <div className="ad-support-card-top">
                  <div>
                    <p className="ad-support-owner">{invite.owner_name}</p>
                    <p className="ad-support-owner-email">{invite.owner_email}</p>
                  </div>
                  <span className="ad-support-badge">{invite.status}</span>
                </div>

                <p className="ad-support-reason">
                  {invite.reason || "Help me post a property"}
                </p>

                <div className="ad-support-meta">
                  <span>
                    <FaClock /> {invite.duration_minutes || 30} mins
                  </span>
                </div>

                <div className="ad-support-actions">
                  <button
                    className="ad-support-btn ad-support-btn--accept"
                    onClick={() => handleRespondToInvite(invite.id, "accept")}
                    disabled={supportActionLoading === `${invite.id}-accept`}
                  >
                    <FaCheckCircle />
                    {supportActionLoading === `${invite.id}-accept`
                      ? "Accepting..."
                      : "Accept"}
                  </button>

                  <button
                    className="ad-support-btn ad-support-btn--decline"
                    onClick={() => handleRespondToInvite(invite.id, "decline")}
                    disabled={supportActionLoading === `${invite.id}-decline`}
                  >
                    <FaTimesCircle />
                    {supportActionLoading === `${invite.id}-decline`
                      ? "Declining..."
                      : "Decline"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-dashboard-bottom">
        <div className="admin-panel admin-activity-panel">
          <div className="activity-panel-header">
            <h3>Recent Activity</h3>
            {activities.length > 0 && (
              <button className="clear-activity-btn" onClick={clearNotifications}>
                <FaTrash />
                <span>Clear</span>
              </button>
            )}
          </div>

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
                    {activity.type === "support" ? (
                      <FaUserShield style={{ color: "#1a7a40" }} />
                    ) : (
                      <FaBell />
                    )}
                  </div>
                  <div className="activity-body">
                    <p>{activity.message}</p>
                    <span className="activity-date">{activity.date}</span>
                  </div>
                  {!activity.is_read && <span className="activity-dot" />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="activity-empty">No recent activity.</p>
          )}
        </div>

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
            <button onClick={() => navigate("/dashboard/admin/schools-regions")}>
             Add Schools and region
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;