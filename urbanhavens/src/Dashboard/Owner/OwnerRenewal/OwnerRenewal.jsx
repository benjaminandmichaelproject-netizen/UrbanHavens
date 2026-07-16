import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FaCalendarAlt,
  FaCheck,
  FaClock,
  FaFileContract,
  FaHome,
  FaMoneyBillWave,
  FaRedo,
  FaSyncAlt,
  FaTimes,
  FaUser,
} from "react-icons/fa";

import { api } from "../UploadDetails/api/api";
import "./OwnerRenewals.css";


const STATUS_META = {
  pending: {
    label: "Awaiting Approval",
    className: "pending",
  },
  payment_pending: {
    label: "Awaiting Payment",
    className: "payment-pending",
  },
  payment_completed: {
    label: "Payment Completed",
    className: "payment-completed",
  },
  approved: {
    label: "Renewal Completed",
    className: "approved",
  },
  rejected: {
    label: "Rejected",
    className: "rejected",
  },
  cancelled: {
    label: "Cancelled",
    className: "cancelled",
  },
};


// Formats dates for readable display.
const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};


// Formats currency values consistently.
const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });


const OwnerRenewals = () => {
  // Stores all renewal requests belonging to the owner.
  const [renewals, setRenewals] = useState([]);

  // Stores page loading and error states.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Stores the active status filter.
  const [statusFilter, setStatusFilter] =
    useState("all");

  // Tracks the renewal currently being processed.
  const [processingId, setProcessingId] =
    useState(null);

  // Stores the renewal selected for rejection.
  const [rejectingRenewal, setRejectingRenewal] =
    useState(null);

  // Stores the optional owner rejection reason.
  const [rejectionNote, setRejectionNote] =
    useState("");

  // Stores success and failure feedback.
  const [feedback, setFeedback] = useState(null);


  // Loads renewal requests belonging to the owner.
  const fetchRenewals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/leases/renewals/owner/"
      );

      const responseData = response.data;

      setRenewals(
        Array.isArray(responseData)
          ? responseData
          : responseData?.results || []
      );
    } catch (requestError) {
      console.error(
        "Failed to load renewal requests:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      setError(
        requestError?.response?.data?.detail ||
          "Failed to load lease renewal requests."
      );
    } finally {
      setLoading(false);
    }
  }, []);


  // Loads owner renewal requests when the page opens.
  useEffect(() => {
    fetchRenewals();
  }, [fetchRenewals]);


  // Calculates totals for each renewal status.
  const counts = useMemo(
    () => ({
      all: renewals.length,

      pending: renewals.filter(
        (renewal) =>
          renewal.status === "pending"
      ).length,

      paymentPending: renewals.filter(
        (renewal) =>
          renewal.status === "payment_pending"
      ).length,

      paymentCompleted: renewals.filter(
        (renewal) =>
          renewal.status === "payment_completed"
      ).length,

      completed: renewals.filter(
        (renewal) =>
          renewal.status === "approved"
      ).length,
    }),
    [renewals]
  );


  // Filters renewal requests by lifecycle status.
  const filteredRenewals = useMemo(() => {
    if (statusFilter === "all") {
      return renewals;
    }

    return renewals.filter(
      (renewal) =>
        renewal.status === statusFilter
    );
  }, [
    renewals,
    statusFilter,
  ]);


  // Approves a pending renewal request.
  const handleApprove = async (renewal) => {
    const confirmed = window.confirm(
      `Approve the ${renewal.requested_duration_months}-month renewal request for ${renewal.property_name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(renewal.id);
      setFeedback(null);

      const response = await api.post(
        `/leases/renewals/${renewal.id}/approve/`,
        {}
      );

      await fetchRenewals();

      setFeedback({
        type: "success",
        message:
          response.data?.detail ||
          "Renewal request approved successfully.",
      });
    } catch (requestError) {
      console.error(
        "Failed to approve renewal:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      setFeedback({
        type: "error",
        message:
          requestError?.response?.data?.detail ||
          "Failed to approve the renewal request.",
      });
    } finally {
      setProcessingId(null);
    }
  };


  // Opens the rejection form for one renewal request.
  const openRejectModal = (renewal) => {
    setRejectingRenewal(renewal);
    setRejectionNote("");
    setFeedback(null);
  };


  // Closes the rejection form safely.
  const closeRejectModal = () => {
    if (processingId) {
      return;
    }

    setRejectingRenewal(null);
    setRejectionNote("");
  };


  // Rejects the selected pending renewal request.
  const handleReject = async (event) => {
    event.preventDefault();

    if (!rejectingRenewal) {
      return;
    }

    try {
      setProcessingId(rejectingRenewal.id);
      setFeedback(null);

      const response = await api.post(
        `/leases/renewals/${rejectingRenewal.id}/reject/`,
        {
          note: rejectionNote.trim(),
        }
      );

      setRejectingRenewal(null);
      setRejectionNote("");

      await fetchRenewals();

      setFeedback({
        type: "success",
        message:
          response.data?.detail ||
          "Renewal request rejected successfully.",
      });
    } catch (requestError) {
      console.error(
        "Failed to reject renewal:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      setFeedback({
        type: "error",
        message:
          requestError?.response?.data?.detail ||
          "Failed to reject the renewal request.",
      });
    } finally {
      setProcessingId(null);
    }
  };


  // Creates the new lease after full renewal payment.
  const handleCompleteRenewal = async (
    renewal
  ) => {
    const confirmed = window.confirm(
      `Complete the renewal for ${renewal.property_name}?\n\nThis will end the current lease and generate a new lease and agreement.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(renewal.id);
      setFeedback(null);

      const response = await api.post(
        `/leases/renewals/${renewal.id}/complete/`,
        {}
      );

      await fetchRenewals();

      setFeedback({
        type: "success",
        message:
          response.data?.detail ||
          "Lease renewal completed successfully.",
      });
    } catch (requestError) {
      console.error(
        "Failed to complete renewal:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      setFeedback({
        type: "error",
        message:
          requestError?.response?.data?.detail ||
          "Failed to complete the lease renewal.",
      });
    } finally {
      setProcessingId(null);
    }
  };


  return (
    <main className="owner-renewals-page">
      {/* Displays the page heading and refresh action. */}
      <header className="owner-renewals-header">
        <div>
          <span className="owner-renewals-eyebrow">
            Lease Management
          </span>

          <h1>Renewal Requests</h1>

          <p>
            Review tenant renewal requests, monitor
            payment progress, and complete paid renewals.
          </p>
        </div>

        <button
          type="button"
          className="owner-renewals-refresh-btn"
          onClick={fetchRenewals}
          disabled={loading}
        >
          <FaSyncAlt
            className={
              loading
                ? "owner-renewals-spinning"
                : ""
            }
          />

          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* Displays renewal summary statistics. */}
      <section className="owner-renewals-summary">
        <article>
          <div className="owner-renewals-summary-icon">
            <FaRedo />
          </div>

          <div>
            <span>Total Requests</span>
            <strong>{counts.all}</strong>
          </div>
        </article>

        <article>
          <div className="owner-renewals-summary-icon pending">
            <FaClock />
          </div>

          <div>
            <span>Awaiting Approval</span>
            <strong>{counts.pending}</strong>
          </div>
        </article>

        <article>
          <div className="owner-renewals-summary-icon payment">
            <FaMoneyBillWave />
          </div>

          <div>
            <span>Awaiting Payment</span>
            <strong>
              {counts.paymentPending}
            </strong>
          </div>
        </article>

        <article>
          <div className="owner-renewals-summary-icon complete">
            <FaCheck />
          </div>

          <div>
            <span>Ready to Complete</span>
            <strong>
              {counts.paymentCompleted}
            </strong>
          </div>
        </article>
      </section>

      {/* Displays success or error feedback. */}
      {feedback && (
        <div
          className={`owner-renewals-feedback ${feedback.type}`}
        >
          <span>{feedback.message}</span>

          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Close message"
          >
            <FaTimes />
          </button>
        </div>
      )}

      {/* Displays renewal status filters. */}
      <section className="owner-renewals-filters">
        {[
          {
            value: "all",
            label: "All",
            count: counts.all,
          },
          {
            value: "pending",
            label: "Awaiting Approval",
            count: counts.pending,
          },
          {
            value: "payment_pending",
            label: "Awaiting Payment",
            count: counts.paymentPending,
          },
          {
            value: "payment_completed",
            label: "Ready to Complete",
            count: counts.paymentCompleted,
          },
          {
            value: "approved",
            label: "Completed",
            count: counts.completed,
          },
        ].map((filter) => (
          <button
            type="button"
            key={filter.value}
            className={
              statusFilter === filter.value
                ? "active"
                : ""
            }
            onClick={() =>
              setStatusFilter(filter.value)
            }
          >
            {filter.label}

            <span>{filter.count}</span>
          </button>
        ))}
      </section>

      {/* Displays the loading state. */}
      {loading && (
        <section className="owner-renewals-state">
          <div className="owner-renewals-loader" />

          <p>Loading renewal requests...</p>
        </section>
      )}

      {/* Displays the request failure state. */}
      {!loading && error && (
        <section className="owner-renewals-state error">
          <FaTimes />

          <h3>Could not load renewals</h3>

          <p>{error}</p>

          <button
            type="button"
            onClick={fetchRenewals}
          >
            Try Again
          </button>
        </section>
      )}

      {/* Displays an empty renewal state. */}
      {!loading &&
        !error &&
        filteredRenewals.length === 0 && (
          <section className="owner-renewals-state">
            <FaFileContract />

            <h3>No renewal requests found</h3>

            <p>
              Renewal requests will appear here when
              eligible tenants request another lease
              period.
            </p>
          </section>
        )}

      {/* Displays the complete renewal request table. */}
      {!loading &&
        !error &&
        filteredRenewals.length > 0 && (
          <section className="owner-renewals-table-wrapper">
            <table className="owner-renewals-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Current Lease</th>
                  <th>Renewal Period</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRenewals.map(
                  (renewal) => {
                    const statusMeta =
                      STATUS_META[
                        renewal.status
                      ] || {
                        label:
                          renewal.status ||
                          "Unknown",
                        className: "unknown",
                      };

                    const isProcessing =
                      processingId ===
                      renewal.id;

                    return (
                      <tr key={renewal.id}>
                        <td>
                          <div className="owner-renewals-property-cell">
                            <div>
                              <FaHome />
                            </div>

                            <span>
                              <strong>
                                {renewal.property_name}
                              </strong>

                              {renewal.room_number && (
                                <small>
                                  Room{" "}
                                  {
                                    renewal.room_number
                                  }
                                </small>
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="owner-renewals-tenant-cell">
                            <FaUser />

                            <span>
                              {
                                renewal.tenant_name
                              }
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="owner-renewals-date-stack">
                            <span>
                              <FaCalendarAlt />
                              {formatDate(
                               renewal.current_lease_start_date
                              )}
                            </span>

                            <span>
                              to{" "}
                              {formatDate(
                               renewal.current_lease_end_date
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="owner-renewals-duration">
                            <strong>
                              {
                                renewal.requested_duration_months
                              }{" "}
                              months
                            </strong>

                            <span>
                              {formatDate(
                                renewal.proposed_start_date
                              )}
                              {" – "}
                              {formatDate(
                                renewal.proposed_end_date
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="owner-renewals-money">
                            <strong>
                              GHS{" "}
                              {formatMoney(
                                renewal.expected_amount
                              )}
                            </strong>

                            <span>
                              GHS{" "}
                              {formatMoney(
                                renewal.monthly_rent
                              )}
                              /month
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`owner-renewals-status ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            renewal.created_at
                          )}
                        </td>

                        <td>
                          <div className="owner-renewals-actions">
                            {renewal.status ===
                              "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="owner-renewals-approve-btn"
                                  onClick={() =>
                                    handleApprove(
                                      renewal
                                    )
                                  }
                                  disabled={
                                    isProcessing
                                  }
                                >
                                  <FaCheck />
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  className="owner-renewals-reject-btn"
                                  onClick={() =>
                                    openRejectModal(
                                      renewal
                                    )
                                  }
                                  disabled={
                                    isProcessing
                                  }
                                >
                                  <FaTimes />
                                  Reject
                                </button>
                              </>
                            )}

                            {renewal.status ===
                              "payment_pending" && (
                              <span className="owner-renewals-waiting-text">
                                <FaClock />
                                Waiting for tenant
                                payment
                              </span>
                            )}

                            {renewal.status ===
                              "payment_completed" && (
                              <button
                                type="button"
                                className="owner-renewals-complete-btn"
                                onClick={() =>
                                  handleCompleteRenewal(
                                    renewal
                                  )
                                }
                                disabled={
                                  isProcessing
                                }
                              >
                                <FaFileContract />

                                {isProcessing
                                  ? "Completing..."
                                  : "Complete Renewal"}
                              </button>
                            )}

                            {[
                              "approved",
                              "rejected",
                              "cancelled",
                            ].includes(
                              renewal.status
                            ) && (
                              <span className="owner-renewals-finished-text">
                                {statusMeta.label}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </section>
        )}

      {/* Collects the owner's optional rejection reason. */}
      {rejectingRenewal && (
        <div
          className="owner-renewals-modal-overlay"
          onClick={closeRejectModal}
        >
          <form
            className="owner-renewals-modal"
            onSubmit={handleReject}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <header>
              <div>
                <h2>Reject Renewal Request</h2>

                <p>
                  {rejectingRenewal.property_name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeRejectModal}
                aria-label="Close rejection form"
              >
                <FaTimes />
              </button>
            </header>

            <label htmlFor="renewal-rejection-note">
              Reason for rejection
            </label>

            <textarea
              id="renewal-rejection-note"
              value={rejectionNote}
              onChange={(event) =>
                setRejectionNote(
                  event.target.value
                )
              }
              maxLength={2000}
              rows={5}
              placeholder="Optional: explain why the renewal cannot be approved."
            />

            <small>
              {rejectionNote.length}/2000
            </small>

            <footer>
              <button
                type="button"
                className="owner-renewals-modal-cancel"
                onClick={closeRejectModal}
                disabled={Boolean(processingId)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="owner-renewals-modal-reject"
                disabled={Boolean(processingId)}
              >
                {processingId
                  ? "Rejecting..."
                  : "Reject Renewal"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
};


export default OwnerRenewals;