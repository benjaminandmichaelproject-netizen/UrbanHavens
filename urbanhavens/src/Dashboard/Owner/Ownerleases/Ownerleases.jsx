import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBed,
  FaFileContract,
  FaHome,
  FaLayerGroup,
  FaMapMarkerAlt,
  FaSearch,
  FaTimesCircle,
  FaUser,
} from "react-icons/fa";

import { api } from "../UploadDetails/api/api";
import TerminateLeaseModal from "../Terminateleasemodal/TerminateLeaseModal";
import "./OwnerLeases.css";


const STATUS_META = {
  active: {
    label: "Active",
    cls: "ls-active",
  },
  ended: {
    label: "Ended",
    cls: "ls-ended",
  },
  cancelled: {
    label: "Cancelled",
    cls: "ls-cancelled",
  },
};


// Formats lease dates for readable display.
const formatDate = (dateValue) =>
  dateValue
    ? new Date(dateValue).toLocaleDateString(
        "en-GH",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      )
    : "—";


// Formats rent values safely.
const formatMoney = (amount) => {
  const numericAmount = Number(amount);

  return Number.isFinite(numericAmount)
    ? numericAmount.toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
};


const OwnerLeases = () => {
  // Handles agreement and renewal-page navigation.
  const navigate = useNavigate();

  // Stores all lease records belonging to the owner.
  const [leases, setLeases] = useState([]);

  // Stores page request and filtering state.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("active");

  // Stores the active lease selected for termination.
  const [terminateLease, setTerminateLease] =
    useState(null);

  // Tracks an active termination request.
  const [terminating, setTerminating] =
    useState(false);

  // Stores success and error popup feedback.
  const [popup, setPopup] = useState(null);


  // Loads all leases belonging to the owner.
  const fetchLeases = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/leases/");
      const data = response.data;

      setLeases(
        Array.isArray(data)
          ? data
          : data?.results || []
      );
    } catch (requestError) {
      console.error(
        "Failed to load owner leases:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      setError(
        requestError?.response?.data?.detail ||
          "Failed to load leases."
      );
    } finally {
      setLoading(false);
    }
  }, []);


  // Loads leases when the page opens.
  useEffect(() => {
    fetchLeases();
  }, [fetchLeases]);


  // Filters leases by search text and lifecycle status.
  const filteredLeases = useMemo(() => {
    return leases.filter((lease) => {
      const normalizedSearch = search
        .toLowerCase()
        .trim();

      const matchesSearch =
        !normalizedSearch ||
        (lease.property_name || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (lease.property_city || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (lease.property_region || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (lease.tenant_name || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (lease.room_number || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (lease.room_type || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (lease.property_category || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (lease.agreement_number || "")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : lease.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    leases,
    search,
    statusFilter,
  ]);


  // Calculates lease totals for each lifecycle status.
  const counts = useMemo(
    () => ({
      active: leases.filter(
        (lease) => lease.status === "active"
      ).length,

      ended: leases.filter(
        (lease) => lease.status === "ended"
      ).length,

      cancelled: leases.filter(
        (lease) => lease.status === "cancelled"
      ).length,
    }),
    [leases]
  );


  // Opens the official tenancy agreement.
  const handleViewAgreement = (leaseId) => {
    navigate(`/leases/${leaseId}/agreement`);
  };


  // Opens the dedicated owner renewal-request page.
  const handleOpenRenewals = () => {
    navigate("/dashboard/owner/renewals");
  };


  // Terminates the selected active lease.
  const handleTerminate = async ({ note }) => {
    if (!terminateLease) {
      return;
    }

    const selectedLease = terminateLease;

    try {
      setTerminating(true);

      const response = await api.post(
        `/leases/${selectedLease.id}/terminate/`,
        {
          note,
        }
      );

      setTerminateLease(null);

      await fetchLeases();

      setPopup({
        type: "success",
        message:
          response.data?.detail ||
          (
            `Lease for ${selectedLease.property_name} ` +
            "has been ended."
          ),
      });
    } catch (requestError) {
      console.error(
        "Failed to end lease:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      setPopup({
        type: "error",
        message:
          requestError?.response?.data?.detail ||
          "Failed to end lease.",
      });
    } finally {
      setTerminating(false);
    }
  };


  return (
    <div className="ol-page">
      <div className="ol-header">
        <div>
          <h2>Tenant Leases</h2>

          <p>
            Manage active and historical leases for your
            properties. Renewal requests are handled from
            the dedicated Renewal Requests page.
          </p>
        </div>

        <div className="ol-header-actions">
          {/* Opens the new payment-driven renewal workflow. */}
          <button
            type="button"
            className="ol-renewals-page-btn"
            onClick={handleOpenRenewals}
          >
            <FaFileContract />
            Renewal Requests
          </button>

          <div className="ol-counts">
            <div className="ol-count active">
              <span>{counts.active}</span>
              Active
            </div>

            <div className="ol-count ended">
              <span>{counts.ended}</span>
              Ended
            </div>

            <div className="ol-count cancelled">
              <span>{counts.cancelled}</span>
              Cancelled
            </div>
          </div>
        </div>
      </div>

      <div className="ol-toolbar">
        <div className="ol-search">
          <FaSearch size={13} />

          <input
            type="text"
            placeholder={
              "Search property, tenant, room, city, " +
              "category or agreement number..."
            }
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="ol-filters">
          {[
            "all",
            "active",
            "ended",
            "cancelled",
          ].map((statusValue) => (
            <button
              type="button"
              key={statusValue}
              className={
                statusFilter === statusValue
                  ? "active"
                  : ""
              }
              onClick={() =>
                setStatusFilter(statusValue)
              }
            >
              {statusValue === "all"
                ? "All"
                : STATUS_META[statusValue]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="ol-info">
          Loading leases...
        </p>
      )}

      {error && (
        <p className="ol-error">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="ol-table-wrapper">
          <table className="ol-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Property</th>
                <th>Tenant</th>
                <th>Room / Unit</th>
                <th>Rent</th>
                <th>Lease Period</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Agreement</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLeases.length > 0 ? (
                filteredLeases.map((lease) => {
                  const isHostel =
                    lease.property_category ===
                    "hostel";

                  const roomSpaces =
                    isHostel &&
                    lease.room_available_spaces !==
                      null &&
                    lease.room_available_spaces !==
                      undefined
                      ? `${
                          lease.room_available_spaces
                        } space${
                          Number(
                            lease.room_available_spaces
                          ) === 1
                            ? ""
                            : "s"
                        } left`
                      : null;

                  return (
                    <tr key={lease.id}>
                      <td className="ol-id">
                        #{lease.id}
                      </td>

                      <td>
                        <div className="ol-prop-cell">
                          <FaHome className="ol-cell-icon" />

                          <div>
                            <strong>
                              {lease.property_name}
                            </strong>

                            <span>
                              <FaMapMarkerAlt className="ol-inline-icon" />

                              {lease.property_city ||
                                "—"}

                              {lease.property_region
                                ? `, ${lease.property_region}`
                                : ""}
                            </span>

                            <span className="ol-category-line">
                              <FaLayerGroup className="ol-inline-icon" />

                              {lease.property_category ===
                              "hostel"
                                ? "Hostel"
                                : lease.property_category ===
                                  "house_rent"
                                ? "House Rent"
                                : "Property"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="ol-tenant-cell">
                          <FaUser className="ol-cell-icon" />

                          <div>
                            <strong>
                              {lease.tenant_name}
                            </strong>

                            <span>
                              {lease.tenant_phone ||
                                lease.tenant_email ||
                                "—"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {isHostel ? (
                          lease.room_number ? (
                            <div className="ol-room-stack">
                              <span className="ol-room-badge">
                                <FaBed />
                                {lease.room_number}
                              </span>

                              <span className="ol-room-meta">
                                {lease.room_type ||
                                  "Room"}
                              </span>

                              {roomSpaces && (
                                <span className="ol-room-meta availability">
                                  {roomSpaces}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="ol-na">
                              No room assigned
                            </span>
                          )
                        ) : (
                          <span className="ol-unit-badge">
                            Whole property
                          </span>
                        )}
                      </td>

                      <td className="ol-rent">
                        GHS{" "}
                        {formatMoney(
                          lease.monthly_rent
                        )}

                        <small>/mo</small>
                      </td>

                      <td>
                        <div className="ol-dates">
                          <span>
                            {formatDate(
                              lease.lease_start_date
                            )}
                          </span>

                          <span className="ol-date-sep">
                            →
                          </span>

                          <span>
                            {formatDate(
                              lease.lease_end_date
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`ol-payment ${lease.first_payment_status}`}
                        >
                          {
                            lease.first_payment_status
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={`ol-status ${
                            STATUS_META[
                              lease.status
                            ]?.cls || ""
                          }`}
                        >
                          {STATUS_META[
                            lease.status
                          ]?.label || lease.status}
                        </span>
                      </td>

                      <td>
                        {lease.agreement_number ? (
                          <div className="ol-agreement-stack">
                            <span className="ol-agreement-number">
                              {
                                lease.agreement_number
                              }
                            </span>

                            <button
                              type="button"
                              className="ol-agreement-btn"
                              onClick={() =>
                                handleViewAgreement(
                                  lease.id
                                )
                              }
                              title="View official tenancy agreement"
                            >
                              <FaFileContract />
                              View Agreement
                            </button>
                          </div>
                        ) : (
                          <span className="ol-na">
                            Agreement unavailable
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="ol-action-btns">
                          {lease.status ===
                            "active" && (
                            <button
                              type="button"
                              className="ol-terminate-btn"
                              onClick={() =>
                                setTerminateLease(
                                  lease
                                )
                              }
                              title="End Lease"
                            >
                              <FaTimesCircle />
                              End
                            </button>
                          )}

                          {[
                            "ended",
                            "cancelled",
                          ].includes(
                            lease.status
                          ) && (
                            <span className="ol-na">
                              Renewal unavailable
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="10"
                    className="ol-empty"
                  >
                    No leases found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {terminateLease && (
        <TerminateLeaseModal
          lease={terminateLease}
          onClose={() =>
            !terminating &&
            setTerminateLease(null)
          }
          onConfirm={handleTerminate}
          submitting={terminating}
        />
      )}

      {popup && (
        <div
          className="ol-popup-overlay"
          onClick={() => setPopup(null)}
        >
          <div
            className={`ol-popup ${popup.type}`}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="ol-popup-icon">
              {popup.type === "success"
                ? "✓"
                : "!"}
            </div>

            <h3>
              {popup.type === "success"
                ? "Success"
                : "Error"}
            </h3>

            <p>{popup.message}</p>

            <button
              type="button"
              onClick={() => setPopup(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


export default OwnerLeases;