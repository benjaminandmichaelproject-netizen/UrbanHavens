import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaHome,
  FaMoneyBillWave,
  FaSyncAlt,
  FaTimesCircle,
  FaUser,
} from "react-icons/fa";
import { api } from "../UploadDetails/api/api";
import "./OnsitePayments.css";
const OnsitePayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const fetchPayments = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/payments/owner/onsite-payments/"
        );

        const data = response.data;

        setPayments(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
            ? data.results
            : []
        );
      } catch (requestError) {
        console.error(
          "Failed to load on-site payments:",
          requestError?.response?.data ||
            requestError?.message ||
            requestError
        );

        setError(
          requestError?.response?.data?.detail ||
            "Failed to load on-site payments."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const formatMoney = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const totalPendingAmount = useMemo(() => {
    return payments.reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    );
  }, [payments]);

  // Confirms payment without creating a lease.
// Confirms the payment using the amount actually received.
const handleConfirmPayment = async (payment) => {
  const enteredAmount = window.prompt(
    `Expected payment: GHS ${formatMoney(payment.amount)}\n\nEnter the amount you actually received:`,
    payment.amount
  );

  // Stops if the owner cancels the prompt.
  if (enteredAmount === null) {
    return;
  }

  const amountReceived = Number(enteredAmount);

  if (
    Number.isNaN(amountReceived) ||
    amountReceived <= 0
  ) {
    alert("Please enter a valid amount.");

    return;
  }

  const confirmationNote =
    window.prompt(
      "Confirmation note (optional):",
      ""
    ) || "";

  const confirmed = window.confirm(
    `Confirm that you received GHS ${formatMoney(
      amountReceived
    )} from ${
      payment.tenant_name || "this tenant"
    }?\n\nThe property will move to Awaiting Lease.`
  );

  if (!confirmed) {
    return;
  }

  try {
    setConfirmingId(payment.id);

    // Uses the correct confirmation endpoint depending on the payment type.
const confirmationUrl =
  payment.payment_type === "renewal"
    ? `/payments/renewals/direct/${payment.id}/confirm/`
    : `/payments/owner/onsite-payments/${payment.id}/confirm/`;

const response = await api.post(
  confirmationUrl,
  {
    amount_received: amountReceived,
    confirmation_note: confirmationNote,
  }
);

    await fetchPayments();

    alert(
      response.data?.detail ||
        "Payment confirmed successfully."
    );
  } catch (requestError) {
    console.error(
      "Failed to confirm direct payment:",
      requestError?.response?.data ||
        requestError?.message ||
        requestError
    );

    const errors =
      requestError?.response?.data;

    if (
      errors?.amount_received &&
      Array.isArray(errors.amount_received)
    ) {
      alert(errors.amount_received[0]);
    } else {
      alert(
        errors?.detail ||
          "Failed to confirm payment."
      );
    }
  } finally {
    setConfirmingId(null);
  }
};
  const handleRejectPayment = async (payment) => {
    const confirmed = window.confirm(
      `Reject the direct payment for ${payment.property_name}?`
    );

    if (!confirmed) return;

    try {
      setRejectingId(payment.id);
// Uses the correct rejection endpoint depending on the payment type.
const rejectionUrl =
  payment.payment_type === "renewal"
    ? `/payments/renewals/direct/${payment.id}/reject/`
    : `/payments/owner/onsite-payments/${payment.id}/reject/`;

await api.post(rejectionUrl);

      await fetchPayments();

      alert(
        "The direct payment request has been rejected."
      );
    } catch (requestError) {
      console.error(
        "Failed to reject payment:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      alert(
        requestError?.response?.data?.detail ||
          "Failed to reject this payment."
      );
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) {
    return (
      <div className="onsite-payment-page">
        <div className="onsite-payment-loading">
          <div className="onsite-payment-spinner" />

          <h3>Loading on-site payments...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="onsite-payment-page">
      <div className="onsite-payment-header">
        <div>
          <h1>On-site Payments</h1>

          <p>
            Confirm payments made directly through cash,
            Mobile Money or bank transfer. Confirmed payments
            move to Awaiting Lease.
          </p>
        </div>

        <button
          type="button"
          className="onsite-payment-refresh"
          onClick={() => fetchPayments(true)}
          disabled={refreshing}
        >
          <FaSyncAlt
            className={refreshing ? "spinning" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="onsite-payment-error">
          {error}
        </div>
      )}

      <div className="onsite-payment-summary">
        <div className="onsite-payment-summary-card">
          <div className="onsite-payment-summary-icon">
            <FaClock />
          </div>

          <div>
            <span>Awaiting Confirmation</span>

            <strong>{payments.length}</strong>

            <small>Direct payment requests</small>
          </div>
        </div>

        <div className="onsite-payment-summary-card">
          <div className="onsite-payment-summary-icon amount">
            <FaMoneyBillWave />
          </div>

          <div>
            <span>Total Pending Amount</span>

            <strong>
              GHS {formatMoney(totalPendingAmount)}
            </strong>

            <small>
              Confirm only after receiving payment
            </small>
          </div>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="onsite-payment-empty">
          <FaCheckCircle />

          <h3>No payments awaiting confirmation</h3>

          <p>
            Direct payments selected by tenants will appear
            here.
          </p>
        </div>
      ) : (
        <>
          <div className="onsite-payment-table-wrapper">
            <table className="onsite-payment-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Duration</th>
                  <th>Amount</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <div className="onsite-payment-property">
                        <div>
                          <FaHome />
                        </div>

                        <span>
                          <strong>
                            {payment.property_name ||
                              "Unknown Property"}
                          </strong>

                          <small>
                            Booking #{payment.booking}
                          </small>
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="onsite-payment-tenant">
                        <FaUser />

                        <span>
                          {payment.tenant_name ||
                            "Unknown Tenant"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <strong>
                        {payment.duration_months} months
                      </strong>
                    </td>

                    <td>
                      <strong className="onsite-payment-amount">
                        GHS {formatMoney(payment.amount)}
                      </strong>
                    </td>

                    <td>
                      <div className="onsite-payment-date">
                        <FaCalendarAlt />

                        {formatDate(payment.created_at)}
                      </div>
                    </td>

                    <td>
                      <span className="onsite-payment-status">
                        <FaClock />
                        Awaiting Confirmation
                      </span>
                    </td>

                    <td>
                      <div className="onsite-payment-actions">
                        <button
                          type="button"
                          className="onsite-confirm-btn"
                          onClick={() =>
                            handleConfirmPayment(payment)
                          }
                          disabled={
                            confirmingId === payment.id ||
                            rejectingId === payment.id
                          }
                        >
                          <FaCheckCircle />
                          {confirmingId === payment.id
                            ? "Confirming..."
                            : "Confirm Payment"}
                        </button>

                        <button
                          type="button"
                          className="onsite-reject-btn"
                          onClick={() =>
                            handleRejectPayment(payment)
                          }
                          disabled={
                            confirmingId === payment.id ||
                            rejectingId === payment.id
                          }
                        >
                          <FaTimesCircle />
                          {rejectingId === payment.id
                            ? "Rejecting..."
                            : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="onsite-payment-mobile-list">
            {payments.map((payment) => (
              <article
                className="onsite-payment-mobile-card"
                key={payment.id}
              >
                <div className="onsite-payment-mobile-top">
                  <div>
                    <h3>{payment.property_name}</h3>

                    <p>{payment.tenant_name}</p>
                  </div>

                  <span className="onsite-payment-status">
                    <FaClock />
                    Pending
                  </span>
                </div>

                <div className="onsite-payment-mobile-grid">
                  <div>
                    <span>Amount</span>

                    <strong>
                      GHS {formatMoney(payment.amount)}
                    </strong>
                  </div>

                  <div>
                    <span>Duration</span>

                    <strong>
                      {payment.duration_months} months
                    </strong>
                  </div>

                  <div>
                    <span>Booking</span>

                    <strong>#{payment.booking}</strong>
                  </div>

                  <div>
                    <span>Requested</span>

                    <strong>
                      {formatDate(payment.created_at)}
                    </strong>
                  </div>
                </div>

                <div className="onsite-payment-mobile-actions">
                  <button
                    type="button"
                    className="onsite-confirm-btn"
                    onClick={() =>
                      handleConfirmPayment(payment)
                    }
                    disabled={
                      confirmingId === payment.id ||
                      rejectingId === payment.id
                    }
                  >
                    <FaCheckCircle />
                    {confirmingId === payment.id
                      ? "Confirming..."
                      : "Confirm Payment"}
                  </button>

                  <button
                    type="button"
                    className="onsite-reject-btn"
                    onClick={() =>
                      handleRejectPayment(payment)
                    }
                    disabled={
                      confirmingId === payment.id ||
                      rejectingId === payment.id
                    }
                  >
                    <FaTimesCircle />
                    {rejectingId === payment.id
                      ? "Rejecting..."
                      : "Reject"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}


    </div>
  );
};

export default OnsitePayments;