import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  FaHome, FaUser, FaCalendarAlt, FaSearch,
  FaTimesCircle, FaBed, FaRedo,
} from "react-icons/fa";
import { api } from "../UploadDetails/api/api";
import RenewLeaseModal from "../Renewleasemodal/RenewLeaseModal";
import TerminateLeaseModal from "../Terminateleasemodal/TerminateLeaseModal";
import "./OwnerLeases.css";

const STATUS_META = {
  active:    { label: "Active",    cls: "ls-active"    },
  ended:     { label: "Ended",     cls: "ls-ended"     },
  cancelled: { label: "Cancelled", cls: "ls-cancelled" },
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—";

const OwnerLeases = () => {
  const [leases, setLeases]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("active");
  const [terminateLease, setTerminateLease] = useState(null);
  const [renewLease, setRenewLease]       = useState(null);
  const [terminating, setTerminating]     = useState(false);
  const [renewing, setRenewing]           = useState(false);
  const [popup, setPopup]                 = useState(null);

  const fetchLeases = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/leases/");
      const data = res.data;
      setLeases(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load leases.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeases(); }, [fetchLeases]);

  const filtered = useMemo(() => {
    return leases.filter((l) => {
      const q = search.toLowerCase();
      const matchSearch =
        (l.property_name || "").toLowerCase().includes(q) ||
        (l.tenant_name   || "").toLowerCase().includes(q) ||
        (l.room_number   || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" ? true : l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leases, search, statusFilter]);

  const counts = useMemo(() => ({
    active:    leases.filter((l) => l.status === "active").length,
    ended:     leases.filter((l) => l.status === "ended").length,
    cancelled: leases.filter((l) => l.status === "cancelled").length,
  }), [leases]);

  // ── Terminate ─────────────────────────────────────────────────────
  const handleTerminate = async ({ note }) => {
    if (!terminateLease) return;
    try {
      setTerminating(true);
      await api.post(`/leases/${terminateLease.id}/terminate/`, { note });
      setTerminateLease(null);
      await fetchLeases();
      setPopup({ type: "success", message: `Lease for ${terminateLease.property_name} has been ended.` });
    } catch (err) {
      setPopup({ type: "error", message: err.response?.data?.detail || "Failed to end lease." });
    } finally {
      setTerminating(false);
    }
  };

  // ── Renew ─────────────────────────────────────────────────────────
  const handleRenew = async (formData) => {
    if (!renewLease) return;
    try {
      setRenewing(true);
      await api.post(`/leases/${renewLease.id}/renew/`, formData);
      setRenewLease(null);
      await fetchLeases();
      setPopup({ type: "success", message: `Lease for ${renewLease.property_name} has been renewed successfully.` });
    } catch (err) {
      setPopup({ type: "error", message: err.response?.data?.detail || "Failed to renew lease." });
    } finally {
      setRenewing(false);
    }
  };

  return (
    <div className="ol-page">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="ol-header">
        <div>
          <h2>Tenant Leases</h2>
          <p>Manage all active and past leases for your properties.</p>
        </div>
        <div className="ol-counts">
          <div className="ol-count active"><span>{counts.active}</span> Active</div>
          <div className="ol-count ended"><span>{counts.ended}</span> Ended</div>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="ol-toolbar">
        <div className="ol-search">
          <FaSearch size={13} />
          <input
            type="text"
            placeholder="Search by property, tenant or room…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="ol-filters">
          {["all", "active", "ended", "cancelled"].map((s) => (
            <button
              key={s}
              className={statusFilter === s ? "active" : ""}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : STATUS_META[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="ol-info">Loading leases…</p>}
      {error   && <p className="ol-error">{error}</p>}

      {/* ── Table ───────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="ol-table-wrapper">
          <table className="ol-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Property</th>
                <th>Tenant</th>
                <th>Room</th>
                <th>Rent</th>
                <th>Lease Period</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((l) => (
                <tr key={l.id}>
                  <td className="ol-id">#{l.id}</td>

                  <td>
                    <div className="ol-prop-cell">
                      <FaHome className="ol-cell-icon" />
                      <div>
                        <strong>{l.property_name}</strong>
                        <span>{l.property_city || "—"}</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="ol-tenant-cell">
                      <FaUser className="ol-cell-icon" />
                      <div>
                        <strong>{l.tenant_name}</strong>
                        <span>{l.tenant_phone || l.tenant_email || "—"}</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    {l.room_number
                      ? <span className="ol-room-badge"><FaBed /> {l.room_number}</span>
                      : <span className="ol-na">—</span>}
                  </td>

                  <td className="ol-rent">
                    GHS {Number(l.monthly_rent).toLocaleString()}<small>/mo</small>
                  </td>

                  <td>
                    <div className="ol-dates">
                      <span>{formatDate(l.lease_start_date)}</span>
                      <span className="ol-date-sep">→</span>
                      <span>{formatDate(l.lease_end_date)}</span>
                    </div>
                  </td>

                  <td>
                    <span className={`ol-payment ${l.first_payment_status}`}>
                      {l.first_payment_status}
                    </span>
                  </td>

                  <td>
                    <span className={`ol-status ${STATUS_META[l.status]?.cls}`}>
                      {STATUS_META[l.status]?.label}
                    </span>
                  </td>

                  <td>
                    <div className="ol-action-btns">
                      {l.status === "active" && (
                        <button
                          className="ol-terminate-btn"
                          onClick={() => setTerminateLease(l)}
                          title="End Lease"
                        >
                          <FaTimesCircle /> End
                        </button>
                      )}

                      {(l.status === "ended" || l.status === "cancelled") && (
                        <button
                          className="ol-renew-btn"
                          onClick={() => setRenewLease(l)}
                          title="Renew Lease"
                        >
                          <FaRedo /> Renew
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="9" className="ol-empty">No leases found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Terminate Modal ──────────────────────────────────────── */}
      {terminateLease && (
        <TerminateLeaseModal
          lease={terminateLease}
          onClose={() => !terminating && setTerminateLease(null)}
          onConfirm={handleTerminate}
          submitting={terminating}
        />
      )}

      {/* ── Renew Modal ──────────────────────────────────────────── */}
      {renewLease && (
        <RenewLeaseModal
          lease={renewLease}
          onClose={() => !renewing && setRenewLease(null)}
          onConfirm={handleRenew}
          submitting={renewing}
        />
      )}

      {/* ── Popup ────────────────────────────────────────────────── */}
      {popup && (
        <div className="ol-popup-overlay" onClick={() => setPopup(null)}>
          <div className={`ol-popup ${popup.type}`} onClick={(e) => e.stopPropagation()}>
            <div className="ol-popup-icon">
              {popup.type === "success" ? "✓" : "!"}
            </div>
            <h3>{popup.type === "success" ? "Success" : "Error"}</h3>
            <p>{popup.message}</p>
            <button onClick={() => setPopup(null)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerLeases;