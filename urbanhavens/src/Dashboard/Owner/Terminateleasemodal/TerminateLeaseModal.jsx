import React, { useState } from "react";
import "./TerminateLeaseModal.css";

const TerminateLeaseModal = ({ lease, onClose, onConfirm, submitting }) => {
  const [note, setNote] = useState("");

  const handleConfirm = (e) => {
    e.preventDefault();
    onConfirm({ note });
  };

  return (
    <div className="tl-overlay" onClick={onClose}>
      <div className="tl-modal" onClick={(e) => e.stopPropagation()}>

        <div className="tl-header">
          <h2>End Lease</h2>
          <button className="tl-close-btn" onClick={onClose} disabled={submitting}>✕</button>
        </div>

        <div className="tl-summary">
          <div className="tl-warning-icon">⚠</div>
          <p>
            You are about to end the lease for{" "}
            <strong>{lease?.tenant_name}</strong> at{" "}
            <strong>{lease?.property_name}</strong>.
          </p>
          {lease?.property_category === "hostel" && lease?.room_number && (
            <p className="tl-room-note">Room: <strong>{lease.room_number}</strong></p>
          )}
          <p className="tl-consequence">
            This will free up the{" "}
            {lease?.property_category === "hostel" ? "room" : "property"}{" "}
            and notify the tenant.
          </p>
        </div>

        <form onSubmit={handleConfirm}>
          <div className="tl-field">
            <label>Move-out Note <span className="tl-optional">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Tenant vacated on agreed date. Room in good condition."
              rows={3}
              disabled={submitting}
            />
          </div>

          <div className="tl-actions">
            <button
              type="button"
              className="tl-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="tl-confirm-btn"
              disabled={submitting}
            >
              {submitting ? "Ending Lease..." : "Yes, End Lease"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TerminateLeaseModal;
