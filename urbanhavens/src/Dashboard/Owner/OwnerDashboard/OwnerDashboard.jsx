import { useEffect, useState, useCallback, useRef } from "react";
import "./OwnerDashboard.css";
import MyProperties from "../MyProperties/MyProperties";
import { useNavigate } from "react-router-dom";
import { api } from "../UploadDetails/api/api";
import { motion } from "framer-motion";
import AdminInviteModal from "../../../components/Modals/AdminInviteModal";
import {
  FaHome,
  FaCalendarCheck,
  FaFileContract,
  FaMoneyBillWave,
  FaBed,
  FaDoorOpen,
  FaDoorClosed,
  FaPlus,
  FaArrowRight,
  FaChartLine,
  FaClipboardList,
  FaUserShield,
  FaClock,
} from "react-icons/fa";

const username = localStorage.getItem("username") || "Owner";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const OwnerDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [propCount, setPropCount] = useState(0);
  const [bookingCount, setBookingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [admins, setAdmins] = useState([]);

  const [supportSession, setSupportSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");

  // ── Ref so the countdown interval always reads the latest expiresAt
  //    without being in the dependency array (avoids interval restart every tick)
  const expiresAtRef = useRef(null);

  const normalizeSupportSession = useCallback((data) => {
    if (!data) return null;
    return {
      id: data.id,
      adminId: data.admin,
      adminName: data.admin_name,
      adminEmail: data.admin_email,
      reason: data.reason,
      status: data.status?.toLowerCase?.() || data.status || null,
      startedAt: data.started_at ? new Date(data.started_at).getTime() : null,
      expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : null,
      endedAt: data.ended_at ? new Date(data.ended_at).getTime() : null,
    };
  }, []);

  const fetchCurrentSupportSession = useCallback(async () => {
    try {
      const res = await api.get("/support/owner/current/");
      const normalized = normalizeSupportSession(res.data);
      setSupportSession(normalized);
      // Keep ref in sync so the countdown always has the latest value
      expiresAtRef.current = normalized?.expiresAt ?? null;
    } catch (err) {
      console.error("Failed to fetch support session", err);
      setSupportSession(null);
      expiresAtRef.current = null;
    }
  }, [normalizeSupportSession]);

  // ── Fetch admins list
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const res = await api.get("/support/active-admins/");
        setAdmins(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch admins", err);
      }
    };
    fetchAdmins();
  }, []);

  // ── Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [leaseRes, propRes, bookingRes] = await Promise.allSettled([
          api.get("/leases/owner-stats/"),
          api.get("/properties/my-properties/"),
          api.get("/bookings/my_owner_bookings/"),
        ]);

        if (leaseRes.status === "fulfilled") setStats(leaseRes.value.data);
        if (propRes.status === "fulfilled") {
          const d = propRes.value.data;
          setPropCount(Array.isArray(d) ? d.length : d.results?.length ?? 0);
        }
        if (bookingRes.status === "fulfilled") {
          const d = bookingRes.value.data;
          setBookingCount(Array.isArray(d) ? d.length : d.results?.length ?? 0);
        }
      } catch (err) {
        console.error("OwnerDashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // ── Initial support session fetch
  useEffect(() => {
    fetchCurrentSupportSession();
  }, [fetchCurrentSupportSession]);

  // ── Listen for WebSocket support events dispatched by NotificationContext
  useEffect(() => {
    const handleSupportEvent = async (e) => {
      const data = e.detail;
      if (!data?.event) return;
      if (typeof data.event === "string" && data.event.startsWith("support_")) {
        await fetchCurrentSupportSession();
      }
    };

    window.addEventListener("support_event", handleSupportEvent);
    return () => window.removeEventListener("support_event", handleSupportEvent);
  }, [fetchCurrentSupportSession]);

  // ── Countdown timer — runs once, reads expiresAt from ref to stay stable.
  //    No supportSession in dep array → interval never restarts on each tick.
  useEffect(() => {
    const tick = () => {
      const expiresAt = expiresAtRef.current;

      if (!expiresAt) {
        setTimeLeft("");
        return;
      }

      const diff = expiresAt - Date.now();

      if (diff <= 0) {
        setTimeLeft("00:00");
        expiresAtRef.current = null;
        // Mark session as expired locally; server is the source of truth
        setSupportSession((prev) =>
          prev && prev.status === "active"
            ? { ...prev, status: "expired", endedAt: Date.now() }
            : prev
        );
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const secs = String(totalSeconds % 60).padStart(2, "0");
      setTimeLeft(`${mins}:${secs}`);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []); // ← intentionally empty: interval lives for the component's lifetime

  // ── Keep expiresAtRef in sync whenever the session changes
  //    (e.g. after fetchCurrentSupportSession or handleSendInvite)
  useEffect(() => {
    expiresAtRef.current =
      supportSession?.status === "active" ? supportSession.expiresAt ?? null : null;

    // If session is no longer active, clear the displayed timer
    if (supportSession?.status !== "active") {
      setTimeLeft("");
    }
  }, [supportSession]);

  const handleSendInvite = async ({ admin, reason }) => {
    try {
      setInviteLoading(true);
      const res = await api.post("/support/owner/invite/", {
        admin: admin.id,
        reason,
      });
      const normalized = normalizeSupportSession(res.data);
      setSupportSession(normalized);
      expiresAtRef.current = normalized?.expiresAt ?? null;
      setInviteModalOpen(false);
    } catch (error) {
      console.error("Invite failed:", error);
      alert(error.response?.data?.detail || "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleTerminateSession = async () => {
    if (!supportSession?.id) return;
    try {
      const res = await api.post(`/support/owner/terminate/${supportSession.id}/`);
      const data = res.data;
      setSupportSession((prev) =>
        prev
          ? {
              ...prev,
              status: data.status?.toLowerCase?.() || "terminated",
              endedAt: data.ended_at ? new Date(data.ended_at).getTime() : Date.now(),
            }
          : null
      );
      expiresAtRef.current = null;
    } catch (err) {
      console.error("Terminate failed", err);
      alert(err.response?.data?.detail || "Failed to terminate session");
    }
  };

  const topCards = [
    {
      label: "My Properties",
      value: propCount,
      icon: <FaHome />,
      color: "#1a7a40",
      bg: "rgba(26,122,64,0.1)",
      onClick: () => navigate("/dashboard/owner/properties"),
    },
    {
      label: "Bookings",
      value: bookingCount,
      icon: <FaCalendarCheck />,
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.1)",
      onClick: () => navigate("/dashboard/owner/bookings"),
    },
    {
      label: "Active Leases",
      value: stats?.total_active_leases ?? 0,
      icon: <FaFileContract />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
      onClick: null,
    },
    {
      label: "Monthly Revenue",
      value: `GHS ${Number(stats?.total_monthly_revenue ?? 0).toLocaleString()}`,
      icon: <FaMoneyBillWave />,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
      onClick: null,
    },
  ];

  const quickActions = [
    {
      icon: <FaCalendarCheck />,
      title: "View Bookings",
      desc: "See all tenant booking requests",
      onClick: () => navigate("/dashboard/owner/bookings"),
      color: "#3b82f6",
    },
    {
      icon: <FaPlus />,
      title: "Add Property",
      desc: "List a new property",
      onClick: () => navigate("/dashboard/owner/UploadDetails/uploadpage"),
      color: "#1a7a40",
    },
    {
      icon: <FaHome />,
      title: "My Properties",
      desc: "Manage your listings",
      onClick: () => navigate("/dashboard/owner/properties"),
      color: "#f59e0b",
    },
  ];

  return (
    <div className="od-page">
      <motion.div
        className="od-banner"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="od-banner-texture" />
        <div className="od-banner-content">
          <div>
            <p className="od-banner-eyebrow">Property Owner Dashboard</p>
            <h2 className="od-banner-title">Welcome back, {username}!</h2>
            <p className="od-banner-sub">
              Manage your properties and track everything in one place.
            </p>
          </div>

          <div className="od-banner-support-card">
            <div className="od-banner-support-card-top">
              <div className="od-banner-support-icon">
                <FaUserShield />
              </div>

              <span
                className={`od-banner-support-badge ${
                  supportSession?.status === "active"
                    ? "od-banner-support-badge--active"
                    : supportSession?.status === "terminated"
                    ? "od-banner-support-badge--terminated"
                    : supportSession?.status === "expired"
                    ? "od-banner-support-badge--expired"
                    : "od-banner-support-badge--idle"
                }`}
              >
                {!supportSession && "Idle"}
                {supportSession?.status === "active" && "Live"}
                {supportSession?.status === "pending" && "Pending"}
                {supportSession?.status === "terminated" && "Ended"}
                {supportSession?.status === "expired" && "Expired"}
              </span>
            </div>

            <div className="od-banner-support-meta">
              {!supportSession && (
                <p className="od-banner-support-note">
                  Invite an admin when you need help posting a property.
                </p>
              )}

              {supportSession?.status === "pending" && (
                <p className="od-banner-support-note">
                  Waiting for admin to accept…
                </p>
              )}

              {supportSession?.status === "active" && (
                <>
                  <p className="od-banner-support-note">
                    {supportSession.adminName}
                    {supportSession.adminEmail
                      ? ` — ${supportSession.adminEmail}`
                      : ""}
                  </p>
                  <p className="od-banner-support-timer">
                    <FaClock /> {timeLeft} remaining
                  </p>
                  <button
                    className="od-banner-support-end-btn"
                    onClick={handleTerminateSession}
                  >
                    End Session
                  </button>
                </>
              )}

              {supportSession?.status === "terminated" && (
                <p className="od-banner-support-note">
                  This session was ended manually.
                </p>
              )}

              {supportSession?.status === "expired" && (
                <p className="od-banner-support-note">
                  The 30-minute support window has expired.
                </p>
              )}
            </div>
          </div>

          <button
            className="od-banner-btn"
            onClick={() =>
              navigate("/dashboard/owner/UploadDetails/uploadpage")
            }
          >
            <FaPlus /> Add Property
          </button>

          <button
            className="od-banner-btn od-banner-btn--alt"
            onClick={() => setInviteModalOpen(true)}
          >
            <FaUserShield /> Invite Admin
          </button>
        </div>
      </motion.div>

      <motion.div
        className="od-stats-grid"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {topCards.map((c, i) => (
          <motion.div
            key={i}
            className={`od-stat-card ${c.onClick ? "od-stat-card--clickable" : ""}`}
            variants={fadeUp}
            onClick={c.onClick || undefined}
            whileHover={c.onClick ? { y: -3, transition: { duration: 0.18 } } : {}}
          >
            <div
              className="od-stat-icon"
              style={{ background: c.bg, color: c.color }}
            >
              {c.icon}
            </div>
            <div className="od-stat-body">
              <span className="od-stat-value">
                {loading ? <span className="od-skeleton" /> : c.value}
              </span>
              <span className="od-stat-label">{c.label}</span>
            </div>
            {c.onClick && (
              <FaArrowRight
                className="od-stat-arrow"
                style={{ color: c.color }}
              />
            )}
          </motion.div>
        ))}
      </motion.div>

      {!loading && stats?.hostel_stats?.length > 0 && (
        <motion.div
          className="od-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="od-section-head">
            <FaChartLine className="od-section-icon" />
            <h3>Hostel Occupancy</h3>
          </div>

          <div className="od-hostel-grid">
            {stats.hostel_stats.map((h) => (
              <div
                key={h.id}
                className={`od-hostel-card ${h.full ? "od-hostel-card--full" : ""}`}
              >
                {h.full && <span className="od-full-badge">Full</span>}
                <p className="od-hostel-name">{h.property_name}</p>

                <div className="od-hostel-stats">
                  <div className="od-hostel-stat">
                    <FaBed />
                    <span>{h.total_rooms}</span>
                    <small>Total</small>
                  </div>
                  <div className="od-hostel-stat od-hostel-stat--occupied">
                    <FaDoorClosed />
                    <span>{h.occupied_rooms}</span>
                    <small>Occupied</small>
                  </div>
                  <div className="od-hostel-stat od-hostel-stat--available">
                    <FaDoorOpen />
                    <span>{h.available_rooms}</span>
                    <small>Available</small>
                  </div>
                </div>

                <div className="od-occ-bar-wrap">
                  <div className="od-occ-bar">
                    <div
                      className="od-occ-fill"
                      style={{
                        width: `${Math.round(
                          (h.occupied_rooms / h.total_rooms) * 100
                        )}%`,
                        background: h.full ? "#ef4444" : "#1a7a40",
                      }}
                    />
                  </div>
                  <span>
                    {Math.round((h.occupied_rooms / h.total_rooms) * 100)}%
                    occupied
                  </span>
                </div>

                <p className="od-hostel-revenue">
                  GHS {Number(h.monthly_revenue).toLocaleString()}
                  <small>/mo</small>
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        className="od-section"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <div className="od-section-head">
          <FaClipboardList className="od-section-icon" />
          <h3>Quick Actions</h3>
        </div>

        <div className="od-actions-grid">
          {quickActions.map((a, i) => (
            <motion.div
              key={i}
              className="od-action-card"
              variants={fadeUp}
              onClick={a.onClick}
              whileHover={{ y: -4, transition: { duration: 0.18 } }}
            >
              <div
                className="od-action-icon"
                style={{ background: `${a.color}18`, color: a.color }}
              >
                {a.icon}
              </div>
              <div>
                <p className="od-action-title">{a.title}</p>
                <p className="od-action-desc">{a.desc}</p>
              </div>
              <FaArrowRight
                className="od-action-arrow"
                style={{ color: a.color }}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="od-section od-section--table"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="od-section-head">
          <FaHome className="od-section-icon" />
          <h3>My Properties</h3>
        </div>
        <MyProperties />
      </motion.div>

      <AdminInviteModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSendInvite={handleSendInvite}
        admins={admins}
        loading={inviteLoading}
      />
    </div>
  );
};

export default OwnerDashboard;