import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaHome,
  FaMoneyBillWave,
  FaRedoAlt,
  FaTimesCircle,
  FaUndoAlt,
  FaUser,
} from "react-icons/fa";

import { api } from "../../Owner/UploadDetails/api/api";
import "./Transactions.css";


const STATUS_META = {
  pending: {
    label: "Pending",
    className: "pending",
    icon: <FaClock />,
  },
  success: {
    label: "Successful",
    className: "success",
    icon: <FaCheckCircle />,
  },
  failed: {
    label: "Failed",
    className: "failed",
    icon: <FaTimesCircle />,
  },
  abandoned: {
    label: "Abandoned",
    className: "abandoned",
    icon: <FaTimesCircle />,
  },
  refunded: {
    label: "Refunded",
    className: "refunded",
    icon: <FaUndoAlt />,
  },
};


const Transactions = () => {
  // Handles navigation to the standalone receipt page.
  const navigate = useNavigate();

  // Stores transactions and page state.
  const [transactions, setTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");


  // Loads all payment transactions belonging to the tenant.
  const fetchTransactions = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/payments/tenant/transactions/"
        );

        const data = response.data;

        setTransactions(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
            ? data.results
            : []
        );
      } catch (requestError) {
        console.error(
          "Failed to load tenant transactions:",
          requestError?.response?.data ||
            requestError?.message ||
            requestError
        );

        setError(
          requestError?.response?.data?.detail ||
            "Failed to load your transactions."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );


  // Loads transactions when the page opens.
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);


  // Formats payment amounts consistently.
  const formatMoney = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });


  // Formats payment timestamps for display.
  const formatDateTime = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };


  // Filters transactions by the selected payment status.
  const filteredTransactions = useMemo(() => {
    if (activeFilter === "all") {
      return transactions;
    }

    return transactions.filter(
      (transaction) =>
        transaction.status === activeFilter
    );
  }, [transactions, activeFilter]);


  // Returns all successful transactions.
  const successfulTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.status === "success"
      ),
    [transactions]
  );


  // Returns all pending transactions.
  const pendingTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.status === "pending"
      ),
    [transactions]
  );


  // Returns failed and abandoned transactions.
  const failedTransactions = useMemo(
    () =>
      transactions.filter((transaction) =>
        ["failed", "abandoned"].includes(
          transaction.status
        )
      ),
    [transactions]
  );


  // Calculates the total amount received for successful payments.
  const totalPaid = useMemo(
    () =>
      successfulTransactions.reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.amount_received ||
              transaction.amount ||
              0
          ),
        0
      ),
    [successfulTransactions]
  );


  // Returns the correct label, icon, and class for a status.
  const getStatusMeta = (status) =>
    STATUS_META[status] || STATUS_META.pending;


  // Opens the protected receipt page for one payment.
  const handleViewReceipt = (paymentId) => {
    navigate(`/payments/${paymentId}/receipt`);
  };


  // Displays the initial loading state.
  if (loading) {
    return (
      <div className="tenant-transactions-page">
        <div className="tenant-transactions-loading">
          <div className="tenant-transactions-spinner" />

          <h3>Loading transactions...</h3>
        </div>
      </div>
    );
  }


  return (
    <div className="tenant-transactions-page">
      <div className="tenant-transactions-header">
        <div>
          <h1>Transactions</h1>

          <p>
            Review your rental payments made through
            UrbanHavens.
          </p>
        </div>

        <button
          type="button"
          className="tenant-transactions-refresh"
          onClick={() => fetchTransactions(true)}
          disabled={refreshing}
        >
          <FaRedoAlt
            className={refreshing ? "spinning" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="tenant-transactions-error">
          {error}
        </div>
      )}

      <div className="tenant-transactions-summary">
        <div className="tenant-transaction-summary-card">
          <div className="tenant-transaction-summary-icon">
            <FaMoneyBillWave />
          </div>

          <div>
            <span>Total Paid</span>

            <strong>
              GHS {formatMoney(totalPaid)}
            </strong>

            <small>
              {successfulTransactions.length} successful
              payment
              {successfulTransactions.length === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>

        <div className="tenant-transaction-summary-card">
          <div className="tenant-transaction-summary-icon pending">
            <FaClock />
          </div>

          <div>
            <span>Pending Payments</span>

            <strong>
              {pendingTransactions.length}
            </strong>

            <small>
              Awaiting payment confirmation
            </small>
          </div>
        </div>

        <div className="tenant-transaction-summary-card">
          <div className="tenant-transaction-summary-icon failed">
            <FaTimesCircle />
          </div>

          <div>
            <span>Failed Payments</span>

            <strong>
              {failedTransactions.length}
            </strong>

            <small>
              Failed or abandoned attempts
            </small>
          </div>
        </div>
      </div>

      <div className="tenant-transactions-filters">
        {[
          ["all", "All"],
          ["success", "Successful"],
          ["pending", "Pending"],
          ["failed", "Failed"],
          ["refunded", "Refunded"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={
              activeFilter === value ? "active" : ""
            }
            onClick={() => setActiveFilter(value)}
          >
            {label}

            <span>
              {value === "all"
                ? transactions.length
                : transactions.filter(
                    (transaction) =>
                      transaction.status === value
                  ).length}
            </span>
          </button>
        ))}
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="tenant-transactions-empty">
          <FaMoneyBillWave />

          <h3>No transactions found</h3>

          <p>
            Your rental payment records will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="tenant-transactions-table-wrapper">
            <table className="tenant-transactions-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Landlord</th>
                  <th>Rental Period</th>
                  <th>Payment Method</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map(
                  (transaction) => {
                    const meta = getStatusMeta(
                      transaction.status
                    );

                    return (
                      <tr key={transaction.id}>
                        <td>
                          <div className="tenant-transaction-property">
                            <div>
                              <FaHome />
                            </div>

                            <strong>
                              {transaction.property_name ||
                                "Unknown Property"}
                            </strong>
                          </div>
                        </td>

                        <td>
                          <div className="tenant-transaction-landlord">
                            <FaUser />

                            <span>
                              {transaction.landlord_name ||
                                "Property Owner"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {transaction.duration_months} months
                          </strong>
                        </td>

                        <td>
                          <span className="tenant-transaction-method">
                            {transaction.payment_method ===
                            "paystack"
                              ? "UrbanHavens / Paystack"
                              : "Paid Owner Directly"}
                          </span>
                        </td>

                        <td>
                          <strong className="tenant-transaction-amount">
                            GHS{" "}
                            {formatMoney(
                              transaction.amount_received ||
                                transaction.amount
                            )}
                          </strong>

                          {transaction.payment_completion_status ===
                            "part" && (
                            <small className="tenant-transaction-balance">
                              Balance: GHS{" "}
                              {formatMoney(
                                transaction.outstanding_balance
                              )}
                            </small>
                          )}
                        </td>

                        <td>
                          <small className="tenant-transaction-reference">
                            {transaction.reference}
                          </small>
                        </td>

                        <td>
                          <div className="tenant-transaction-date">
                            <FaCalendarAlt />

                            <span>
                              {formatDateTime(
                                transaction.verified_at ||
                                  transaction.created_at
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`tenant-transaction-status ${meta.className}`}
                          >
                            {meta.icon}
                            {meta.label}
                          </span>
                        </td>

                        <td>
                          {/* Shows a receipt only for generated successful payments. */}
                          {transaction.status ===
                            "success" &&
                          transaction.receipt_number ? (
                            <button
                              type="button"
                              className="tenant-transaction-receipt-btn"
                              onClick={() =>
                                handleViewReceipt(
                                  transaction.id
                                )
                              }
                            >
                              View Receipt
                            </button>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          <div className="tenant-transactions-mobile-list">
            {filteredTransactions.map(
              (transaction) => {
                const meta = getStatusMeta(
                  transaction.status
                );

                return (
                  <article
                    className="tenant-transaction-mobile-card"
                    key={transaction.id}
                  >
                    <div className="tenant-transaction-mobile-top">
                      <div>
                        <h3>
                          {transaction.property_name ||
                            "Unknown Property"}
                        </h3>

                        <p>
                          {transaction.duration_months} months
                        </p>
                      </div>

                      <span
                        className={`tenant-transaction-status ${meta.className}`}
                      >
                        {meta.icon}
                        {meta.label}
                      </span>
                    </div>

                    <div className="tenant-transaction-mobile-grid">
                      <div>
                        <span>Amount Received</span>

                        <strong>
                          GHS{" "}
                          {formatMoney(
                            transaction.amount_received ||
                              transaction.amount
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Payment Method</span>

                        <strong>
                          {transaction.payment_method ===
                          "paystack"
                            ? "Paystack"
                            : "Direct"}
                        </strong>
                      </div>

                      <div>
                        <span>Payment Date</span>

                        <strong>
                          {formatDateTime(
                            transaction.verified_at ||
                              transaction.created_at
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Booking</span>

                        <strong>
                          #{transaction.booking}
                        </strong>
                      </div>

                      {transaction.payment_completion_status && (
                        <div>
                          <span>Payment Status</span>

                          <strong>
                            {transaction
                              .payment_completion_status_display ||
                              transaction
                                .payment_completion_status}
                          </strong>
                        </div>
                      )}

                      {Number(
                        transaction.outstanding_balance || 0
                      ) > 0 && (
                        <div>
                          <span>Outstanding Balance</span>

                          <strong>
                            GHS{" "}
                            {formatMoney(
                              transaction.outstanding_balance
                            )}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div className="tenant-transaction-mobile-reference">
                      <span>Reference</span>

                      <small>
                        {transaction.reference}
                      </small>
                    </div>

                    {/* Opens the receipt without invalid table markup. */}
                    {transaction.status === "success" &&
                      transaction.receipt_number && (
                        <button
                          type="button"
                          className="tenant-transaction-receipt-btn"
                          onClick={() =>
                            handleViewReceipt(
                              transaction.id
                            )
                          }
                        >
                          View Receipt
                        </button>
                      )}
                  </article>
                );
              }
            )}
          </div>
        </>
      )}
    </div>
  );
};


export default Transactions;