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
  FaUser,
} from "react-icons/fa";

import { api } from "../UploadDetails/api/api";
import "./Payment.css";


const Payment = () => {
  // Stores owner payment records and page state.
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Tracks the payment currently being synchronized.
  const [syncingPaymentId, setSyncingPaymentId] =
    useState(null);


  // Loads successful Paystack payments for the owner.
  const fetchPayments = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          "/payments/owner/payments/"
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
          "Failed to load owner payments:",
          requestError?.response?.data ||
            requestError?.message ||
            requestError
        );

        setError(
          requestError?.response?.data?.detail ||
            "Failed to load your payment records."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );


  // Loads owner payments when the page opens.
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);


  // Synchronizes one pending settlement with Paystack.
  const handleSyncSettlement = async (paymentId) => {
    if (syncingPaymentId) {
      return;
    }

    try {
      setSyncingPaymentId(paymentId);
      setError("");

      const response = await api.post(
        `/payments/owner/payments/${paymentId}/sync-settlement/`
      );

      await fetchPayments();

      alert(
        response.data?.detail ||
          "Settlement synchronization completed."
      );
    } catch (requestError) {
      console.error(
        "Settlement synchronization failed:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      alert(
        requestError?.response?.data?.detail ||
          "Failed to synchronize settlement."
      );
    } finally {
      setSyncingPaymentId(null);
    }
  };


  // Formats payment values consistently.
  const formatMoney = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });


  // Formats dates without time.
  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

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


  // Formats dates with time.
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


  // Returns payments awaiting Paystack settlement.
  const pendingPayments = useMemo(() => {
    return payments.filter((payment) =>
      ["pending", "processing"].includes(
        payment.settlement_status
      )
    );
  }, [payments]);


  // Returns payments already settled to the owner.
  const paidPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.settlement_status === "paid"
    );
  }, [payments]);


  // Returns failed settlement records.
  const failedPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.settlement_status === "failed"
    );
  }, [payments]);


  // Selects payments for the active settlement tab.
  const displayedPayments =
    activeTab === "pending"
      ? pendingPayments
      : activeTab === "paid"
      ? paidPayments
      : failedPayments;


  // Calculates all successful tenant payments.
  const totalReceived = useMemo(() => {
    return payments.reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    );
  }, [payments]);


  // Calculates the amount still awaiting settlement.
  const pendingSettlementAmount = useMemo(() => {
    return pendingPayments.reduce(
      (total, payment) =>
        total +
        Number(payment.owner_net_amount || 0),
      0
    );
  }, [pendingPayments]);


  // Calculates the amount already paid to the owner.
  const paidSettlementAmount = useMemo(() => {
    return paidPayments.reduce(
      (total, payment) =>
        total +
        Number(payment.owner_net_amount || 0),
      0
    );
  }, [paidPayments]);


  // Returns a readable settlement label.
  const getSettlementLabel = (
    settlementStatus
  ) => {
    const labels = {
      pending: "Awaiting Settlement",
      processing: "Settlement Processing",
      paid: "Paid to Owner",
      failed: "Settlement Failed",
    };

    return (
      labels[settlementStatus] ||
      settlementStatus ||
      "Unknown"
    );
  };


  // Displays the correct empty state for each tab.
  const renderEmptyState = () => {
    const messages = {
      pending: {
        title: "No pending settlements",
        message:
          "Payments waiting for Paystack settlement will appear here.",
      },
      paid: {
        title: "No completed settlements",
        message:
          "Payments already sent to your registered account will appear here.",
      },
      failed: {
        title: "No failed settlements",
        message:
          "Any settlement requiring attention will appear here.",
      },
    };

    const current = messages[activeTab];

    return (
      <div className="owner-payment-empty">
        <FaMoneyBillWave />

        <h3>{current.title}</h3>

        <p>{current.message}</p>
      </div>
    );
  };


  // Displays the initial loading state.
  if (loading) {
    return (
      <div className="owner-payment-page">
        <div className="owner-payment-loading">
          <div className="owner-payment-spinner" />

          <h3>Loading payments...</h3>
        </div>
      </div>
    );
  }


  return (
    <div className="owner-payment-page">
      <div className="owner-payment-header">
        <div>
          <h1>Payments</h1>

          <p>
            Track tenant rent payments and Paystack
            settlements sent to your registered payment
            account.
          </p>
        </div>

        <button
          type="button"
          className="owner-payment-refresh-btn"
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
        <div className="owner-payment-error">
          {error}
        </div>
      )}

      <div className="owner-payment-summary-grid">
        <div className="owner-payment-summary-card">
          <div className="owner-payment-summary-icon">
            <FaMoneyBillWave />
          </div>

          <div>
            <span>Total Tenant Payments</span>

            <strong>
              GHS {formatMoney(totalReceived)}
            </strong>

            <small>
              {payments.length} successful payment
              {payments.length === 1 ? "" : "s"}
            </small>
          </div>
        </div>

        <div className="owner-payment-summary-card">
          <div className="owner-payment-summary-icon pending">
            <FaClock />
          </div>

          <div>
            <span>Pending Settlement</span>

            <strong>
              GHS{" "}
              {formatMoney(
                pendingSettlementAmount
              )}
            </strong>

            <small>
              {pendingPayments.length} awaiting
              Paystack
            </small>
          </div>
        </div>

        <div className="owner-payment-summary-card">
          <div className="owner-payment-summary-icon paid">
            <FaCheckCircle />
          </div>

          <div>
            <span>Paid to Your Account</span>

            <strong>
              GHS{" "}
              {formatMoney(
                paidSettlementAmount
              )}
            </strong>

            <small>
              {paidPayments.length} completed
              settlement
              {paidPayments.length === 1
                ? ""
                : "s"}
            </small>
          </div>
        </div>
      </div>

      <div className="owner-payment-tabs">
        <button
          type="button"
          className={
            activeTab === "pending"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("pending")
          }
        >
          Pending Settlements

          <span>{pendingPayments.length}</span>
        </button>

        <button
          type="button"
          className={
            activeTab === "paid"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("paid")
          }
        >
          Paid Settlements

          <span>{paidPayments.length}</span>
        </button>

        <button
          type="button"
          className={
            activeTab === "failed"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("failed")
          }
        >
          Failed

          <span>{failedPayments.length}</span>
        </button>
      </div>

      {displayedPayments.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <div className="owner-payment-table-wrapper">
            <table className="owner-payment-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Rent Details</th>
                  <th>Total Paid</th>
                  <th>Charges</th>
                  <th>Your Amount</th>
                  <th>Payment Date</th>
                  <th>Settlement</th>
                </tr>
              </thead>

              <tbody>
                {displayedPayments.map(
                  (payment) => (
                    <tr key={payment.id}>
                      <td>
                        <div className="owner-payment-main-cell">
                          <div className="owner-payment-property-icon">
                            <FaHome />
                          </div>

                          <div>
                            <strong>
                              {payment.property_name ||
                                "Unknown Property"}
                            </strong>

                            <small>
                              Reference:{" "}
                              {payment.reference}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="owner-payment-tenant">
                          <FaUser />

                          <div>
                            <strong>
                              {payment.tenant_name ||
                                "Unknown Tenant"}
                            </strong>

                            <small>
                              Booking #
                              {payment.booking}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="owner-payment-detail-stack">
                          <span>
                            {payment.duration_months}{" "}
                            months
                          </span>

                          <small>
                            Paid through UrbanHavens
                          </small>
                        </div>
                      </td>

                      <td>
                        <strong className="owner-payment-amount">
                          GHS{" "}
                          {formatMoney(payment.amount)}
                        </strong>
                      </td>

                      <td>
                        <div className="owner-payment-charge-stack">
                          <span>
                            Platform: GHS{" "}
                            {formatMoney(
                              payment.platform_commission
                            )}
                          </span>

                          <span>
                            Paystack: GHS{" "}
                            {formatMoney(
                              payment.paystack_fee
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong className="owner-payment-net-amount">
                          GHS{" "}
                          {formatMoney(
                            payment.owner_net_amount
                          )}
                        </strong>
                      </td>

                      <td>
                        <div className="owner-payment-date">
                          <FaCalendarAlt />

                          <span>
                            {formatDateTime(
                              payment.verified_at ||
                                payment.created_at
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="owner-payment-settlement-cell">
                          <span
                            className={`owner-payment-status ${payment.settlement_status}`}
                          >
                            {getSettlementLabel(
                              payment.settlement_status
                            )}
                          </span>

                          {payment.settlement_status ===
                            "paid" && (
                            <>
                              <small>
                                Settled:{" "}
                                {formatDate(
                                  payment.settled_at
                                )}
                              </small>

                              {payment.settlement_reference && (
                                <small>
                                  Ref:{" "}
                                  {
                                    payment.settlement_reference
                                  }
                                </small>
                              )}
                            </>
                          )}

                          {payment.settlement_status ===
                            "pending" && (
                            <>
                              <small>
                                Paystack is processing
                                your payout.
                              </small>

                              <button
                                type="button"
                                className="owner-payment-sync-btn"
                                onClick={() =>
                                  handleSyncSettlement(
                                    payment.id
                                  )
                                }
                                disabled={
                                  syncingPaymentId ===
                                  payment.id
                                }
                              >
                                <FaSyncAlt
                                  className={
                                    syncingPaymentId ===
                                    payment.id
                                      ? "spinning"
                                      : ""
                                  }
                                />

                                {syncingPaymentId ===
                                payment.id
                                  ? "Checking..."
                                  : "Refresh Settlement"}
                              </button>
                            </>
                          )}

                          {payment.settlement_status ===
                            "processing" && (
                            <>
                              <small>
                                Settlement is currently
                                being processed.
                              </small>

                              <button
                                type="button"
                                className="owner-payment-sync-btn"
                                onClick={() =>
                                  handleSyncSettlement(
                                    payment.id
                                  )
                                }
                                disabled={
                                  syncingPaymentId ===
                                  payment.id
                                }
                              >
                                <FaSyncAlt
                                  className={
                                    syncingPaymentId ===
                                    payment.id
                                      ? "spinning"
                                      : ""
                                  }
                                />

                                {syncingPaymentId ===
                                payment.id
                                  ? "Checking..."
                                  : "Refresh Settlement"}
                              </button>
                            </>
                          )}

                          {payment.settlement_status ===
                            "failed" && (
                            <small>
                              Settlement requires
                              attention.
                            </small>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="owner-payment-mobile-list">
            {displayedPayments.map(
              (payment) => (
                <article
                  className="owner-payment-mobile-card"
                  key={payment.id}
                >
                  <div className="owner-payment-mobile-top">
                    <div>
                      <h3>
                        {payment.property_name ||
                          "Unknown Property"}
                      </h3>

                      <p>{payment.tenant_name}</p>
                    </div>

                    <span
                      className={`owner-payment-status ${payment.settlement_status}`}
                    >
                      {getSettlementLabel(
                        payment.settlement_status
                      )}
                    </span>
                  </div>

                  <div className="owner-payment-mobile-grid">
                    <div>
                      <span>Total Paid</span>

                      <strong>
                        GHS{" "}
                        {formatMoney(
                          payment.amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Your Amount</span>

                      <strong>
                        GHS{" "}
                        {formatMoney(
                          payment.owner_net_amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Duration</span>

                      <strong>
                        {payment.duration_months}{" "}
                        months
                      </strong>
                    </div>

                    <div>
                      <span>Payment Date</span>

                      <strong>
                        {formatDate(
                          payment.verified_at
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="owner-payment-mobile-fees">
                    <span>
                      UrbanHavens commission: GHS{" "}
                      {formatMoney(
                        payment.platform_commission
                      )}
                    </span>

                    <span>
                      Paystack fee: GHS{" "}
                      {formatMoney(
                        payment.paystack_fee
                      )}
                    </span>
                  </div>

                  {[
                    "pending",
                    "processing",
                  ].includes(
                    payment.settlement_status
                  ) && (
                    <>
                      <p className="owner-payment-mobile-note">
                        The tenant paid successfully.
                        Check Paystack to update the
                        settlement status.
                      </p>

                      <button
                        type="button"
                        className="owner-payment-sync-btn"
                        onClick={() =>
                          handleSyncSettlement(
                            payment.id
                          )
                        }
                        disabled={
                          syncingPaymentId ===
                          payment.id
                        }
                      >
                        <FaSyncAlt
                          className={
                            syncingPaymentId ===
                            payment.id
                              ? "spinning"
                              : ""
                          }
                        />

                        {syncingPaymentId ===
                        payment.id
                          ? "Checking..."
                          : "Refresh Settlement"}
                      </button>
                    </>
                  )}

                  {payment.settlement_status ===
                    "paid" && (
                    <p className="owner-payment-mobile-note paid">
                      Paystack settled this payment
                      on{" "}
                      {formatDate(
                        payment.settled_at
                      )}
                      .
                    </p>
                  )}

                  {payment.settlement_status ===
                    "failed" && (
                    <p className="owner-payment-mobile-note">
                      This settlement requires
                      attention.
                    </p>
                  )}
                </article>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
};


export default Payment;