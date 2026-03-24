import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FaArrowLeft, FaMapMarkerAlt, FaCalendarAlt, FaMoneyBillWave,
  FaFileContract, FaHome, FaCheckCircle, FaTimesCircle,
  FaHourglassHalf, FaUser, FaKey, FaClock,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { api } from "../../Owner/UploadDetails/api/api";
import "./Lease.css";

/* ─── helpers ───────────────────────────────────────── */
const readableDate = (d) =>
  d ? new Date(d).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }) : "—";

const computeLeaseStats = (startDate, endDate) => {
  if (!startDate || !endDate)
    return { totalDays: 0, daysElapsed: 0, daysLeft: 0, totalMonths: 0, monthsLeft: 0, progress: 0 };

  const MS    = 1000 * 60 * 60 * 24;
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const today = new Date();

  const totalDays   = Math.max(1, Math.floor((end - start) / MS));
  const clampedNow  = today < start ? start : today > end ? end : today;
  const daysElapsed = Math.floor((clampedNow - start) / MS);
  const daysLeft    = Math.max(0, Math.floor((end - today) / MS));

  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

  let monthsLeft = 0;
  if (today < end) {
    monthsLeft =
      (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth());
    if (end.getDate() < today.getDate()) monthsLeft -= 1;
    monthsLeft = Math.max(0, monthsLeft);
  }

  const progress = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));
  return { totalDays, daysElapsed, daysLeft, totalMonths, monthsLeft, progress };
};

const resolveLeaseStatus = (lease) => {
  if (!lease) return null;
  const today = new Date();
  const start = new Date(lease.lease_start_date);
  const end   = new Date(lease.lease_end_date);
  if (today < start) return { label: "Upcoming", modifier: "upcoming", icon: <FaHourglassHalf /> };
  if (today > end)   return { label: "Expired",  modifier: "expired",  icon: <FaTimesCircle />  };
  return               { label: "Active",   modifier: "active",   icon: <FaCheckCircle />  };
};

const revealUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 30 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay },
});

/* ─── component ─────────────────────────────────────── */
const Lease = () => {
  const navigate = useNavigate();

  const [lease,   setLease]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/leases/my-lease/");
        setLease(res.data || null);
      } catch (err) {
        if (err?.response?.status === 404) setLease(null);
        else setError("We couldn't load your lease right now. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats  = useMemo(() => lease ? computeLeaseStats(lease.lease_start_date, lease.lease_end_date) : null, [lease]);
  const status = useMemo(() => resolveLeaseStatus(lease), [lease]);

  const ringRadius      = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;

  /* ── loading ── */
  if (loading) return (
    <div className="lease-page">
      <div className="page-loading">
        <div className="spinning-circle" />
        <p>Fetching your lease details…</p>
      </div>
    </div>
  );

  /* ── error ── */
  if (error) return (
    <div className="lease-page">
      <div className="lease-empty-state">
        <FaTimesCircle className="empty-icon error-variant" />
        <h3>Something went wrong</h3>
        <p>{error}</p>
        <button className="go-back-button" onClick={() => navigate("/dashboard/tenant")}>
          <FaArrowLeft /> Back to Dashboard
        </button>
      </div>
    </div>
  );

  /* ── no lease ── */
  if (!lease) return (
    <div className="lease-page">
      <div className="lease-empty-state">
        <FaFileContract className="empty-icon" />
        <h3>No Lease Found</h3>
        <p>
          You don't have an active lease yet. Once a landlord approves your booking,
          your agreement will appear here.
        </p>
        <button className="browse-properties-button" onClick={() => navigate("/")}>
          <FaHome /> Browse Properties
        </button>
      </div>
    </div>
  );

  const totalContractValue =
    lease.monthly_rent && stats?.totalMonths
      ? (Number(lease.monthly_rent) * stats.totalMonths).toLocaleString()
      : "—";

  return (
    <div className="lease-page">

      {/* ── back navigation ── */}
      <motion.button
        className="back-to-dashboard"
        onClick={() => navigate("/dashboard/tenant")}
        {...revealUp(0)}
      >
        <FaArrowLeft /> Back to Dashboard
      </motion.button>

      {/* ── property hero banner ── */}
      <motion.div className="property-hero-banner" {...revealUp(0.06)}>
        <div className="hero-dark-overlay" />
        <div className="hero-text-content">
          <div className="hero-top-row">
            <span className="contract-type-tag">
              <FaFileContract /> Lease Agreement
            </span>
            <span className={`lease-status-pill ${status.modifier}`}>
              {status.icon} {status.label}
            </span>
          </div>
          <h1 className="hero-property-name">{lease.property_name || "Your Property"}</h1>
          <p className="hero-property-location">
            <FaMapMarkerAlt />
            {[lease.property_city, lease.property_region].filter(Boolean).join(", ") || "—"}
          </p>
        </div>
      </motion.div>

      {/* ── two column layout ── */}
      <div className="lease-body-grid">

        {/* ══ left column ══ */}
        <div className="lease-left-column">

          {/* duration */}
          <motion.section className="info-section duration-section" {...revealUp(0.1)}>
            <h2 className="section-heading">
              <FaCalendarAlt className="section-heading-icon" /> Lease Duration
            </h2>
            <div className="date-range-display">
              <div className="single-date-block">
                <span className="date-type-label">Start Date</span>
                <strong className="formatted-date start-date-color">
                  {readableDate(lease.lease_start_date)}
                </strong>
              </div>
              <div className="duration-middle-badge">
                <span>{stats.totalMonths}</span>
                <small>months</small>
              </div>
              <div className="single-date-block">
                <span className="date-type-label">End Date</span>
                <strong className="formatted-date end-date-color">
                  {readableDate(lease.lease_end_date)}
                </strong>
              </div>
            </div>
          </motion.section>

          {/* financials */}
          <motion.section className="info-section financials-section" {...revealUp(0.14)}>
            <h2 className="section-heading">
              <FaMoneyBillWave className="section-heading-icon" /> Financials
            </h2>
            <div className="financial-cards-row">
              <div className="financial-card monthly-rent-highlight">
                <span className="financial-card-label">Monthly Rent</span>
                <strong className="financial-card-amount">
                  GHS {Number(lease.monthly_rent || 0).toLocaleString()}
                </strong>
                <span className="financial-card-note">per month</span>
              </div>
              <div className="financial-card total-value-card">
                <span className="financial-card-label">Total Contract Value</span>
                <strong className="financial-card-amount">GHS {totalContractValue}</strong>
                <span className="financial-card-note">{stats.totalMonths} months</span>
              </div>
              {lease.security_deposit && (
                <div className="financial-card deposit-card">
                  <span className="financial-card-label">Security Deposit</span>
                  <strong className="financial-card-amount">
                    GHS {Number(lease.security_deposit).toLocaleString()}
                  </strong>
                  <span className="financial-card-note">one-time</span>
                </div>
              )}
            </div>
          </motion.section>

          {/* parties */}
          {(lease.tenant_name || lease.landlord_name) && (
            <motion.section className="info-section parties-section" {...revealUp(0.18)}>
              <h2 className="section-heading">
                <FaUser className="section-heading-icon" /> Parties Involved
              </h2>
              <div className="party-cards-row">
                {lease.tenant_name && (
                  <div className="party-card tenant-party">
                    <div className="party-initial-avatar tenant-avatar-color">
                      {lease.tenant_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="party-details">
                      <span className="party-role-label">Tenant</span>
                      <strong className="party-full-name">{lease.tenant_name}</strong>
                    </div>
                  </div>
                )}
                {lease.landlord_name && (
                  <div className="party-card landlord-party">
                    <div className="party-initial-avatar landlord-avatar-color">
                      {lease.landlord_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="party-details">
                      <span className="party-role-label">Landlord</span>
                      <strong className="party-full-name">{lease.landlord_name}</strong>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* terms */}
          {lease.terms && (
            <motion.section className="info-section terms-section" {...revealUp(0.22)}>
              <h2 className="section-heading">
                <FaKey className="section-heading-icon" /> Terms & Conditions
              </h2>
              <p className="terms-body-text">{lease.terms}</p>
            </motion.section>
          )}

          {/* reference */}
          <motion.section className="info-section reference-section" {...revealUp(0.26)}>
            <h2 className="section-heading">Reference</h2>
            <div className="reference-fields-row">
              <div className="reference-field">
                <span className="reference-field-label">Lease ID</span>
                <strong className="reference-field-value">#{lease.id}</strong>
              </div>
              {lease.created_at && (
                <div className="reference-field">
                  <span className="reference-field-label">Issued On</span>
                  <strong className="reference-field-value">{readableDate(lease.created_at)}</strong>
                </div>
              )}
            </div>
          </motion.section>

        </div>

        {/* ══ right column ══ */}
        <div className="lease-right-column">
          <motion.section className="info-section progress-tracker-section" {...revealUp(0.1)}>
            <h2 className="section-heading">
              <FaClock className="section-heading-icon" /> Lease Progress
            </h2>

            {/* circular progress ring */}
            <div className="circular-progress-wrapper">
              <svg className="circular-ring-svg" viewBox="0 0 120 120">
                <circle
                  className="ring-background-track"
                  cx="60" cy="60" r={ringRadius}
                />
                <motion.circle
                  className="ring-progress-fill"
                  cx="60" cy="60" r={ringRadius}
                  strokeDasharray={ringCircumference}
                  initial={{ strokeDashoffset: ringCircumference }}
                  animate={{ strokeDashoffset: ringCircumference * (1 - stats.progress / 100) }}
                  transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
                />
              </svg>
              <div className="ring-center-label">
                <span className="ring-percentage-number">{stats.progress}%</span>
                <span className="ring-percentage-caption">complete</span>
              </div>
            </div>

            {/* four stat tiles */}
            <div className="lease-time-stats">
              <div className="time-stat-tile">
                <span className="time-stat-big-number">{stats.totalMonths}</span>
                <span className="time-stat-description">Total Months</span>
              </div>
              <div className="time-stat-tile">
                <span className="time-stat-big-number">{stats.daysElapsed}</span>
                <span className="time-stat-description">Days Elapsed</span>
              </div>
              <div className="time-stat-tile highlighted-time-tile">
                <span className="time-stat-big-number">{stats.monthsLeft}</span>
                <span className="time-stat-description">Months Left</span>
              </div>
              <div className="time-stat-tile">
                <span className="time-stat-big-number">{stats.daysLeft}</span>
                <span className="time-stat-description">Days Left</span>
              </div>
            </div>

            {/* linear progress bar */}
            <div className="linear-progress-section">
              <div className="linear-progress-bar">
                <motion.div
                  className="linear-progress-filled"
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.progress}%` }}
                  transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
                />
              </div>
              <div className="progress-bar-date-labels">
                <span>{readableDate(lease.lease_start_date)}</span>
                <span>{readableDate(lease.lease_end_date)}</span>
              </div>
            </div>

            {/* days remaining callout */}
            <div className="days-remaining-banner">
              <span className="days-remaining-big-count">{stats.daysLeft}</span>
              <span className="days-remaining-description">days remaining on your lease</span>
            </div>

          </motion.section>
        </div>

      </div>
    </div>
  );
};

export default Lease;