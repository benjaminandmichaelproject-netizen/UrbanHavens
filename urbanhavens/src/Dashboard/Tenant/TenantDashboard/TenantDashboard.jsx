import React, { useEffect, useState, useMemo } from "react";
import {
  FaCalendarCheck, FaFileContract, FaBookmark, FaClock,
  FaArrowRight, FaHome, FaBell, FaCheckCircle, FaTimesCircle,
  FaHourglass, FaExchangeAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./TenantDashboard.css";
import { api } from "../../Owner/UploadDetails/api/api";

const username = localStorage.getItem("username") || "Tenant";

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_META = {
  pending:   { label: "Pending",   icon: <FaHourglass />,   cls: "status-pending"   },
  confirmed: { label: "Confirmed", icon: <FaCheckCircle />, cls: "status-confirmed" },
  converted: { label: "Converted", icon: <FaExchangeAlt />, cls: "status-converted" },
  rejected:  { label: "Rejected",  icon: <FaTimesCircle />, cls: "status-rejected"  },
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—";

const calcLeaseStats = (start_date, end_date) => {
  if (!start_date || !end_date) return { totalMonths: 0, daysElapsed: 0, monthsLeft: 0, daysLeft: 0, progress: 0 };

  const start = new Date(start_date);
  const end   = new Date(end_date);
  const today = new Date();
  const MS    = 1000 * 60 * 60 * 24;

  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

  const effectiveToday = today < start ? start : today > end ? end : today;
  const daysElapsed    = Math.floor((effectiveToday - start) / MS);
  const daysLeft       = Math.max(0, Math.floor((end - today) / MS));

  let monthsLeft = 0;
  if (today < end) {
    monthsLeft = (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth());
    if (end.getDate() < today.getDate()) monthsLeft -= 1;
    monthsLeft = Math.max(0, monthsLeft);
  }

  const totalDays = Math.floor((end - start) / MS) || 1;
  const progress  = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));

  return { totalMonths, daysElapsed, monthsLeft, daysLeft, progress };
};

// ── Component ─────────────────────────────────────────────────────────────────
const TenantDashboard = () => {
  const navigate = useNavigate();

  const [bookings,  setBookings]  = useState([]);
  const [lease,     setLease]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [bookingsRes, leaseRes, favoritesRes] = await Promise.allSettled([
          api.get("/bookings/my_tenant_bookings/"),
          api.get("/leases/my-lease/"),
          api.get("/favorites/"),
        ]);

        if (bookingsRes.status === "fulfilled") {
          const data = bookingsRes.value.data;
          setBookings(Array.isArray(data) ? data : data.results ?? []);
        }

        if (leaseRes.status === "fulfilled") {
          setLease(leaseRes.value.data || null);
        }

        if (favoritesRes.status === "fulfilled") {
          const data = favoritesRes.value.data;
          setFavorites(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("TenantDashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = useMemo(() => ({
    totalBookings:   bookings.length,
    pendingBookings: bookings.filter((b) => b.status === "pending").length,
    activeLease:     lease ? 1 : 0,
    savedProperties: favorites.length,
  }), [bookings, lease, favorites]);

  const recentBookings = bookings.slice(0, 3);
  const leaseStats     = lease ? calcLeaseStats(lease.lease_start_date, lease.lease_end_date) : null;

  const statCards = [
    { label: "Total Bookings",   value: stats.totalBookings,   icon: <FaCalendarCheck />, color: "#f5c518" },
    { label: "Pending",          value: stats.pendingBookings, icon: <FaClock />,         color: "#f59e0b" },
    { label: "Active Lease",     value: stats.activeLease,     icon: <FaFileContract />,  color: "#10b981" },
    { label: "Saved Properties", value: stats.savedProperties, icon: <FaBookmark />,      color: "#6366f1" },
  ];

  return (
    <div className="tenant-dashboard-page">

      {/* ── Welcome ───────────────────────────────────────────────── */}
      <div className="welcome-section">
        <div>
          <h1>Welcome back, <span>{username}</span> 👋</h1>
          <p>Here's everything going on with your rentals.</p>
        </div>
        <button className="browse-properties-btn" onClick={() => navigate("/")}>
          <FaHome /> Browse Properties
        </button>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div className="stat-card" key={i} style={{ "--card-accent": s.color }}>
            <div className="stat-icon" style={{ background: s.color + "1a", color: s.color }}>
              {s.icon}
            </div>
            <div>
              <h3>{loading ? "..." : s.value}</h3>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-bottom-grid">

        {/* ── Recent Bookings ───────────────────────────────────── */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <h3>Recent Bookings</h3>
            <button className="see-all-btn" onClick={() => navigate("/dashboard/tenant/TenantBooking/TenantBooking")}>
              See all <FaArrowRight />
            </button>
          </div>

          {loading ? (
            <p className="loading-text">Loading bookings...</p>
          ) : recentBookings.length > 0 ? (
            <div className="booking-list">
              {recentBookings.map((b) => {
                const meta = STATUS_META[b.status] || STATUS_META.pending;
                return (
                  <div className="booking-item" key={b.id}>
                    <div className="booking-icon"><FaHome /></div>
                    <div className="booking-info">
                      <strong>{b.property_name}</strong>
                      <span>{[b.property_city, b.property_region].filter(Boolean).join(", ")}</span>
                      <span className="booking-date">{formatDate(b.created_at)}</span>
                    </div>
                    <div className="booking-right-side">
                      <span className="property-price">
                        GHS {b.property_price ? Number(b.property_price).toLocaleString() : "—"}
                      </span>
                      <span className={`booking-status ${meta.cls}`}>{meta.icon} {meta.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <FaCalendarCheck />
              <p>No bookings yet. Start by browsing properties.</p>
              <button onClick={() => navigate("/")}>Browse Now</button>
            </div>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────── */}
        <div className="right-column">

          {/* Active Lease */}
          <div className="dashboard-panel lease-panel">
            <div className="panel-header">
              <h3>Active Lease</h3>
              <button className="see-all-btn" onClick={() => navigate("/dashboard/tenant/lease")}>
                Details <FaArrowRight />
              </button>
            </div>

            {loading ? (
              <p className="loading-text">Loading lease...</p>
            ) : lease && leaseStats ? (
              <div className="lease-card">
                <div className="lease-active-badge">Active</div>
                <h4>{lease.property_name}</h4>
                <p><FaHome /> {lease.property_city || "—"}</p>

                <div className="lease-dates-row">
                  <div>
                    <span>Start</span>
                    <strong>{formatDate(lease.lease_start_date)}</strong>
                  </div>
                  <div>
                    <span>End</span>
                    <strong>{formatDate(lease.lease_end_date)}</strong>
                  </div>
                </div>

                <div className="lease-progress-wrapper">
                  <div className="lease-progress-track">
                    <div className="lease-progress-fill" style={{ width: `${leaseStats.progress}%` }} />
                  </div>
                  <span>{leaseStats.progress}% elapsed</span>
                </div>

                <div className="lease-stats-grid">
                  <div className="lease-stat-item">
                    <h5>{leaseStats.totalMonths}</h5><p>Total Months</p>
                  </div>
                  <div className="lease-stat-item">
                    <h5>{leaseStats.daysElapsed}</h5><p>Days Elapsed</p>
                  </div>
                  <div className="lease-stat-item highlight">
                    <h5>{leaseStats.monthsLeft}</h5><p>Months Left</p>
                  </div>
                  <div className="lease-stat-item">
                    <h5>{leaseStats.daysLeft}</h5><p>Days Left</p>
                  </div>
                </div>

                <div className="monthly-rent">
                  GHS {Number(lease.monthly_rent).toLocaleString()}
                  <small>/month</small>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <FaFileContract />
                <p>No active lease found.</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="dashboard-panel quick-actions-panel">
            <h3>Quick Actions</h3>
            <div className="quick-actions-grid">
              <button onClick={() => navigate("/")}><FaHome /> Browse Properties</button>
              <button onClick={() => navigate("/dashboard/tenant/TenantBooking/TenantBooking")}><FaCalendarCheck /> My Bookings</button>
              <button onClick={() => navigate("/dashboard/tenant/lease/Lease")}><FaFileContract /> My Lease</button>
              <button onClick={() => navigate("/dashboard/tenant/notifications")}><FaBell /> Notifications</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TenantDashboard;