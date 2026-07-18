import { useEffect, useState } from "react";

import {
  createLeaseFromPayment,
  getAwaitingLeases,
} from "../UploadDetails/api/api";

import "./AwaitingLeasePage.css";


const AwaitingLeasePage = () => {
  // Stores payments that are waiting for lease creation.
  const [awaitingLeases, setAwaitingLeases] = useState([]);

  // Stores the payment currently selected for lease creation.
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Stores the landlord-controlled lease form values.
  const [formData, setFormData] = useState({
    lease_start_date: "",
    move_in_date: "",
    deposit_amount: "0",
    notes: "",
  });

  // Tracks page and form request states.
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Stores success and error messages.
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Extracts a readable message from different API error formats.
  const getErrorMessage = (apiError) => {
    if (typeof apiError === "string") {
      return apiError;
    }

    if (apiError?.detail) {
      return apiError.detail;
    }

    const firstError = Object.values(apiError || {})[0];

    if (Array.isArray(firstError)) {
      return firstError[0];
    }

    if (typeof firstError === "string") {
      return firstError;
    }

    return "Something went wrong. Please try again.";
  };

  // Loads successful payments waiting for lease creation.
  const loadAwaitingLeases = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getAwaitingLeases();

      setAwaitingLeases(
        Array.isArray(data)
          ? data
          : data?.results || []
      );
    } catch (apiError) {
      setError(getErrorMessage(apiError));
    } finally {
      setLoading(false);
    }
  };

  // Loads awaiting lease records when the page opens.
  useEffect(() => {
    loadAwaitingLeases();
  }, []);

  // Opens the secure lease form for the selected payment.
  const handleOpenLeaseForm = (payment) => {
    setSelectedPayment(payment);
    setError("");
    setSuccessMessage("");

    setFormData({
      lease_start_date: "",
      move_in_date: "",
      deposit_amount: "0",
      notes: "",
    });
  };

  // Closes and clears the lease form.
  const handleCloseLeaseForm = () => {
    setSelectedPayment(null);
    setError("");
    setSubmitting(false);
  };

  // Updates only the selected lease form field.
  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  };

  // Creates the lease from the server-verified payment.
  const handleCreateLease = async (event) => {
    event.preventDefault();

    if (!selectedPayment) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      await createLeaseFromPayment(
        selectedPayment.payment_id,
        {
          lease_start_date: formData.lease_start_date,
          move_in_date: formData.move_in_date,
          deposit_amount: formData.deposit_amount || "0",
          notes: formData.notes.trim(),
        }
      );

      setSuccessMessage(
        `Lease created successfully for ${selectedPayment.tenant_name}.`
      );

      setSelectedPayment(null);

      // Refreshes the page so the converted payment disappears.
      await loadAwaitingLeases();
    } catch (apiError) {
      setError(getErrorMessage(apiError));
    } finally {
      setSubmitting(false);
    }
  };

  // Formats API dates for readable display.
  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "Not available";
    }

    const parsedDate = new Date(dateValue);

    if (Number.isNaN(parsedDate.getTime())) {
      return dateValue;
    }

    return parsedDate.toLocaleDateString("en-GH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Displays the initial loading state.
  if (loading) {
    return (
      <main className="awaiting-lease-page">
        <div className="awaiting-lease-state">
          Loading payments awaiting lease creation...
        </div>
      </main>
    );
  }

  return (
    <main className="awaiting-lease-page">
      {/* Displays the page heading and workflow explanation. */}
      <header className="awaiting-lease-header">
        <div>
          <p className="awaiting-lease-eyebrow">
            Owner Dashboard
          </p>

          <h1>Awaiting Lease</h1>

          <p>
            These tenants have completed payment and their
            property or hostel space is reserved.
          </p>
        </div>

        <button
          type="button"
          className="awaiting-lease-refresh"
          onClick={loadAwaitingLeases}
        >
          Refresh
        </button>
      </header>

      {/* Displays API success and error feedback. */}
      {error && (
        <div className="awaiting-lease-alert awaiting-lease-error">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="awaiting-lease-alert awaiting-lease-success">
          {successMessage}
        </div>
      )}

      {/* Displays an empty state when no payment awaits a lease. */}
      {awaitingLeases.length === 0 ? (
        <section className="awaiting-lease-empty">
          <h2>No payments awaiting a lease</h2>

          <p>
            Successfully paid bookings will appear here before
            lease creation.
          </p>
        </section>
      ) : (
        <section className="awaiting-lease-grid">
          {awaitingLeases.map((payment) => (
            <article
              key={payment.payment_id}
              className="awaiting-lease-card"
            >
              {/* Displays the tenant and property summary. */}
              <div className="awaiting-lease-card-header">
                <div>
                  <span className="awaiting-lease-status">
                    Payment Completed
                  </span>

                  <h2>{payment.property_name}</h2>

                  <p>{payment.tenant_name}</p>
                </div>

                <span className="awaiting-lease-method">
                  {payment.payment_method === "paystack"
                    ? "UrbanHavens"
                    : "Direct Payment"}
                </span>
              </div>

              {/* Displays payment and reservation information. */}
              <dl className="awaiting-lease-details">
                <div>
                  <dt>Property type</dt>
                  <dd>
                    {payment.property_category === "hostel"
                      ? "Hostel"
                      : "House Rental"}
                  </dd>
                </div>

                {payment.property_category === "hostel" && (
                  <div>
                    <dt>Reserved room</dt>
                    <dd>
                      {payment.room_number || "Not available"}
                    </dd>
                  </div>
                )}

                <div>
                  <dt>Rental duration</dt>
                  <dd>
                    {payment.duration_months} months
                  </dd>
                </div>

                <div>
                  <dt>Monthly rent</dt>
                  <dd>
                    GHS {payment.monthly_rent}
                  </dd>
                </div>

                <div>
                  <dt>Amount paid</dt>
                  <dd>
                    GHS {payment.amount_paid}
                  </dd>
                </div>

                <div>
                  <dt>Payment date</dt>
                  <dd>
                    {formatDate(payment.payment_date)}
                  </dd>
                </div>

                <div>
                  <dt>Payment type</dt>
                  <dd>
                    {payment.payment_type
                      ?.replaceAll("_", " ")
                      || "Rent"}
                  </dd>
                </div>

                <div>
                  <dt>Tenant email</dt>
                  <dd>
                    {payment.tenant_email || "Not available"}
                  </dd>
                </div>
              </dl>

              {/* Opens the lease creation form for this payment. */}
              <button
                type="button"
                className="awaiting-lease-create-button"
                onClick={() => handleOpenLeaseForm(payment)}
              >
                Create Lease
              </button>
            </article>
          ))}
        </section>
      )}

      {/* Displays the secure lease creation form. */}
      {selectedPayment && (
        <div
          className="awaiting-lease-modal-backdrop"
          role="presentation"
          onMouseDown={handleCloseLeaseForm}
        >
          <section
            className="awaiting-lease-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lease-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="awaiting-lease-modal-header">
              <div>
                <p className="awaiting-lease-eyebrow">
                  Create Lease
                </p>

                <h2 id="create-lease-title">
                  {selectedPayment.property_name}
                </h2>

                <p>
                  Tenant: {selectedPayment.tenant_name}
                </p>
              </div>

              <button
                type="button"
                className="awaiting-lease-close-button"
                onClick={handleCloseLeaseForm}
                aria-label="Close lease form"
              >
                ×
              </button>
            </div>

            <form
              className="awaiting-lease-form"
              onSubmit={handleCreateLease}
            >
              {/* Collects the landlord-controlled lease dates. */}
              <div className="awaiting-lease-form-grid">
                <label>
                  Lease Start Date

                  <input
                    type="date"
                    name="lease_start_date"
                    value={formData.lease_start_date}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Move-in Date

                  <input
                    type="date"
                    name="move_in_date"
                    value={formData.move_in_date}
                    onChange={handleInputChange}
                    min={formData.lease_start_date || undefined}
                    required
                  />
                </label>
              </div>

              {/* Collects the confirmed deposit amount. */}
              <label>
                Deposit Amount

                <input
                  type="number"
                  name="deposit_amount"
                  value={formData.deposit_amount}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                />
              </label>

              {/* Collects optional lease notes from the landlord. */}
              <label>
                Notes

                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="4"
                  maxLength="2000"
                  placeholder="Add any relevant lease notes."
                />
              </label>

              <div className="awaiting-lease-form-summary">
                <p>
                  <strong>Duration:</strong>{" "}
                  {selectedPayment.duration_months} months
                </p>

                {selectedPayment.room_number && (
                  <p>
                    <strong>Room:</strong>{" "}
                    {selectedPayment.room_number}
                  </p>
                )}

                <p>
                  The lease end date will be calculated
                  automatically.
                </p>
              </div>

              {/* Submits or cancels the lease creation request. */}
              <div className="awaiting-lease-form-actions">
                <button
                  type="button"
                  className="awaiting-lease-cancel-button"
                  onClick={handleCloseLeaseForm}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="awaiting-lease-submit-button"
                  disabled={submitting}
                >
                  {submitting
                    ? "Creating Lease..."
                    : "Confirm and Create Lease"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
};

export default AwaitingLeasePage;