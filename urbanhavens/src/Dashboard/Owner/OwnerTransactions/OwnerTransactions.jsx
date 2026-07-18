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
  FaSearch,
  FaTimesCircle,
  FaUndoAlt,
  FaUser,
} from "react-icons/fa";

import {
  getOwnerTransactions,
} from "../UploadDetails/api/api";
import "./OwnerTransactions.css";


const STATUS_META = {
  success: {
    label: "Successful",
    className: "success",
    icon: <FaCheckCircle />,
  },
  pending: {
    label: "Pending",
    className: "pending",
    icon: <FaClock />,
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


const COMPLETION_META = {
  full: {
    label: "Full Payment",
    className: "full",
  },
  part: {
    label: "Part Payment",
    className: "part",
  },
  overpaid: {
    label: "Overpaid",
    className: "overpaid",
  },
  unpaid: {
    label: "Unpaid",
    className: "unpaid",
  },
};


const OwnerTransactions = () => {
  // Navigates to the protected receipt page.
  const navigate = useNavigate();

  // Stores owner transactions and request state.
  const [transactions, setTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] =
    useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");


  // Loads all owner payment transactions.
  const fetchTransactions = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");
const data = await getOwnerTransactions();

       

        setTransactions(
          Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
            ? data.results
            : []
        );
      } catch (requestError) {
        console.error(
          "Failed to load owner transactions:",
          requestError?.response?.data ||
            requestError?.message ||
            requestError
        );

        setError(
          requestError?.response?.data?.detail ||
            "Failed to load owner transactions."
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


  // Formats money values consistently.
  const formatMoney = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });


  // Formats payment dates for display.
  const formatDateTime = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("en-GH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };


  // Returns the safest confirmed amount.
  const getAmountReceived = (transaction) => {
    const received = Number(
      transaction.amount_received || 0
    );

    return received > 0
      ? received
      : Number(transaction.amount || 0);
  };


  // Returns the stored expected amount or falls back safely.
  const getExpectedAmount = (transaction) => {
    const expected = Number(
      transaction.expected_amount || 0
    );

    return expected > 0
      ? expected
      : Number(transaction.amount || 0);
  };


  // Resolves payment classification for older records.
  const getResolvedCompletionStatus = (transaction) => {
    const storedStatus =
      transaction.payment_completion_status;

    if (
      storedStatus &&
      storedStatus !== "unpaid"
    ) {
      return storedStatus;
    }

    if (transaction.status !== "success") {
      return "unpaid";
    }

    const expected = getExpectedAmount(transaction);
    const received = getAmountReceived(transaction);

    if (received < expected) {
      return "part";
    }

    if (received === expected) {
      return "full";
    }

    return "overpaid";
  };


  // Filters transactions by status, method, and search text.
  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesStatus =
        activeFilter === "all" ||
        transaction.status === activeFilter;

      const matchesMethod =
        paymentMethodFilter === "all" ||
        transaction.payment_method === paymentMethodFilter;

      const searchableText = [
        transaction.property_name,
        transaction.tenant_name,
        transaction.reference,
        transaction.receipt_number,
        transaction.room_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedSearch === "" ||
        searchableText.includes(normalizedSearch);

      return (
        matchesStatus &&
        matchesMethod &&
        matchesSearch
      );
    });
  }, [
    transactions,
    activeFilter,
    paymentMethodFilter,
    search,
  ]);


  // Returns successful transactions.
  const successfulTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.status === "success"
      ),
    [transactions]
  );


  // Returns direct payments.
  const directTransactions = useMemo(
    () =>
      successfulTransactions.filter(
        (transaction) =>
          transaction.payment_method === "direct"
      ),
    [successfulTransactions]
  );


  // Returns Paystack payments.
  const paystackTransactions = useMemo(
    () =>
      successfulTransactions.filter(
        (transaction) =>
          transaction.payment_method === "paystack"
      ),
    [successfulTransactions]
  );


  // Calculates total confirmed money received.
  const totalReceived = useMemo(
    () =>
      successfulTransactions.reduce(
        (total, transaction) =>
          total + getAmountReceived(transaction),
        0
      ),
    [successfulTransactions]
  );


  // Calculates total outstanding balance.
  const totalOutstanding = useMemo(
    () =>
      successfulTransactions.reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.outstanding_balance || 0
          ),
        0
      ),
    [successfulTransactions]
  );


  // Returns readable transaction status metadata.
  const getStatusMeta = (status) =>
    STATUS_META[status] || STATUS_META.pending;


  // Returns readable payment completion metadata.
  const getCompletionMeta = (completionStatus) =>
    COMPLETION_META[completionStatus] ||
    COMPLETION_META.unpaid;


  // Opens the receipt for one payment.
  const handleViewReceipt = (paymentId) => {
    navigate(`/payments/${paymentId}/receipt`);
  };


  if (loading) {
    return (
      <div className="owner-transactions-page">
        <div className="owner-transactions-loading">
          <div className="owner-transactions-spinner" />
          <h3>Loading transactions...</h3>
        </div>
      </div>
    );
  }


  return (
    <div className="owner-transactions-page">
      <div className="owner-transactions-header">
        <div>
          <h1>Transactions</h1>
          <p>
            Review all Paystack and direct rental payments,
            balances, and official receipts.
          </p>
        </div>

        <button
          type="button"
          className="owner-transactions-refresh"
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
        <div className="owner-transactions-error">
          {error}
        </div>
      )}

      <div className="owner-transactions-summary">
        <div className="owner-transaction-summary-card">
          <div className="owner-transaction-summary-icon">
            <FaMoneyBillWave />
          </div>
          <div>
            <span>Total Received</span>
            <strong>GHS {formatMoney(totalReceived)}</strong>
            <small>
              {successfulTransactions.length} successful
              payment
              {successfulTransactions.length === 1 ? "" : "s"}
            </small>
          </div>
        </div>

        <div className="owner-transaction-summary-card">
          <div className="owner-transaction-summary-icon paystack">
            <FaCheckCircle />
          </div>
          <div>
            <span>Paystack Payments</span>
            <strong>{paystackTransactions.length}</strong>
            <small>Paid through UrbanHavens</small>
          </div>
        </div>

        <div className="owner-transaction-summary-card">
          <div className="owner-transaction-summary-icon direct">
            <FaUser />
          </div>
          <div>
            <span>Direct Payments</span>
            <strong>{directTransactions.length}</strong>
            <small>Confirmed by property owner</small>
          </div>
        </div>

        <div className="owner-transaction-summary-card">
          <div className="owner-transaction-summary-icon balance">
            <FaClock />
          </div>
          <div>
            <span>Outstanding Balance</span>
            <strong>
              GHS {formatMoney(totalOutstanding)}
            </strong>
            <small>Remaining across part payments</small>
          </div>
        </div>
      </div>

      <div className="owner-transactions-toolbar">
        <div className="owner-transactions-search">
          <FaSearch />
          <input
            type="text"
            value={search}
            placeholder="Search property, tenant, reference or receipt..."
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <select
          value={paymentMethodFilter}
          onChange={(event) =>
            setPaymentMethodFilter(event.target.value)
          }
        >
          <option value="all">All Payment Methods</option>
          <option value="paystack">Paystack</option>
          <option value="direct">Direct / On-site</option>
        </select>
      </div>

      <div className="owner-transactions-filters">
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
        <div className="owner-transactions-empty">
          <FaMoneyBillWave />
          <h3>No transactions found</h3>
          <p>
            Owner payment records matching your filters
            will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="owner-transactions-table-wrapper">
            <table className="owner-transactions-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Method</th>
                  <th>Duration</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Balance</th>
                  <th>Payment Status</th>
                  <th>Date</th>
                  <th>Receipt</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map(
                  (transaction) => {
                    const statusMeta = getStatusMeta(
                      transaction.status
                    );

                    const completionMeta =
                      getCompletionMeta(
                        getResolvedCompletionStatus(
                          transaction
                        )
                      );

                    return (
                      <tr key={transaction.id}>
                        <td>
                          <div className="owner-transaction-property">
                            <div>
                              <FaHome />
                            </div>
                            <span>
                              <strong>
                                {transaction.property_name ||
                                  "Unknown Property"}
                              </strong>
                              <small>
                                {transaction.room_number
                                  ? `Room ${transaction.room_number}`
                                  : `Booking #${transaction.booking}`}
                              </small>
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="owner-transaction-tenant">
                            <FaUser />
                            <span>
                              {transaction.tenant_name ||
                                "Unknown Tenant"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`owner-transaction-method ${transaction.payment_method}`}
                          >
                            {transaction.payment_method ===
                            "paystack"
                              ? "Paystack"
                              : "Direct"}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {transaction.duration_months} months
                          </strong>
                        </td>

                        <td>
                          <strong>
                            GHS{" "}
                            {formatMoney(
                              getExpectedAmount(transaction)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong className="owner-transaction-amount">
                            GHS{" "}
                            {formatMoney(
                              getAmountReceived(transaction)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong
                            className={
                              Number(
                                transaction.outstanding_balance ||
                                  0
                              ) > 0
                                ? "owner-transaction-balance-due"
                                : ""
                            }
                          >
                            GHS{" "}
                            {formatMoney(
                              transaction.outstanding_balance
                            )}
                          </strong>
                        </td>

                        <td>
                          <div className="owner-transaction-status-stack">
                            <span
                              className={`owner-transaction-status ${statusMeta.className}`}
                            >
                              {statusMeta.icon}
                              {statusMeta.label}
                            </span>

                            {transaction.status ===
                              "success" && (
                              <span
                                className={`owner-transaction-completion ${completionMeta.className}`}
                              >
                                {completionMeta.label}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="owner-transaction-date">
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
                          {transaction.status === "success" &&
                          transaction.receipt_number ? (
                            <button
                              type="button"
                              className="owner-transaction-receipt-btn"
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

          <div className="owner-transactions-mobile-list">
            {filteredTransactions.map(
              (transaction) => {
                const statusMeta = getStatusMeta(
                  transaction.status
                );

                const completionMeta =
                  getCompletionMeta(
                    transaction
                      .payment_completion_status
                  );

                return (
                  <article
                    className="owner-transaction-mobile-card"
                    key={transaction.id}
                  >
                    <div className="owner-transaction-mobile-top">
                      <div>
                        <h3>
                          {transaction.property_name ||
                            "Unknown Property"}
                        </h3>
                        <p>
                          {transaction.tenant_name ||
                            "Unknown Tenant"}
                        </p>
                      </div>

                      <span
                        className={`owner-transaction-status ${statusMeta.className}`}
                      >
                        {statusMeta.icon}
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="owner-transaction-mobile-grid">
                      <div>
                        <span>Payment Method</span>
                        <strong>
                          {transaction.payment_method ===
                          "paystack"
                            ? "Paystack"
                            : "Direct / On-site"}
                        </strong>
                      </div>

                      <div>
                        <span>Duration</span>
                        <strong>
                          {transaction.duration_months} months
                        </strong>
                      </div>

                      <div>
                        <span>Expected Amount</span>
                        <strong>
                          GHS{" "}
                          {formatMoney(
                            getExpectedAmount(transaction)
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Amount Received</span>
                        <strong>
                          GHS{" "}
                          {formatMoney(
                            getAmountReceived(transaction)
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Outstanding Balance</span>
                        <strong>
                          GHS{" "}
                          {formatMoney(
                            transaction.outstanding_balance
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Payment Classification</span>
                        <strong
                          className={`owner-transaction-completion ${completionMeta.className}`}
                        >
                          {completionMeta.label}
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
                        <span>Reference</span>
                        <strong className="owner-transaction-mobile-reference">
                          {transaction.reference}
                        </strong>
                      </div>
                    </div>

                    {transaction.status === "success" &&
                      transaction.receipt_number && (
                        <button
                          type="button"
                          className="owner-transaction-receipt-btn"
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


export default OwnerTransactions;