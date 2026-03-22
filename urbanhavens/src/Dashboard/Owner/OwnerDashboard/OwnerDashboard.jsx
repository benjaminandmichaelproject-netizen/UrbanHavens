import React, { useEffect, useState } from "react";
import "./OwnerDashboard.css";
import MyProperties from "../MyProperties/MyProperties";
import { useNavigate } from "react-router-dom";
import { api } from "../UploadDetails/api/api";
import {
  FaHome, FaCalendarCheck, FaFileContract,
  FaMoneyBillWave, FaBed, FaDoorOpen, FaDoorClosed,
} from "react-icons/fa";

const username = localStorage.getItem("username") || "Owner";

const OwnerDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats]         = useState(null);
  const [propCount, setPropCount] = useState(0);
  const [bookingCount, setBookingCount] = useState(0);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [leaseRes, propRes, bookingRes] = await Promise.allSettled([
          api.get("/leases/owner-stats/"),
          api.get("/properties/my-properties/"),
          api.get("/bookings/my_owner_bookings/"),
        ]);

        if (leaseRes.status === "fulfilled") {
          setStats(leaseRes.value.data);
        }
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

  const topCards = [
    {
      label: "My Properties",
      value: propCount,
      icon: <FaHome />,
      color: "#f5c518",
      onClick: () => navigate("/dashboard/owner/properties"),
    },
    {
      label: "Bookings",
      value: bookingCount,
      icon: <FaCalendarCheck />,
      color: "#3b82f6",
      onClick: () => navigate("/dashboard/owner/bookings"),
    },
    {
      label: "Active Leases",
      value: stats?.total_active_leases ?? 0,
      icon: <FaFileContract />,
      color: "#10b981",
      onClick: null,
    },
    {
      label: "Monthly Revenue",
      value: `GHS ${Number(stats?.total_monthly_revenue ?? 0).toLocaleString()}`,
      icon: <FaMoneyBillWave />,
      color: "#8b5cf6",
      onClick: null,
    },
  ];

  return (
    <div className="owner-dashboard">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <h2>Welcome back, {username}!</h2>
          <p>Manage your properties and track everything in one place.</p>
          <button
            className="hero-btn"
            onClick={() => navigate("/dashboard/owner/UploadDetails/uploadpage")}
          >
            + Add Property
          </button>
        </div>
      </div>

      {/* ── Top stats ───────────────────────────────────────────── */}
      <div className="od-stats-grid">
        {topCards.map((c, i) => (
          <div
            key={i}
            className={`od-stat-card ${c.onClick ? "clickable" : ""}`}
            style={{ "--card-color": c.color }}
            onClick={c.onClick || undefined}
          >
            <div className="od-stat-icon" style={{ background: c.color + "1a", color: c.color }}>
              {c.icon}
            </div>
            <div>
              <h3>{loading ? "..." : c.value}</h3>
              <p>{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Hostel occupancy cards ───────────────────────────────── */}
      {!loading && stats?.hostel_stats?.length > 0 && (
        <div className="od-hostel-section">
          <h3 className="od-section-title">🏠 Hostel Occupancy</h3>
          <div className="od-hostel-grid">
            {stats.hostel_stats.map((h) => (
              <div key={h.id} className={`od-hostel-card ${h.full ? "full" : ""}`}>
                <div className="od-hostel-name">{h.property_name}</div>

                <div className="od-hostel-stats">
                  <div className="od-hostel-stat">
                    <FaBed />
                    <span>{h.total_rooms}</span>
                    <small>Total</small>
                  </div>
                  <div className="od-hostel-stat occupied">
                    <FaDoorClosed />
                    <span>{h.occupied_rooms}</span>
                    <small>Occupied</small>
                  </div>
                  <div className="od-hostel-stat available">
                    <FaDoorOpen />
                    <span>{h.available_rooms}</span>
                    <small>Available</small>
                  </div>
                </div>

                {/* Occupancy bar */}
                <div className="od-occ-bar-wrap">
                  <div className="od-occ-bar">
                    <div
                      className="od-occ-fill"
                      style={{
                        width: `${Math.round((h.occupied_rooms / h.total_rooms) * 100)}%`,
                        background: h.full ? "#ef4444" : "#10b981",
                      }}
                    />
                  </div>
                  <span>
                    {Math.round((h.occupied_rooms / h.total_rooms) * 100)}% occupied
                  </span>
                </div>

                <div className="od-hostel-revenue">
                  GHS {Number(h.monthly_revenue).toLocaleString()}<small>/mo</small>
                </div>

                {h.full && <div className="od-full-badge">Full</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick actions ────────────────────────────────────────── */}
      <div className="dashboard-actions">
        <div className="action-card" onClick={() => navigate("/dashboard/owner/bookings")}>
          <h4>View Bookings</h4>
          <p>See all tenant booking requests</p>
        </div>
        <div className="action-card" onClick={() => navigate("/dashboard/owner/UploadDetails/uploadpage")}>
          <h4>Add Property</h4>
          <p>List a new property</p>
        </div>
        <div className="action-card" onClick={() => navigate("/dashboard/owner/properties")}>
          <h4>My Properties</h4>
          <p>Manage your listings</p>
        </div>
      </div>

      {/* ── Properties table ─────────────────────────────────────── */}
      <div className="dashboard-table">
        <MyProperties />
      </div>

    </div>
  );
};

export default OwnerDashboard;
