import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaHome,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaTimes,
} from "react-icons/fa";
import { api } from "../../Owner/UploadDetails/api/api";
import "./AdminBookings.css";

const STATUS_COLORS = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  converted: "status-converted",
  rejected: "status-rejected",
};

const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/bookings/");
      const data = res.data;
      setBookings(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      console.error("Fetch bookings error:", err);
      setError(err.response?.data?.detail || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const query = search.toLowerCase();
      const matchesSearch =
        (b.property_name || "").toLowerCase().includes(query) ||
        (b.tenant_name || "").toLowerCase().includes(query) ||
        (b.owner_name || "").toLowerCase().includes(query) ||
        (b.name || "").toLowerCase().includes(query) ||
        (b.email || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ? true : b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, search, statusFilter]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="admin-bookings-page">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="admin-bookings-header">
        <div>
          <h2>All Bookings</h2>
          <p>View every booking request — who made it, for which property, and who owns it.</p>
        </div>
        <div className="bookings-stat-card">
          <span>Total</span>
          <h3>{bookings.length}</h3>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="admin-bookings-toolbar">
        <div className="search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Search by property, tenant, owner, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          {["all", "pending", "confirmed", "converted", "rejected"].map((s) => (
            <button
              key={s}
              className={statusFilter === s ? "active-filter" : ""}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── States ──────────────────────────────────────────────────── */}
      {loading && <p className="info-message">Loading bookings...</p>}
      {error && <p className="error-message">{error}</p>}

      {/* ── Table ───────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="admin-bookings-table-wrapper">
          <table className="admin-bookings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Property</th>
                <th>Tenant</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Date</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((b) => (
                  <tr key={b.id}>
                    <td>#{b.id}</td>

                    <td>
                      <div className="booking-property-cell">
                        <FaHome className="cell-icon" />
                        <div>
                          <strong>{b.property_name || "—"}</strong>
                          <span>
                            <FaMapMarkerAlt />{" "}
                            {[b.property_city, b.property_region]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </span>
                          {b.property_price && (
                            <span>GHS {Number(b.property_price).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="booking-person-cell">
                        <FaUser className="cell-icon" />
                        <div>
                          <strong>{b.tenant_name || b.name || "—"}</strong>
                          <span><FaEnvelope /> {b.tenant_email || b.email || "—"}</span>
                          <span><FaPhone /> {b.tenant_phone || b.phone || "—"}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="booking-person-cell">
                        <FaUser className="cell-icon owner-icon" />
                        <div>
                          <strong>{b.owner_name || "—"}</strong>
                          <span><FaEnvelope /> {b.owner_email || "—"}</span>
                          <span><FaPhone /> {b.owner_phone || "—"}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`booking-status ${STATUS_COLORS[b.status] || ""}`}>
                        {b.status}
                      </span>
                    </td>

                    <td>
                      <span className="booking-date">
                        <FaCalendarAlt /> {formatDate(b.created_at)}
                      </span>
                    </td>

                    <td>
                      <button
                        className="view-booking-btn"
                        onClick={() => setSelectedBooking(b)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-bookings">
                    No bookings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail Modal ────────────────────────────────────────────── */}
      {selectedBooking && (
        <div
          className="booking-modal-backdrop"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="booking-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="booking-modal-header">
              <h3>Booking #{selectedBooking.id}</h3>
              <button
                className="close-modal-btn"
                onClick={() => setSelectedBooking(null)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="booking-modal-body">

              {/* Property */}
              <div className="modal-section">
                <h4><FaHome /> Property</h4>
                <p><strong>Name:</strong> {selectedBooking.property_name || "—"}</p>
                <p>
                  <strong>Location:</strong>{" "}
                  {[selectedBooking.property_city, selectedBooking.property_region]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
                {selectedBooking.property_price && (
                  <p>
                    <strong>Price:</strong> GHS{" "}
                    {Number(selectedBooking.property_price).toFixed(2)}
                  </p>
                )}
              </div>

              {/* Tenant */}
              <div className="modal-section">
                <h4><FaUser /> Tenant (Requester)</h4>
                <p><strong>Name:</strong> {selectedBooking.tenant_name || selectedBooking.name || "—"}</p>
                <p><strong>Email:</strong> {selectedBooking.tenant_email || selectedBooking.email || "—"}</p>
                <p><strong>Phone:</strong> {selectedBooking.tenant_phone || selectedBooking.phone || "—"}</p>
                {selectedBooking.message && (
                  <p><strong>Message:</strong> {selectedBooking.message}</p>
                )}
              </div>

              {/* Owner */}
              <div className="modal-section">
                <h4><FaUser /> Property Owner</h4>
                <p><strong>Name:</strong> {selectedBooking.owner_name || "—"}</p>
                <p><strong>Email:</strong> {selectedBooking.owner_email || "—"}</p>
                <p><strong>Phone:</strong> {selectedBooking.owner_phone || "—"}</p>
              </div>

              {/* Meta */}
              <div className="modal-section">
                <h4><FaCalendarAlt /> Booking Info</h4>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className={`booking-status ${STATUS_COLORS[selectedBooking.status] || ""}`}>
                    {selectedBooking.status}
                  </span>
                </p>
                <p><strong>Date:</strong> {formatDate(selectedBooking.created_at)}</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookings;
