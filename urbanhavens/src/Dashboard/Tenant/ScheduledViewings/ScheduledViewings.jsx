import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  FaCalendarAlt, FaClock, FaMapMarkerAlt, FaHome, FaUser,
  FaPhone, FaEnvelope, FaSearch, FaTimes, FaStickyNote,
  FaCheckCircle, FaHourglass, FaTimesCircle,
} from "react-icons/fa";
import "./ScheduledViewings.css";
import { api } from "../../Owner/UploadDetails/api/api";

const STATUS_META = {
  upcoming:  { label: "Upcoming",  icon: <FaHourglass />,   cls: "sv-upcoming"  },
  completed: { label: "Completed", icon: <FaCheckCircle />, cls: "sv-completed" },
  cancelled: { label: "Cancelled", icon: <FaTimesCircle />, cls: "sv-cancelled" },
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "—";

const formatTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${ampm}`;
};

const ScheduledViewings = () => {
  const [viewings, setViewings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected]         = useState(null);

  const fetchViewings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/meetings/");
      const data = res.data;
      setViewings(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      console.error("Fetch meetings error:", err);
      setError(err.response?.data?.detail || "Failed to load scheduled viewings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchViewings(); }, [fetchViewings]);

  const filtered = useMemo(() => viewings.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      (v.property_name || "").toLowerCase().includes(q) ||
      (v.property_city || "").toLowerCase().includes(q) ||
      (v.owner_name    || "").toLowerCase().includes(q) ||
      (v.location      || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" ? true : v.status === statusFilter;
    return matchSearch && matchStatus;
  }), [viewings, search, statusFilter]);

  const counts = useMemo(() => ({
    upcoming:  viewings.filter((v) => v.status === "upcoming").length,
    completed: viewings.filter((v) => v.status === "completed").length,
    cancelled: viewings.filter((v) => v.status === "cancelled").length,
  }), [viewings]);

  return (
    <div className="sv-page">

      <div className="sv-header">
        <div>
          <h2>Scheduled Viewings</h2>
          <p>Inspection meetings arranged by property owners for your bookings.</p>
        </div>
        <div className="sv-counts">
          <div className="sv-count-pill sv-upcoming"><span>{counts.upcoming}</span> Upcoming</div>
          <div className="sv-count-pill sv-completed"><span>{counts.completed}</span> Completed</div>
          <div className="sv-count-pill sv-cancelled"><span>{counts.cancelled}</span> Cancelled</div>
        </div>
      </div>

      <div className="sv-toolbar">
        <div className="sv-search">
          <FaSearch />
          <input
            type="text"
            placeholder="Search by property, owner or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sv-filters">
          {["all", "upcoming", "completed", "cancelled"].map((s) => (
            <button key={s} className={statusFilter === s ? "active" : ""} onClick={() => setStatusFilter(s)}>
              {s === "all" ? "All" : STATUS_META[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="sv-info">Loading scheduled viewings...</p>}
      {error   && <p className="sv-error">{error}</p>}

      {!loading && !error && (
        <div className="sv-table-wrapper">
          <table className="sv-table">
            <thead>
              <tr>
                <th>#</th><th>Image</th><th>Property</th><th>Date & Time</th>
                <th>Location</th><th>Owner</th><th>Status</th><th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((v) => {
                const meta  = STATUS_META[v.status] || STATUS_META.upcoming;
                const thumb = v.property_images?.[0];
                return (
                  <tr key={v.id}>
                    <td className="sv-id">#{v.id}</td>
                    <td className="sv-thumb-cell">
                      {thumb
                        ? <img src={thumb} alt={v.property_name} className="sv-thumb" />
                        : <div className="sv-thumb-placeholder"><FaHome /></div>}
                    </td>
                    <td>
                      <div className="sv-prop-cell">
                        <strong>{v.property_name}</strong>
                        <span><FaMapMarkerAlt />{[v.property_city, v.property_region].filter(Boolean).join(", ")}</span>
                        <span className="sv-type-tag">{v.property_type}</span>
                      </div>
                    </td>
                    <td>
                      <div className="sv-datetime-cell">
                        <span className="sv-date"><FaCalendarAlt /> {formatDate(v.date)}</span>
                        <span className="sv-time"><FaClock /> {formatTime(v.time)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="sv-location-cell">
                        <FaMapMarkerAlt /><span>{v.location || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="sv-owner-cell">
                        <strong>{v.owner_name}</strong>
                        <a href={`tel:${v.owner_phone}`} className="sv-contact sv-phone">
                          <FaPhone /> {v.owner_phone}
                        </a>
                      </div>
                    </td>
                    <td>
                      <span className={`sv-badge ${meta.cls}`}>{meta.icon} {meta.label}</span>
                    </td>
                    <td>
                      <button className="sv-view-btn" onClick={() => setSelected(v)}>View</button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="8" className="sv-empty-row"><FaCalendarAlt /> No scheduled viewings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="sv-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="sv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header">
              <h3>Viewing #{selected.id}</h3>
              <button className="sv-close-btn" onClick={() => setSelected(null)}><FaTimes /></button>
            </div>
            <div className="sv-modal-body">
              {selected.property_images?.[0]
                ? <img src={selected.property_images[0]} alt={selected.property_name} className="sv-modal-img" />
                : <div className="sv-modal-no-img"><FaHome /> No image available</div>}

              <div className="sv-modal-status-row">
                <span className={`sv-badge ${STATUS_META[selected.status]?.cls}`}>
                  {STATUS_META[selected.status]?.icon} {STATUS_META[selected.status]?.label}
                </span>
                <span className="sv-modal-scheduled">Scheduled on {formatDate(selected.scheduled_at)}</span>
              </div>

              <div className="sv-modal-section">
                <h4><FaHome /> Property</h4>
                <div className="sv-modal-grid">
                  <div><span>Name</span><strong>{selected.property_name}</strong></div>
                  <div><span>Type</span><strong>{selected.property_type}</strong></div>
                  <div><span>Location</span><strong>{[selected.property_city, selected.property_region].filter(Boolean).join(", ")}</strong></div>
                </div>
              </div>

              <div className="sv-modal-section sv-meeting-section">
                <h4><FaCalendarAlt /> Meeting Details</h4>
                <div className="sv-modal-grid">
                  <div><span>Date</span><strong>{formatDate(selected.date)}</strong></div>
                  <div><span>Time</span><strong>{formatTime(selected.time)}</strong></div>
                  <div className="sv-full-col"><span>Meeting Location</span><strong>{selected.location || "—"}</strong></div>
                </div>
                {selected.note && (
                  <div className="sv-note"><FaStickyNote /><p>{selected.note}</p></div>
                )}
              </div>

              <div className="sv-modal-section">
                <h4><FaUser /> Owner Contact</h4>
                <div className="sv-modal-grid">
                  <div><span>Name</span><strong>{selected.owner_name}</strong></div>
                  <div><span>Phone</span><strong>{selected.owner_phone}</strong></div>
                  <div><span>Email</span><strong>{selected.owner_email}</strong></div>
                </div>
                <div className="sv-modal-contact-btns">
                  <a href={`tel:${selected.owner_phone}`} className="sv-contact-btn sv-phone"><FaPhone /> Call Owner</a>
                  <a href={`mailto:${selected.owner_email}`} className="sv-contact-btn sv-email"><FaEnvelope /> Email Owner</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledViewings;
