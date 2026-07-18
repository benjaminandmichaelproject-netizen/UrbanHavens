import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaFileContract,
  FaHome,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaUser,
  FaKey,
  FaClock,
  FaDownload,
  FaRedo,
  FaPaperPlane,
  FaCreditCard,
  FaHandHoldingUsd,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import { api } from "../../Owner/UploadDetails/api/api";
import "./Lease.css";


/* Formats an ISO date for readable display. */
const readableDate = (dateValue) =>
  dateValue
    ? new Date(dateValue).toLocaleDateString([], {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";


/* Calculates lease duration and progress values. */
const computeLeaseStats = (
  startDate,
  endDate
) => {
  if (!startDate || !endDate) {
    return {
      totalDays: 0,
      daysElapsed: 0,
      daysLeft: 0,
      totalMonths: 0,
      monthsLeft: 0,
      progress: 0,
    };
  }

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  const totalDays = Math.max(
    1,
    Math.floor(
      (end - start) /
        millisecondsPerDay
    )
  );

  const clampedNow =
    today < start
      ? start
      : today > end
      ? end
      : today;

  const daysElapsed = Math.floor(
    (clampedNow - start) /
      millisecondsPerDay
  );

  const rawDaysLeft = Math.ceil(
    (end - today) /
      millisecondsPerDay
  );

  const daysLeft = Math.max(
    0,
    rawDaysLeft
  );

  const totalMonths =
    (end.getFullYear() -
      start.getFullYear()) *
      12 +
    (end.getMonth() -
      start.getMonth());

  let monthsLeft = 0;

  if (today < end) {
    monthsLeft =
      (end.getFullYear() -
        today.getFullYear()) *
        12 +
      (end.getMonth() -
        today.getMonth());

    if (
      end.getDate() <
      today.getDate()
    ) {
      monthsLeft -= 1;
    }

    monthsLeft = Math.max(
      0,
      monthsLeft
    );
  }

  const progress = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (daysElapsed /
          totalDays) *
          100
      )
    )
  );

  return {
    totalDays,
    daysElapsed,
    daysLeft,
    totalMonths,
    monthsLeft,
    progress,
  };
};


/* Resolves the current lease status for display. */
const resolveLeaseStatus = (lease) => {
  if (!lease) {
    return null;
  }

  const today = new Date();
  const start = new Date(
    lease.lease_start_date
  );
  const end = new Date(
    lease.lease_end_date
  );

  if (today < start) {
    return {
      label: "Upcoming",
      modifier: "upcoming",
      icon: <FaHourglassHalf />,
    };
  }

  if (today > end) {
    return {
      label: "Expired",
      modifier: "expired",
      icon: <FaTimesCircle />,
    };
  }

  return {
    label: "Active",
    modifier: "active",
    icon: <FaCheckCircle />,
  };
};


/* Defines the entrance animation used by page sections. */
const revealUp = (delay = 0) => ({
  initial: {
    opacity: 0,
    y: 30,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  transition: {
    duration: 0.5,
    ease: [
      0.22,
      1,
      0.36,
      1,
    ],
    delay,
  },
});


/* Returns a readable renewal status. */
const getRenewalStatusLabel = (
  status
) => {
  const labels = {
    pending:
      "Awaiting Owner Approval",
    payment_pending:
      "Approved — Payment Required",
    payment_completed:
      "Payment Completed",
    approved:
      "Renewal Completed",
    rejected:
      "Renewal Rejected",
    cancelled:
      "Renewal Cancelled",
  };

  return labels[status] || status;
};


const Lease = () => {
  const navigate = useNavigate();

  // Stores the tenant's current active lease.
  const [lease, setLease] =
    useState(null);

  // Stores the tenant's renewal history.
  const [
    renewals,
    setRenewals,
  ] = useState([]);

  // Stores page request state.
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [error, setError] =
    useState(null);

  // Stores renewal form values.
  const [
    renewalDuration,
    setRenewalDuration,
  ] = useState("");

  const [
    renewalNote,
    setRenewalNote,
  ] = useState("");

  // Tracks renewal request and payment actions.
  const [
    submittingRenewal,
    setSubmittingRenewal,
  ] = useState(false);

  const [
    initializingPayment,
    setInitializingPayment,
  ] = useState(false);

  const [
    renewalFeedback,
    setRenewalFeedback,
  ] = useState(null);


  // Loads the active lease and tenant renewal history.
  const loadLeaseData =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const [
          leaseResponse,
          renewalResponse,
        ] = await Promise.all([
          api.get(
            "/leases/my-lease/"
          ),
          api.get(
            "/leases/renewals/tenant/"
          ),
        ]);

        setLease(
          leaseResponse.data || null
        );

        const renewalData =
          renewalResponse.data;

        setRenewals(
          Array.isArray(renewalData)
            ? renewalData
            : renewalData?.results ||
                []
        );
      } catch (requestError) {
        if (
          requestError?.response
            ?.status === 404
        ) {
          setLease(null);
        } else {
          setError(
            "We couldn't load your lease right now. Please try again."
          );
        }
      } finally {
        setLoading(false);
      }
    }, []);


  // Loads the page data when the component opens.
  useEffect(() => {
    loadLeaseData();
  }, [loadLeaseData]);


  const stats = useMemo(
    () =>
      lease
        ? computeLeaseStats(
            lease.lease_start_date,
            lease.lease_end_date
          )
        : null,
    [lease]
  );

  const status = useMemo(
    () =>
      resolveLeaseStatus(lease),
    [lease]
  );


  // Returns the newest renewal for the current lease.
  const currentRenewal =
    useMemo(() => {
      if (!lease) {
        return null;
      }

      return (
        renewals.find(
          (renewal) =>
            Number(
              renewal.current_lease
            ) === Number(lease.id)
        ) || null
      );
    }, [
      lease,
      renewals,
    ]);


  // Reads the owner-approved renewal durations.
  const allowedDurations =
    useMemo(() => {
      const rawDurations =
        lease?.allowed_rental_months ||
        lease?.property_allowed_rental_months ||
        [];

      if (!Array.isArray(rawDurations)) {
        return [];
      }

      return rawDurations
        .map((value) =>
          Number(value)
        )
        .filter(
          (value) =>
            Number.isInteger(value) &&
            value > 0
        );
    }, [lease]);


  // Determines whether the renewal request window is open.
  const renewalEligible =
    Boolean(
      lease &&
        lease.status ===
          "active" &&
        stats &&
        stats.daysLeft <= 30 &&
        stats.daysLeft >= 0 &&
        !currentRenewal
    );


  // Calculates the renewal amount preview.
  const renewalAmount =
    renewalDuration
      ? Number(
          lease?.monthly_rent || 0
        ) *
        Number(renewalDuration)
      : 0;


  // Opens the protected printable tenancy agreement.
  const handleViewAgreement = () => {
    if (!lease?.id) {
      return;
    }

    navigate(
      `/leases/${lease.id}/agreement`
    );
  };


  // Submits a new renewal request.
  const handleRequestRenewal =
    async (event) => {
      event.preventDefault();

      if (
        !lease?.id ||
        !renewalDuration
      ) {
        setRenewalFeedback({
          type: "error",
          message:
            "Select an approved renewal duration.",
        });

        return;
      }

      try {
        setSubmittingRenewal(true);
        setRenewalFeedback(null);

        const response =
          await api.post(
            "/leases/renewals/request/",
            {
              current_lease_id:
                lease.id,
              requested_duration_months:
                Number(
                  renewalDuration
                ),
              notes:
                renewalNote.trim(),
            }
          );

        setRenewalDuration("");
        setRenewalNote("");

        await loadLeaseData();

        setRenewalFeedback({
          type: "success",
          message:
            response.data?.detail ||
            "Renewal request submitted successfully.",
        });
      } catch (requestError) {
        const responseData =
          requestError?.response
            ?.data;

        const message =
          responseData?.detail ||
          responseData
            ?.current_lease_id?.[0] ||
          responseData
            ?.requested_duration_months?.[0] ||
          "Failed to submit renewal request.";

        setRenewalFeedback({
          type: "error",
          message,
        });
      } finally {
        setSubmittingRenewal(
          false
        );
      }
    };


  // Initializes Paystack or direct renewal payment.
  const handleRenewalPayment =
    async (paymentMethod) => {
      if (!currentRenewal?.id) {
        return;
      }

      try {
        setInitializingPayment(
          true
        );
        setRenewalFeedback(null);

        const response =
          await api.post(
            "/payments/renewals/initialize/",
            {
              renewal_request_id:
                currentRenewal.id,
              payment_method:
                paymentMethod,
            }
          );

        const authorizationUrl =
          response.data
            ?.authorization_url;

        if (
          paymentMethod ===
            "paystack" &&
          authorizationUrl
        ) {
          window.location.href =
            authorizationUrl;

          return;
        }

        await loadLeaseData();

        setRenewalFeedback({
          type: "success",
          message:
            response.data?.detail ||
            "Renewal payment request created successfully.",
        });
      } catch (requestError) {
        const responseData =
          requestError?.response
            ?.data;

        setRenewalFeedback({
          type: "error",
          message:
            responseData?.detail ||
            responseData
              ?.renewal_request_id?.[0] ||
            "Failed to initialize renewal payment.",
        });
      } finally {
        setInitializingPayment(
          false
        );
      }
    };


  const ringRadius = 52;
  const ringCircumference =
    2 * Math.PI * ringRadius;


  if (loading) {
    return (
      <div className="lease-page">
        <div className="page-loading">
          <div className="spinning-circle" />

          <p>
            Fetching your lease
            details…
          </p>
        </div>
      </div>
    );
  }


  if (error) {
    return (
      <div className="lease-page">
        <div className="lease-empty-state">
          <FaTimesCircle className="empty-icon error-variant" />

          <h3>
            Something went wrong
          </h3>

          <p>{error}</p>

          <button
            className="go-back-button"
            onClick={() =>
              navigate(
                "/dashboard/tenant"
              )
            }
          >
            <FaArrowLeft />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }


  if (!lease) {
    return (
      <div className="lease-page">
        <div className="lease-empty-state">
          <FaFileContract className="empty-icon" />

          <h3>No Lease Found</h3>

          <p>
            You don't have an active
            lease yet. Once a landlord
            approves your booking, your
            agreement will appear here.
          </p>

          <button
            className="browse-properties-button"
            onClick={() =>
              navigate("/")
            }
          >
            <FaHome />
            Browse Properties
          </button>
        </div>
      </div>
    );
  }


  const totalContractValue =
    lease.monthly_rent &&
    stats?.totalMonths
      ? (
          Number(
            lease.monthly_rent
          ) *
          stats.totalMonths
        ).toLocaleString()
      : "—";


  return (
    <div className="lease-page">
      <div className="lease-top-actions">
        <motion.button
          className="back-to-dashboard"
          onClick={() =>
            navigate(
              "/dashboard/tenant"
            )
          }
          {...revealUp(0)}
        >
          <FaArrowLeft />
          Back to Dashboard
        </motion.button>

        {lease.agreement_number ? (
          <motion.button
            type="button"
            className="download-lease-button"
            onClick={
              handleViewAgreement
            }
            {...revealUp(0.03)}
          >
            <FaDownload />
            View / Download Agreement
          </motion.button>
        ) : (
          <span className="agreement-unavailable">
            Agreement unavailable
          </span>
        )}
      </div>

      <motion.div
        className="property-hero-banner"
        {...revealUp(0.06)}
      >
        <div className="hero-dark-overlay" />

        <div className="hero-text-content">
          <div className="hero-top-row">
            <span className="contract-type-tag">
              <FaFileContract />
              Lease Agreement
            </span>

            <span
              className={`lease-status-pill ${status.modifier}`}
            >
              {status.icon}
              {status.label}
            </span>
          </div>

          <h1 className="hero-property-name">
            {lease.property_name ||
              "Your Property"}
          </h1>

          <p className="hero-property-location">
            <FaMapMarkerAlt />

            {[
              lease.property_city,
              lease.property_region,
            ]
              .filter(Boolean)
              .join(", ") || "—"}
          </p>
        </div>
      </motion.div>

      {/* Displays renewal eligibility, request, and payment states. */}
      <motion.section
        className="info-section tenant-renewal-section"
        {...revealUp(0.08)}
      >
        <div className="tenant-renewal-heading">
          <div>
            <span className="tenant-renewal-eyebrow">
              Lease Continuation
            </span>

            <h2 className="section-heading">
              <FaRedo className="section-heading-icon" />
              Lease Renewal
            </h2>
          </div>

          {currentRenewal && (
            <span
              className={`tenant-renewal-status ${currentRenewal.status}`}
            >
              {getRenewalStatusLabel(
                currentRenewal.status
              )}
            </span>
          )}
        </div>

        {renewalFeedback && (
          <div
            className={`tenant-renewal-feedback ${renewalFeedback.type}`}
          >
            {
              renewalFeedback.message
            }
          </div>
        )}

        {renewalEligible && (
          <form
            className="tenant-renewal-form"
            onSubmit={
              handleRequestRenewal
            }
          >
            <p>
              Your lease ends in{" "}
              <strong>
                {stats.daysLeft} days
              </strong>
              . Select one of the
              landlord-approved durations
              to request renewal.
            </p>

            <div className="tenant-renewal-form-grid">
              <label>
                <span>
                  Renewal duration
                </span>

                <select
                  value={
                    renewalDuration
                  }
                  onChange={(event) =>
                    setRenewalDuration(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select duration
                  </option>

                  {allowedDurations.map(
                    (months) => (
                      <option
                        key={months}
                        value={months}
                      >
                        {months} months
                      </option>
                    )
                  )}
                </select>
              </label>

              <div className="tenant-renewal-amount-preview">
                <span>
                  Estimated amount
                </span>

                <strong>
                  GHS{" "}
                  {renewalAmount.toLocaleString(
                    "en-GH",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </strong>
              </div>
            </div>

            <label>
              <span>
                Note to landlord
              </span>

              <textarea
                value={renewalNote}
                onChange={(event) =>
                  setRenewalNote(
                    event.target.value
                  )
                }
                maxLength={2000}
                rows={4}
                placeholder="Optional: add a short note about your renewal request."
              />
            </label>

            {allowedDurations.length ===
              0 && (
              <p className="tenant-renewal-warning">
                No approved renewal
                duration is available for
                this property. Contact the
                landlord.
              </p>
            )}

            <button
              type="submit"
              className="tenant-renewal-submit-btn"
              disabled={
                submittingRenewal ||
                allowedDurations.length ===
                  0
              }
            >
              <FaPaperPlane />

              {submittingRenewal
                ? "Submitting..."
                : "Request Renewal"}
            </button>
          </form>
        )}

        {!renewalEligible &&
          !currentRenewal &&
          lease.status ===
            "active" && (
            <div className="tenant-renewal-not-open">
              <FaClock />

              <div>
                <strong>
                  Renewal is not open yet
                </strong>

                <p>
                  Renewal becomes available
                  during the final 30 days
                  of your lease.
                </p>
              </div>
            </div>
          )}

        {currentRenewal?.status ===
          "pending" && (
          <div className="tenant-renewal-message">
            <FaHourglassHalf />

            <div>
              <strong>
                Waiting for landlord
                approval
              </strong>

              <p>
                Your renewal request has
                been submitted. The
                landlord must approve it
                before payment becomes
                available.
              </p>
            </div>
          </div>
        )}

        {currentRenewal?.status ===
          "payment_pending" && (
          <div className="tenant-renewal-payment-box">
            <div>
              <strong>
                Renewal approved
              </strong>

              <p>
                Amount due: GHS{" "}
                {Number(
                  currentRenewal.expected_amount ||
                    0
                ).toLocaleString(
                  "en-GH",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </p>
            </div>

            <div className="tenant-renewal-payment-actions">
              <button
                type="button"
                className="tenant-renewal-paystack-btn"
                onClick={() =>
                  handleRenewalPayment(
                    "paystack"
                  )
                }
                disabled={
                  initializingPayment
                }
              >
                <FaCreditCard />
                Pay through UrbanHavens
              </button>

              <button
                type="button"
                className="tenant-renewal-direct-btn"
                onClick={() =>
                  handleRenewalPayment(
                    "direct"
                  )
                }
                disabled={
                  initializingPayment
                }
              >
                <FaHandHoldingUsd />
                Pay Owner Directly
              </button>
            </div>
          </div>
        )}

        {currentRenewal?.status ===
          "payment_completed" && (
          <div className="tenant-renewal-message success">
            <FaCheckCircle />

            <div>
              <strong>
                Renewal payment completed
              </strong>

              <p>
                The landlord can now
                complete the renewal and
                generate your new lease
                agreement.
              </p>
            </div>
          </div>
        )}

        {currentRenewal?.status ===
          "approved" && (
          <div className="tenant-renewal-message success">
            <FaCheckCircle />

            <div>
              <strong>
                Renewal completed
              </strong>

              <p>
                Your renewed lease has
                been created. Refresh or
                reopen this page to view
                the new agreement.
              </p>
            </div>
          </div>
        )}

        {currentRenewal?.status ===
          "rejected" && (
          <div className="tenant-renewal-message rejected">
            <FaTimesCircle />

            <div>
              <strong>
                Renewal request rejected
              </strong>

              <p>
                The landlord did not
                approve this renewal
                request.
              </p>
            </div>
          </div>
        )}
      </motion.section>

      <div className="lease-body-grid">
        <div className="lease-left-column">
          <motion.section
            className="info-section duration-section"
            {...revealUp(0.1)}
          >
            <h2 className="section-heading">
              <FaCalendarAlt className="section-heading-icon" />
              Lease Duration
            </h2>

            <div className="date-range-display">
              <div className="single-date-block">
                <span className="date-type-label">
                  Start Date
                </span>

                <strong className="formatted-date start-date-color">
                  {readableDate(
                    lease.lease_start_date
                  )}
                </strong>
              </div>

              <div className="duration-middle-badge">
                <span>
                  {stats.totalMonths}
                </span>

                <small>
                  months
                </small>
              </div>

              <div className="single-date-block">
                <span className="date-type-label">
                  End Date
                </span>

                <strong className="formatted-date end-date-color">
                  {readableDate(
                    lease.lease_end_date
                  )}
                </strong>
              </div>
            </div>
          </motion.section>

          <motion.section
            className="info-section financials-section"
            {...revealUp(0.14)}
          >
            <h2 className="section-heading">
              <FaMoneyBillWave className="section-heading-icon" />
              Financials
            </h2>

            <div className="financial-cards-row">
              <div className="financial-card monthly-rent-highlight">
                <span className="financial-card-label">
                  Monthly Rent
                </span>

                <strong className="financial-card-amount">
                  GHS{" "}
                  {Number(
                    lease.monthly_rent ||
                      0
                  ).toLocaleString()}
                </strong>

                <span className="financial-card-note">
                  per month
                </span>
              </div>

              <div className="financial-card total-value-card">
                <span className="financial-card-label">
                  Total Contract Value
                </span>

                <strong className="financial-card-amount">
                  GHS{" "}
                  {totalContractValue}
                </strong>

                <span className="financial-card-note">
                  {stats.totalMonths} months
                </span>
              </div>

              {lease.security_deposit && (
                <div className="financial-card deposit-card">
                  <span className="financial-card-label">
                    Security Deposit
                  </span>

                  <strong className="financial-card-amount">
                    GHS{" "}
                    {Number(
                      lease.security_deposit
                    ).toLocaleString()}
                  </strong>

                  <span className="financial-card-note">
                    one-time
                  </span>
                </div>
              )}
            </div>
          </motion.section>

          {(lease.tenant_name ||
            lease.landlord_name) && (
            <motion.section
              className="info-section parties-section"
              {...revealUp(0.18)}
            >
              <h2 className="section-heading">
                <FaUser className="section-heading-icon" />
                Parties Involved
              </h2>

              <div className="party-cards-row">
                {lease.tenant_name && (
                  <div className="party-card tenant-party">
                    <div className="party-initial-avatar tenant-avatar-color">
                      {lease.tenant_name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="party-details">
                      <span className="party-role-label">
                        Tenant
                      </span>

                      <strong className="party-full-name">
                        {
                          lease.tenant_name
                        }
                      </strong>
                    </div>
                  </div>
                )}

                {lease.landlord_name && (
                  <div className="party-card landlord-party">
                    <div className="party-initial-avatar landlord-avatar-color">
                      {lease.landlord_name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="party-details">
                      <span className="party-role-label">
                        Landlord
                      </span>

                      <strong className="party-full-name">
                        {
                          lease.landlord_name
                        }
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {lease.terms && (
            <motion.section
              className="info-section terms-section"
              {...revealUp(0.22)}
            >
              <h2 className="section-heading">
                <FaKey className="section-heading-icon" />
                Terms & Conditions
              </h2>

              <p className="terms-body-text">
                {lease.terms}
              </p>
            </motion.section>
          )}

          <motion.section
            className="info-section reference-section"
            {...revealUp(0.26)}
          >
            <h2 className="section-heading">
              Reference
            </h2>

            <div className="reference-fields-row">
              <div className="reference-field">
                <span className="reference-field-label">
                  Lease ID
                </span>

                <strong className="reference-field-value">
                  #{lease.id}
                </strong>
              </div>

              {lease.agreement_number && (
                <div className="reference-field">
                  <span className="reference-field-label">
                    Agreement Number
                  </span>

                  <strong className="reference-field-value">
                    {
                      lease.agreement_number
                    }
                  </strong>
                </div>
              )}

              {lease.created_at && (
                <div className="reference-field">
                  <span className="reference-field-label">
                    Issued On
                  </span>

                  <strong className="reference-field-value">
                    {readableDate(
                      lease.created_at
                    )}
                  </strong>
                </div>
              )}
            </div>
          </motion.section>
        </div>

        <div className="lease-right-column">
          <motion.section
            className="info-section progress-tracker-section"
            {...revealUp(0.1)}
          >
            <h2 className="section-heading">
              <FaClock className="section-heading-icon" />
              Lease Progress
            </h2>

            <div className="circular-progress-wrapper">
              <svg
                className="circular-ring-svg"
                viewBox="0 0 120 120"
              >
                <circle
                  className="ring-background-track"
                  cx="60"
                  cy="60"
                  r={ringRadius}
                />

                <motion.circle
                  className="ring-progress-fill"
                  cx="60"
                  cy="60"
                  r={ringRadius}
                  strokeDasharray={
                    ringCircumference
                  }
                  initial={{
                    strokeDashoffset:
                      ringCircumference,
                  }}
                  animate={{
                    strokeDashoffset:
                      ringCircumference *
                      (1 -
                        stats.progress /
                          100),
                  }}
                  transition={{
                    duration: 1.5,
                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                    delay: 0.35,
                  }}
                />
              </svg>

              <div className="ring-center-label">
                <span className="ring-percentage-number">
                  {stats.progress}%
                </span>

                <span className="ring-percentage-caption">
                  complete
                </span>
              </div>
            </div>

            <div className="lease-time-stats">
              <div className="time-stat-tile">
                <span className="time-stat-big-number">
                  {
                    stats.totalMonths
                  }
                </span>

                <span className="time-stat-description">
                  Total Months
                </span>
              </div>

              <div className="time-stat-tile">
                <span className="time-stat-big-number">
                  {
                    stats.daysElapsed
                  }
                </span>

                <span className="time-stat-description">
                  Days Elapsed
                </span>
              </div>

              <div className="time-stat-tile highlighted-time-tile">
                <span className="time-stat-big-number">
                  {
                    stats.monthsLeft
                  }
                </span>

                <span className="time-stat-description">
                  Months Left
                </span>
              </div>

              <div className="time-stat-tile">
                <span className="time-stat-big-number">
                  {stats.daysLeft}
                </span>

                <span className="time-stat-description">
                  Days Left
                </span>
              </div>
            </div>

            <div className="linear-progress-section">
              <div className="linear-progress-bar">
                <motion.div
                  className="linear-progress-filled"
                  initial={{
                    width: 0,
                  }}
                  animate={{
                    width: `${stats.progress}%`,
                  }}
                  transition={{
                    duration: 1.3,
                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                    delay: 0.45,
                  }}
                />
              </div>

              <div className="progress-bar-date-labels">
                <span>
                  {readableDate(
                    lease.lease_start_date
                  )}
                </span>

                <span>
                  {readableDate(
                    lease.lease_end_date
                  )}
                </span>
              </div>
            </div>

            <div className="days-remaining-banner">
              <span className="days-remaining-big-count">
                {stats.daysLeft}
              </span>

              <span className="days-remaining-description">
                days remaining on your
                lease
              </span>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
};


export default Lease;