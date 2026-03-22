import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  FaHome, FaMapMarkerAlt, FaPhone, FaEnvelope, FaUser,
  FaCalendarAlt, FaHourglass, FaCheckCircle, FaTimesCircle,
  FaExchangeAlt, FaSearch, FaTimes, FaChevronLeft, FaChevronRight,
} from "react-icons/fa";
import "./TenantBooking.css";
import { api } from "../../Owner/UploadDetails/api/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_META = {
  pending:   { label: "Pending",   icon: <FaHourglass />,   cls: "st-pending"   },
  confirmed: { label: "Confirmed", icon: <FaCheckCircle />, cls: "st-confirmed" },
  converted: { label: "Converted", icon: <FaExchangeAlt />, cls: "st-converted" },
  rejected:  { label: "Rejected",  icon: <FaTimesCircle />, cls: "st-rejected"  },
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—";

// ── Image viewer ──────────────────────────────────────────────────────────────
const ImageViewer = ({ images }) => {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) {
    return <div className="tb-no-image"><FaHome /> No images available</div>;
  }
  return (
    <div className="tb-image-viewer">
      <img src={images[idx]} alt={`Property ${idx + 1}`} className="tb-viewer-img" />
      {images.length > 1 && (
        <>
          <button className="tb-img-nav tb-img-prev" onClick={() => setIdx((p) => (p === 0 ? images.length - 1 : p - 1))}><FaChevronLeft /></button>
          <button className="tb-img-nav tb-img-next" onClick={() => setIdx((p) => (p === images.length - 1 ? 0 : p + 1))}><FaChevronRight /></button>
          <div className="tb-img-dots">
            {images.map((_, i) => (
              <span key={i} className={`tb-img-dot ${i === idx ? "active" : ""}`} onClick={() => setIdx(i)} />
            ))}
          </div>
          <div className="tb-img-counter">{idx + 1} / {images.length}</div>
        </>
      )}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────
const TenantBooking = () => {
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected]         = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/bookings/my_tenant_bookings/");
      const data = res.data;
      setBookings(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      console.error("Fetch tenant bookings error:", err);
      setError(err.response?.data?.detail || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const q = search.toLowerCase();
      const matchSearch =
        (b.property_name || "").toLowerCase().includes(q) ||
        (b.property_city || "").toLowerCase().includes(q) ||
        (b.owner_name    || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" ? true : b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bookings, search, statusFilter]);

  // Normalise images — BookingSerializer returns property images separately
  const getImages = (b) => {
    if (Array.isArray(b.property_images) && b.property_images.length > 0) return b.property_images;
    if (Array.isArray(b.images) && b.images.length > 0) return b.images;
    return [];
  };

  return (
    <div className="tb-page">

      <div className="tb-header">
        <div>
          <h2>My Bookings</h2>
          <p>Track your property booking requests and owner contact details.</p>
        </div>
        <div className="tb-stat-pill">
          <span>{bookings.length}</span> Total Bookings
        </div>
      </div>

      <div className="tb-toolbar">
        <div className="tb-search">
          <FaSearch />
          <input
            type="text"
            placeholder="Search by property, city or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tb-filters">
          {["all", "pending", "confirmed", "converted", "rejected"].map((s) => (
            <button key={s} className={statusFilter === s ? "active" : ""} onClick={() => setStatusFilter(s)}>
              {s === "all" ? "All" : STATUS_META[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="tb-info">Loading bookings...</p>}
      {error   && <p className="tb-error">{error}</p>}

      {!loading && !error && (
        <div className="tb-table-wrapper">
          <table className="tb-table">
            <thead>
              <tr>
                <th>#</th><th>Image</th><th>Property</th><th>Owner Contact</th>
                <th>Price</th><th>Status</th><th>Date</th><th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((b) => {
                const meta  = STATUS_META[b.status] || STATUS_META.pending;
                const thumb = getImages(b)[0];
                return (
                  <tr key={b.id}>
                    <td className="tb-id">#{b.id}</td>
                    <td className="tb-thumb-cell">
                      {thumb
                        ? <img src={thumb} alt={b.property_name} className="tb-thumb" />
                        : <div className="tb-thumb-placeholder"><FaHome /></div>}
                    </td>
                    <td>
                      <div className="tb-prop-cell">
                        <strong>{b.property_name}</strong>
                        <span><FaMapMarkerAlt />{[b.property_city, b.property_region].filter(Boolean).join(", ")}</span>
                        <span className="tb-type-tag">{b.property_type || b.category}</span>
                      </div>
                    </td>
                    <td>
                      <div className="tb-owner-cell">
                        <strong>{b.owner_name}</strong>
                        <a href={`tel:${b.owner_phone}`} className="tb-inline-contact tb-phone"><FaPhone /> {b.owner_phone || "—"}</a>
                        <a href={`mailto:${b.owner_email}`} className="tb-inline-contact tb-email"><FaEnvelope /> {b.owner_email || "—"}</a>
                      </div>
                    </td>
                    <td className="tb-price-cell">
                      <strong>GHS {b.property_price ? Number(b.property_price).toLocaleString() : "—"}</strong>
                      <small>/mo</small>
                    </td>
                    <td>
                      <span className={`tb-badge ${meta.cls}`}>{meta.icon} {meta.label}</span>
                    </td>
                    <td className="tb-date-cell">
                      <FaCalendarAlt /> {formatDate(b.created_at)}
                    </td>
                    <td>
                      <button className="tb-view-btn" onClick={() => setSelected(b)}>View</button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="8" className="tb-empty-row"><FaHome /> No bookings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="tb-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="tb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tb-modal-header">
              <h3>Booking #{selected.id}</h3>
              <button className="tb-close-btn" onClick={() => setSelected(null)}><FaTimes /></button>
            </div>
            <div className="tb-modal-body">

              <ImageViewer images={getImages(selected)} />

              <div className="tb-modal-status-row">
                <span className={`tb-badge ${STATUS_META[selected.status]?.cls}`}>
                  {STATUS_META[selected.status]?.icon} {STATUS_META[selected.status]?.label}
                </span>
                <span className="tb-modal-date"><FaCalendarAlt /> {formatDate(selected.created_at)}</span>
              </div>

              <div className="tb-modal-section">
                <h4><FaHome /> Property Details</h4>
                <div className="tb-modal-grid">
                  <div><span>Name</span><strong>{selected.property_name}</strong></div>
                  <div><span>Type</span><strong>{selected.property_type || selected.category || "—"}</strong></div>
                  <div><span>Location</span><strong>{[selected.property_city, selected.property_region].filter(Boolean).join(", ")}</strong></div>
                  <div><span>Price</span><strong>GHS {selected.property_price ? Number(selected.property_price).toLocaleString() : "—"}/mo</strong></div>
                </div>
              </div>

              <div className="tb-modal-section">
                <h4><FaUser /> Owner Contact</h4>
                <div className="tb-modal-grid">
                  <div><span>Name</span><strong>{selected.owner_name}</strong></div>
                  <div><span>Phone</span><strong>{selected.owner_phone || "—"}</strong></div>
                  <div><span>Email</span><strong>{selected.owner_email || "—"}</strong></div>
                </div>
                <div className="tb-modal-contact-btns">
                  <a href={`tel:${selected.owner_phone}`} className="tb-contact-btn tb-phone"><FaPhone /> Call Owner</a>
                  <a href={`mailto:${selected.owner_email}`} className="tb-contact-btn tb-email"><FaEnvelope /> Email Owner</a>
                </div>
              </div>

              <div className="tb-modal-section">
                <h4><FaUser /> Your Submitted Details</h4>
                <div className="tb-modal-grid">
                  <div><span>Name</span><strong>{selected.name}</strong></div>
                  <div><span>Email</span><strong>{selected.email}</strong></div>
                  <div><span>Phone</span><strong>{selected.phone}</strong></div>
                </div>
                {selected.message && (
                  <div className="tb-modal-message">
                    <span>Message</span>
                    <p>"{selected.message}"</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantBooking;
