import React, { useMemo, useState } from "react";
import "./RenewLeaseModal.css";

const formatMoney = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : value;
};

const RenewLeaseModal = ({ lease, onClose, onConfirm, submitting }) => {
  const isHostel = lease?.property_category === "hostel";

  const [formData, setFormData] = useState({
    lease_start_date: "",
    lease_end_date: "",
    move_in_date: "",
    monthly_rent: lease?.monthly_rent || "",
    deposit_amount: lease?.deposit_amount || "",
    first_payment_status: "pending",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  const roomAvailabilityText = useMemo(() => {
    if (!isHostel) return "";
    const spaces = lease?.room_available_spaces;
    if (spaces === null || spaces === undefined) return "";
    return `${spaces} space${Number(spaces) === 1 ? "" : "s"} left`;
  }, [isHostel, lease?.room_available_spaces]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const err = {};

    if (!formData.lease_start_date) {
      err.lease_start_date = "Start date is required";
    }

    if (!formData.lease_end_date) {
      err.lease_end_date = "End date is required";
    }

    if (!formData.move_in_date) {
      err.move_in_date = "Move-in date is required";
    }

    if (!formData.monthly_rent) {
      err.monthly_rent = "Monthly rent is required";
    } else if (Number(formData.monthly_rent) <= 0) {
      err.monthly_rent = "Monthly rent must be greater than 0";
    }

    if (!formData.deposit_amount && formData.deposit_amount !== 0 && formData.deposit_amount !== "0") {
      err.deposit_amount = "Deposit amount is required";
    } else if (Number(formData.deposit_amount) < 0) {
      err.deposit_amount = "Deposit amount cannot be negative";
    }

    if (
      formData.lease_start_date &&
      formData.lease_end_date &&
      formData.lease_end_date <= formData.lease_start_date
    ) {
      err.lease_end_date = "End date must be after start date";
    }

    if (
      formData.lease_start_date &&
      formData.move_in_date &&
      formData.move_in_date < formData.lease_start_date
    ) {
      err.move_in_date = "Move-in date cannot be earlier than start date";
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onConfirm({
      lease_start_date: formData.lease_start_date,
      lease_end_date: formData.lease_end_date,
      move_in_date: formData.move_in_date,
      monthly_rent: formData.monthly_rent,
      deposit_amount: formData.deposit_amount,
      first_payment_status: formData.first_payment_status,
      notes: formData.notes,
    });
  };

  return (
    <div className="rl-overlay" onClick={onClose}>
      <div className="rl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rl-header">
          <h2>Renew Lease</h2>
          <button
            className="rl-close-btn"
            onClick={onClose}
            disabled={submitting}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="rl-summary">
          <div className="rl-renew-icon">🔄</div>
          <p>
            Renewing lease for <strong>{lease?.tenant_name}</strong> at{" "}
            <strong>{lease?.property_name}</strong>
          </p>

          {isHostel && lease?.room_number && (
            <p className="rl-room">
              Room: <strong>{lease.room_number}</strong>
              {lease?.room_type ? ` • ${lease.room_type}` : ""}
            </p>
          )}

          {isHostel && roomAvailabilityText && (
            <p className="rl-room-subtext">
              Current availability: <strong>{roomAvailabilityText}</strong>
            </p>
          )}

          <p className="rl-rent-preview">
            Current rent: <strong>GHS {formatMoney(lease?.monthly_rent)}</strong>
          </p>
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
                min="0"
                step="0.01"
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
                min="0"
                step="0.01"
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
          </div>

          <div className="rl-field rl-notes">
            <label>
              Notes <span className="rl-optional">(optional)</span>
            </label>
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