import React, { useState } from "react";
import "./RenewLeaseModal.css";

const RenewLeaseModal = ({ lease, onClose, onConfirm, submitting }) => {
  const [formData, setFormData] = useState({
    lease_start_date:     "",
    lease_end_date:       "",
    move_in_date:         "",
    monthly_rent:         lease?.monthly_rent     || "",
    deposit_amount:       lease?.deposit_amount   || "",
    first_payment_status: "pending",
    room_number:          lease?.room_number      || "",
    notes:                "",
  });

  const [errors, setErrors] = useState({});

  const isHostel = lease?.property_category === "hostel";

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev)  => ({ ...prev, [e.target.name]: "" }));
  };

  const validate = () => {
    const err = {};
    if (!formData.lease_start_date) err.lease_start_date = "Start date is required";
    if (!formData.lease_end_date)   err.lease_end_date   = "End date is required";
    if (!formData.move_in_date)     err.move_in_date     = "Move-in date is required";
    if (!formData.monthly_rent)     err.monthly_rent     = "Monthly rent is required";
    if (!formData.deposit_amount)   err.deposit_amount   = "Deposit amount is required";
    if (
      formData.lease_start_date &&
      formData.lease_end_date &&
      formData.lease_end_date <= formData.lease_start_date
    ) {
      err.lease_end_date = "End date must be after start date";
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onConfirm(formData);
  };

  return (
    <div className="rl-overlay" onClick={onClose}>
      <div className="rl-modal" onClick={(e) => e.stopPropagation()}>

        <div className="rl-header">
          <h2>Renew Lease</h2>
          <button className="rl-close-btn" onClick={onClose} disabled={submitting}>✕</button>
        </div>

        <div className="rl-summary">
          <div className="rl-renew-icon">🔄</div>
          <p>
            Renewing lease for <strong>{lease?.tenant_name}</strong> at{" "}
            <strong>{lease?.property_name}</strong>
          </p>
          {isHostel && lease?.room_number && (
            <p className="rl-room">Room: <strong>{lease.room_number}</strong></p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rl-form">
          <div className="rl-grid">

            <div className="rl-field">
              <label>New Lease Start Date</label>
              <input
                type="date"
                name="lease_start_date"
                value={formData.lease_start_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.lease_start_date && <small>{errors.lease_start_date}</small>}
            </div>

            <div className="rl-field">
              <label>New Lease End Date</label>
              <input
                type="date"
                name="lease_end_date"
                value={formData.lease_end_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.lease_end_date && <small>{errors.lease_end_date}</small>}
            </div>

            <div className="rl-field">
              <label>Move-in Date</label>
              <input
                type="date"
                name="move_in_date"
                value={formData.move_in_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.move_in_date && <small>{errors.move_in_date}</small>}
            </div>

            <div className="rl-field">
              <label>Monthly Rent (GHS)</label>
              <input
                type="number"
                name="monthly_rent"
                value={formData.monthly_rent}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.monthly_rent && <small>{errors.monthly_rent}</small>}
            </div>

            <div className="rl-field">
              <label>Deposit Amount (GHS)</label>
              <input
                type="number"
                name="deposit_amount"
                value={formData.deposit_amount}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.deposit_amount && <small>{errors.deposit_amount}</small>}
            </div>

            <div className="rl-field">
              <label>First Payment Status</label>
              <select
                name="first_payment_status"
                value={formData.first_payment_status}
                onChange={handleChange}
                disabled={submitting}
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {isHostel && (
              <div className="rl-field">
                <label>Room Number</label>
                <input
                  type="text"
                  name="room_number"
                  value={formData.room_number}
                  onChange={handleChange}
                  placeholder="e.g. 101, A4"
                  disabled={submitting}
                />
              </div>
            )}

          </div>

          <div className="rl-field rl-notes">
            <label>Notes <span className="rl-optional">(optional)</span></label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any notes about this renewal..."
              rows={3}
              disabled={submitting}
            />
          </div>

          <div className="rl-actions">
            <button
              type="button"
              className="rl-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rl-confirm-btn"
              disabled={submitting}
            >
              {submitting ? "Renewing..." : "Renew Lease"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenewLeaseModal;
