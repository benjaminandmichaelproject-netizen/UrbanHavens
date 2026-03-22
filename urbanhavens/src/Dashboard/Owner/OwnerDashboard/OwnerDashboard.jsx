import { useEffect, useState } from "react";
import "./OwnerDashboard.css";
import MyProperties from "../MyProperties/MyProperties";
import { useNavigate } from "react-router-dom";
import { api } from "../UploadDetails/api/api";
import { motion } from "framer-motion";
import {
  FaHome, FaCalendarCheck, FaFileContract, FaMoneyBillWave,
  FaBed, FaDoorOpen, FaDoorClosed, FaPlus, FaArrowRight,
  FaChartLine, FaClipboardList,
} from "react-icons/fa";

const username = localStorage.getItem("username") || "Owner";

const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

const OwnerDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats]               = useState(null);
  const [propCount, setPropCount]       = useState(0);
  const [bookingCount, setBookingCount] = useState(0);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [leaseRes, propRes, bookingRes] = await Promise.allSettled([
          api.get("/leases/owner-stats/"),
          api.get("/properties/my-properties/"),
          api.get("/bookings/my_owner_bookings/"),
        ]);

        if (leaseRes.status   === "fulfilled") setStats(leaseRes.value.data);
        if (propRes.status    === "fulfilled") {
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

      {/* ── Welcome banner ──────────────────────────────────── */}
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
            <p className="od-banner-sub">Manage your properties and track everything in one place.</p>
          </div>
          <button
            className="od-banner-btn"
            onClick={() => navigate("/dashboard/owner/UploadDetails/uploadpage")}
          >
            <FaPlus /> Add Property
          </button>
        </div>
      </motion.div>

      {/* ── Stat cards ──────────────────────────────────────── */}
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
            <div className="od-stat-icon" style={{ background: c.bg, color: c.color }}>
              {c.icon}
            </div>
            <div className="od-stat-body">
              <span className="od-stat-value">
                {loading ? <span className="od-skeleton" /> : c.value}
              </span>
              <span className="od-stat-label">{c.label}</span>
            </div>
            {c.onClick && (
              <FaArrowRight className="od-stat-arrow" style={{ color: c.color }} />
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* ── Hostel occupancy ────────────────────────────────── */}
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
              <div key={h.id} className={`od-hostel-card ${h.full ? "od-hostel-card--full" : ""}`}>
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
                        width: `${Math.round((h.occupied_rooms / h.total_rooms) * 100)}%`,
                        background: h.full ? "#ef4444" : "#1a7a40",
                      }}
                    />
                  </div>
                  <span>{Math.round((h.occupied_rooms / h.total_rooms) * 100)}% occupied</span>
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

      {/* ── Quick actions ────────────────────────────────────── */}
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
              <div className="od-action-icon" style={{ background: a.color + "18", color: a.color }}>
                {a.icon}
              </div>
              <div>
                <p className="od-action-title">{a.title}</p>
                <p className="od-action-desc">{a.desc}</p>
              </div>
              <FaArrowRight className="od-action-arrow" style={{ color: a.color }} />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Properties table ─────────────────────────────────── */}
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

    </div>
  );
};

export default OwnerDashboard;