import React, { useMemo, useState } from "react";
import "./DirectPaymentLeaseModal.css";

const formatMoney = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const addMonthsToDate = (dateValue, months) => {
  if (!dateValue || !months) return "";

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + Number(months));

  if (date.getDate() !== originalDay) {
    date.setDate(0);
  }

  return date.toISOString().slice(0, 10);
};

const DirectPaymentLeaseModal = ({
  payment,
  onClose,
  onSubmit,
  submitting = false,
}) => {
  const [formData, setFormData] = useState({
    lease_start_date: "",
    move_in_date: "",
    deposit_amount: "0.00",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  const durationMonths = Number(payment?.duration_months || 0);
  const totalPaid = Number(payment?.amount || 0);

  const monthlyRent = useMemo(() => {
    if (!durationMonths) return 0;
    return totalPaid / durationMonths;
  }, [durationMonths, totalPaid]);

  const leaseEndDate = useMemo(
    () => addMonthsToDate(formData.lease_start_date, durationMonths),
    [formData.lease_start_date, durationMonths]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!formData.lease_start_date) {
      nextErrors.lease_start_date = "Lease start date is required.";
    }

    if (!formData.move_in_date) {
      nextErrors.move_in_date = "Move-in date is required.";
    }

    if (
      formData.lease_start_date &&
      formData.move_in_date &&
      formData.move_in_date < formData.lease_start_date
    ) {
      nextErrors.move_in_date =
        "Move-in date cannot be earlier than the lease start date.";
    }

    if (
      formData.deposit_amount === "" ||
      Number(formData.deposit_amount) < 0
    ) {
      nextErrors.deposit_amount =
        "Deposit amount cannot be negative.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!payment?.id || !validate()) return;

    onSubmit({
      payment_id: payment.id,
      lease_start_date: formData.lease_start_date,
      move_in_date: formData.move_in_date,
      deposit_amount: formData.deposit_amount || "0.00",
      notes: formData.notes.trim(),
    });
  };

  if (!payment) return null;

  return (
    <div
      className="direct-payment-lease-overlay"
      onClick={onClose}
    >
      <div
        className="direct-payment-lease-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="direct-payment-lease-header">
          <div>
            <h2>Confirm Direct Payment</h2>
            <p>
              Confirm that payment was received and create the tenant lease.
            </p>
          </div>

          <button
            type="button"
            className="direct-payment-lease-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="direct-payment-summary">
          <div>
            <span>Tenant</span>
            <strong>{payment.tenant_name || "Unknown Tenant"}</strong>
          </div>

          <div>
            <span>Property</span>
            <strong>{payment.property_name || "Unknown Property"}</strong>
          </div>

          <div>
            <span>Payment Method</span>
            <strong>On-site / Direct Payment</strong>
          </div>

          <div>
            <span>Rental Duration</span>
            <strong>{durationMonths} months</strong>
          </div>

          <div>
            <span>Monthly Rent</span>
            <strong>GHS {formatMoney(monthlyRent)}</strong>
          </div>

          <div>
            <span>Total Amount</span>
            <strong>GHS {formatMoney(totalPaid)}</strong>
          </div>
        </div>

        <form
          className="direct-payment-lease-form"
          onSubmit={handleSubmit}
        >
          <div className="direct-payment-lease-grid">
            <div className="direct-payment-field">
              <label htmlFor="lease_start_date">Lease Start Date</label>
              <input
                id="lease_start_date"
                type="date"
                name="lease_start_date"
                value={formData.lease_start_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.lease_start_date && (
                <small>{errors.lease_start_date}</small>
              )}
            </div>

            <div className="direct-payment-field">
              <label htmlFor="move_in_date">Move-in Date</label>
              <input
                id="move_in_date"
                type="date"
                name="move_in_date"
                value={formData.move_in_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.move_in_date && (
                <small>{errors.move_in_date}</small>
              )}
            </div>

            <div className="direct-payment-field">
              <label>Lease End Date</label>
              <input
                type="date"
                value={leaseEndDate}
                readOnly
                disabled
              />
              <small className="direct-payment-hint">
                Calculated automatically from the rental duration.
              </small>
            </div>

            <div className="direct-payment-field">
              <label htmlFor="deposit_amount">Deposit Amount</label>
              <input
                id="deposit_amount"
                type="number"
                name="deposit_amount"
                value={formData.deposit_amount}
                onChange={handleChange}
                min="0"
                step="0.01"
                disabled={submitting}
              />
              {errors.deposit_amount && (
                <small>{errors.deposit_amount}</small>
              )}
            </div>
          </div>

          <div className="direct-payment-field">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any lease or payment notes"
              disabled={submitting}
            />
          </div>

          <div className="direct-payment-warning">
            Only confirm after you have actually received the tenant&apos;s payment.
          </div>

          <div className="direct-payment-lease-actions">
            <button
              type="button"
              className="direct-payment-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="direct-payment-confirm-btn"
              disabled={submitting}
            >
              {submitting
                ? "Confirming..."
                : "Confirm Payment & Create Lease"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DirectPaymentLeaseModal;