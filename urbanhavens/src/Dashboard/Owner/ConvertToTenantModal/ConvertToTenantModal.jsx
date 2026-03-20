import React, { useState } from "react";
import "./ConvertToTenantModal.css";

const ConvertToTenantModal = ({ booking, onClose, onSubmit, submitting }) => {
  const [formData, setFormData] = useState({
    lease_start_date: "",
    lease_end_date: "",
    move_in_date: "",
    monthly_rent: booking?.property_price || booking?.price || "",
    deposit_amount: "",
    first_payment_status: "pending",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    setErrors((prev) => ({
      ...prev,
      [e.target.name]: "",
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.lease_start_date) {
      newErrors.lease_start_date = "Lease start date is required";
    }

    if (!formData.lease_end_date) {
      newErrors.lease_end_date = "Lease end date is required";
    }

    if (!formData.move_in_date) {
      newErrors.move_in_date = "Move-in date is required";
    }

    if (!formData.monthly_rent) {
      newErrors.monthly_rent = "Monthly rent is required";
    }

    if (!formData.deposit_amount) {
      newErrors.deposit_amount = "Deposit amount is required";
    }

    if (
      formData.lease_start_date &&
      formData.lease_end_date &&
      formData.lease_end_date < formData.lease_start_date
    ) {
      newErrors.lease_end_date = "Lease end date cannot be before lease start date";
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSubmit({
      booking: booking.id,
      property: booking.property,
      tenant: booking.tenant,
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
    <div className="convert-tenant-overlay" onClick={onClose}>
      <div
        className="convert-tenant-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="convert-tenant-header">
          <h2>Convert to Tenant</h2>
          <button
            className="convert-tenant-close-btn"
            onClick={onClose}
            disabled={submitting}
          >
            ✕
          </button>
        </div>

        <div className="convert-tenant-summary">
          <p><strong>Tenant:</strong> {booking?.tenant_name}</p>
          <p><strong>Property:</strong> {booking?.property_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="convert-tenant-form">
          <div className="convert-tenant-grid">
            <div className="convert-field">
              <label>Lease Start Date</label>
              <input
                type="date"
                name="lease_start_date"
                value={formData.lease_start_date}
                onChange={handleChange}
              />
              {errors.lease_start_date && <small>{errors.lease_start_date}</small>}
            </div>

            <div className="convert-field">
              <label>Lease End Date</label>
              <input
                type="date"
                name="lease_end_date"
                value={formData.lease_end_date}
                onChange={handleChange}
              />
              {errors.lease_end_date && <small>{errors.lease_end_date}</small>}
            </div>

            <div className="convert-field">
              <label>Move-in Date</label>
              <input
                type="date"
                name="move_in_date"
                value={formData.move_in_date}
                onChange={handleChange}
              />
              {errors.move_in_date && <small>{errors.move_in_date}</small>}
            </div>

            <div className="convert-field">
              <label>Monthly Rent</label>
              <input
                type="number"
                name="monthly_rent"
                value={formData.monthly_rent}
                onChange={handleChange}
                placeholder="Enter monthly rent"
              />
              {errors.monthly_rent && <small>{errors.monthly_rent}</small>}
            </div>

            <div className="convert-field">
              <label>Deposit Amount</label>
              <input
                type="number"
                name="deposit_amount"
                value={formData.deposit_amount}
                onChange={handleChange}
                placeholder="Enter deposit amount"
              />
              {errors.deposit_amount && <small>{errors.deposit_amount}</small>}
            </div>

            <div className="convert-field">
              <label>First Payment Status</label>
              <select
                name="first_payment_status"
                value={formData.first_payment_status}
                onChange={handleChange}
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="convert-field">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add extra notes"
            />
          </div>

          <div className="convert-tenant-actions">
            <button
              type="button"
              className="convert-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="convert-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Lease"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConvertToTenantModal;