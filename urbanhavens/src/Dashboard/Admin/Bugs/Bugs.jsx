import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FaSms,
  FaBug,
  FaClipboardList,
  FaCalendarCheck,
  FaBell,
  FaHome,
  FaUser,
  FaPhoneAlt,
  FaSyncAlt,
  FaPause,
  FaPlay,
  FaTrashAlt,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import { api } from "../../Owner/UploadDetails/api/api";
import "./Bugs.css";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 4000;

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "sms", label: "SMS" },
  { value: "api_error", label: "API Errors" },
  { value: "booking", label: "Bookings" },
  { value: "meeting", label: "Meetings" },
  { value: "notification", label: "Notifications" },
  { value: "property", label: "Properties" },
];

const STATUSES = [
  { value: "", label: "All" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
  { value: "info", label: "Info" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status) {
  if (status === "success") return "bug-status-success";
  if (status === "failure") return "bug-status-failure";
  return "bug-status-info";
}

function categoryIcon(category) {
  const icons = {
    sms: <FaSms />,
    api_error: <FaBug />,
    booking: <FaClipboardList />,
    meeting: <FaCalendarCheck />,
    notification: <FaBell />,
    property: <FaHome />,
  };
  return icons[category] || <FaClipboardList />;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LogRow({ log, isNew }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bug-row ${isNew ? "bug-row--new" : ""}`}>
      <div className="bug-row-main" onClick={() => setExpanded((p) => !p)}>
        <span className="bug-row-icon">{categoryIcon(log.category)}</span>

        <span className={`bug-row-status ${statusClass(log.status)}`}>
          {log.status.toUpperCase()}
        </span>

        <span className="bug-row-category">{log.category.replace("_", " ")}</span>

        <span className="bug-row-message">{log.message}</span>

        <span className="bug-row-meta">
          {log.user_display && (
            <span className="bug-row-user">
              <FaUser /> {log.user_display}
            </span>
          )}
          {log.phone && (
            <span className="bug-row-phone">
              <FaPhoneAlt /> {log.phone}
            </span>
          )}
          {log.booking_id && (
            <span className="bug-row-id">Booking #{log.booking_id}</span>
          )}
          {log.meeting_id && (
            <span className="bug-row-id">Meeting #{log.meeting_id}</span>
          )}
          {log.property_id && (
            <span className="bug-row-id">Property #{log.property_id}</span>
          )}
          {log.status_code && (
            <span className="bug-row-code">{log.status_code}</span>
          )}
        </span>

        <span className="bug-row-time">
          <span className="bug-row-date">{formatDate(log.created_at)}</span>
          {formatTime(log.created_at)}
        </span>

        <span className="bug-row-chevron">
          {expanded ? <FaChevronUp /> : <FaChevronDown />}
        </span>
      </div>

      {expanded && (
        <div className="bug-row-detail">
          {log.endpoint && (
            <p><strong>Endpoint:</strong> {log.endpoint}</p>
          )}
          {log.detail ? (
            <pre>{log.detail}</pre>
          ) : (
            <p className="bug-row-no-detail">No additional detail.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatsBar({ logs }) {
  const total = logs.length;
  const success = logs.filter((l) => l.status === "success").length;
  const failures = logs.filter((l) => l.status === "failure").length;
  const info = logs.filter((l) => l.status === "info").length;

  return (
    <div className="bug-stats">
      <div className="bug-stat bug-stat--total">
        <span className="bug-stat-num">{total}</span>
        <span className="bug-stat-label">Total</span>
      </div>
      <div className="bug-stat bug-stat--success">
        <span className="bug-stat-num">{success}</span>
        <span className="bug-stat-label">Success</span>
      </div>
      <div className="bug-stat bug-stat--failure">
        <span className="bug-stat-num">{failures}</span>
        <span className="bug-stat-label">Failures</span>
      </div>
      <div className="bug-stat bug-stat--info">
        <span className="bug-stat-num">{info}</span>
        <span className="bug-stat-label">Info</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const Bugs = () => {
  const [logs, setLogs] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [paused, setPaused] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const knownIds = useRef(new Set());
  const timerRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params = { limit: 200 };
      if (category) params.category = category;
      if (status) params.status = status;

      const res = await api.get("/system-logs/", { params });
      const data = res.data?.results ?? res.data ?? [];

      const incoming = new Set(data.map((l) => l.id));
      const fresh = [...incoming].filter((id) => !knownIds.current.has(id));

      if (fresh.length > 0) {
        setNewIds(new Set(fresh));
        setTimeout(() => setNewIds(new Set()), 2000);
      }

      knownIds.current = incoming;
      setLogs(data);
      setLastUpdated(new Date());
      setError("");
    } catch {
      setError("Failed to fetch logs. Are you logged in as admin?");
    } finally {
      setLoading(false);
    }
  }, [category, status]);

  useEffect(() => {
    fetchLogs();

    if (!paused) {
      timerRef.current = setInterval(fetchLogs, POLL_INTERVAL);
    }

    return () => clearInterval(timerRef.current);
  }, [fetchLogs, paused]);

  const handleClear = async () => {
    if (!window.confirm("Delete all system logs? This cannot be undone.")) return;

    try {
      setClearing(true);
      await api.delete("/system-logs/clear/");
      setLogs([]);
      knownIds.current = new Set();
    } catch {
      setError("Failed to clear logs.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bugs-wrapper">
      <div className="bugs-header">
        <div className="bugs-header-left">
          <h1 className="bugs-title">
            <span className="bugs-title-icon"><FaBug /></span>
            System Monitor
          </h1>

          <span className={`bugs-live-badge ${paused ? "bugs-live-badge--paused" : ""}`}>
            {paused ? "PAUSED" : "LIVE"}
          </span>

          {lastUpdated && (
            <span className="bugs-last-updated">
              Updated {formatTime(lastUpdated.toISOString())}
            </span>
          )}
        </div>

        <div className="bugs-header-right">
          <button
            className="bugs-btn bugs-btn--pause"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <><FaPlay /> Resume</> : <><FaPause /> Pause</>}
          </button>

          <button
            className="bugs-btn bugs-btn--refresh"
            onClick={fetchLogs}
          >
            <FaSyncAlt /> Refresh
          </button>

          <button
            className="bugs-btn bugs-btn--clear"
            onClick={handleClear}
            disabled={clearing}
          >
            <FaTrashAlt /> {clearing ? "Clearing..." : "Clear Logs"}
          </button>
        </div>
      </div>

      <StatsBar logs={logs} />

      <div className="bugs-filters">
        <div className="bugs-filter-group">
          <label>Category</label>
          <div className="bugs-filter-pills">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={`bugs-pill ${category === c.value ? "bugs-pill--active" : ""}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bugs-filter-group">
          <label>Status</label>
          <div className="bugs-filter-pills">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                className={`bugs-pill ${status === s.value ? "bugs-pill--active" : ""}`}
                onClick={() => setStatus(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="bugs-error">{error}</div>}

      <div className="bugs-feed">
        {loading ? (
          <div className="bugs-loading">
            <span className="bugs-spinner" />
            Loading logs…
          </div>
        ) : logs.length === 0 ? (
          <div className="bugs-empty">
            <FaClipboardList />
            <p>No logs found. The system is quiet.</p>
          </div>
        ) : (
          logs.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              isNew={newIds.has(log.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Bugs;