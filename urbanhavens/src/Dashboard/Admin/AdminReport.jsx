import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../Owner/UploadDetails/api/api.js";
import "./Report.css";

const AdminReport = () => {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [updatingReportId, setUpdatingReportId] = useState(null);
  const [moderatingPropertyId, setModeratingPropertyId] = useState(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedReportForModeration, setSelectedReportForModeration] = useState(
    null
  );

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    if (statusFilter === "all") return reports;
    return reports.filter((report) => report.status === statusFilter);
  }, [reports, statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setApiError("");

      const res = await api.get("/reports/admin/");
      const data = res.data;
      const reportList = Array.isArray(data) ? data : data.results || [];

      setReports(reportList);
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Something went wrong while fetching reports.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      setUpdatingReportId(reportId);
      setApiError("");

      await api.patch(`/reports/admin/${reportId}/`, {
        status: newStatus,
      });

      await fetchReports();
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Failed to update report status.";
      setApiError(msg);
    } finally {
      setUpdatingReportId(null);
    }
  };

  const openHideConfirm = (report) => {
    setSelectedReportForModeration(report);
    setConfirmModalOpen(true);
  };

  const closeHideConfirm = () => {
    if (moderatingPropertyId) return;
    setConfirmModalOpen(false);
    setSelectedReportForModeration(null);
  };

  const handleHideListing = async () => {
    if (
      !selectedReportForModeration ||
      !selectedReportForModeration.reported_property
    ) {
      return;
    }

    const propertyId = selectedReportForModeration.reported_property;
    const reportId = selectedReportForModeration.id;

    try {
      setModeratingPropertyId(propertyId);
      setApiError("");

      // Hide the listing through the moderation fields, not rental availability.
      await api.patch(`/properties/${propertyId}/`, {
        report_flag_status: "hidden",
        report_flagged: true,
      });

      // Also mark this report as resolved after manual hide action.
    

      closeHideConfirm();
      await fetchReports();
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Failed to hide property listing.";
      setApiError(msg);
    } finally {
      setModeratingPropertyId(null);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "pending":
        return "pending";
      case "reviewing":
        return "reviewing";
      case "resolved":
        return "resolved";
      case "dismissed":
        return "dismissed";
      default:
        return "";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "reviewing":
        return "Under Review";
      case "resolved":
        return "Resolved";
      case "dismissed":
        return "Dismissed";
      default:
        return status || "N/A";
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case "fraudulent_listing":
        return "Fraudulent Listing";
      case "misleading_info":
        return "Misleading Info";
      case "inappropriate_content":
        return "Inappropriate Content";
      case "scam":
        return "Scam";
      case "wrong_price":
        return "Wrong Price";
      case "already_rented":
        return "Already Rented";
      case "harassment":
        return "Harassment";
      case "other":
        return "Other";
      default:
        return category || "N/A";
    }
  };

  const getPropertyModerationLabel = (report) => {
    const moderationStatus = report.report_flag_status;

    switch (moderationStatus) {
      case "hidden":
        return "Hidden";
      case "flagged":
        return "Flagged";
      case "reviewing":
        return "Reviewing";
      case "resolved":
        return "Resolved";
      case "active":
        return "Active";
      default:
        return "Active";
    }
  };

  const getPropertyModerationClass = (report) => {
    const moderationStatus = report.report_flag_status;

    switch (moderationStatus) {
      case "hidden":
        return "property-moderation-badge hidden";
      case "flagged":
        return "property-moderation-badge flagged";
      case "reviewing":
        return "property-moderation-badge reviewing";
      case "resolved":
        return "property-moderation-badge resolved";
      default:
        return "property-moderation-badge active";
    }
  };

  const formatDate = (value) => {
    if (!value) return "N/A";
    return new Date(value).toLocaleDateString();
  };

  const getPropertyDisplayName = (report) => {
    if (report.property_name) return report.property_name;
    if (report.reported_property) return `Property #${report.reported_property}`;
    return "N/A";
  };

  const getPropertyLocation = (report) => {
    const location = [report.property_city, report.property_region]
      .filter(Boolean)
      .join(", ");
    return location || "Location not available";
  };

  return (
    <div className="admin-reports-page">
      <div className="admin-reports-header">
        <div>
          <h2>Reports Management</h2>
          <p>View and manage all reports submitted by users.</p>
        </div>

        <div className="admin-reports-filter">
          <label htmlFor="statusFilter">Filter by Status</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Reports</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {loading && <div className="reports-state">Loading reports...</div>}

      {!loading && apiError && (
        <div className="reports-state error">{apiError}</div>
      )}

      {!loading && !apiError && filteredReports.length === 0 && (
        <div className="reports-state">No reports found.</div>
      )}

      {!loading && !apiError && filteredReports.length > 0 && (
        <div className="admin-reports-table-wrapper">
          <table className="admin-reports-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Reported By</th>
                <th>Contact Email</th>
                <th>Property</th>
                <th>Owner Details</th>
                <th>User</th>
                <th>Booking</th>
                <th>Report Status</th>
                <th>Listing Status</th>
                <th>Actions</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredReports.map((report, index) => {
                const isUpdatingThisReport = updatingReportId === report.id;
                const isModeratingThisProperty =
                  moderatingPropertyId === report.reported_property;

                const listingAlreadyHidden =
                  report.report_flag_status === "hidden";

                return (
                  <tr
                    key={report.id}
                    className={
                      report.category === "scam" ? "report-row-danger" : ""
                    }
                  >
                    <td>{index + 1}</td>

                    <td>
                      <div className="report-subject-cell">
                        <strong>{report.subject}</strong>
                        <span>{report.description}</span>
                      </div>
                    </td>

                    <td>{getCategoryLabel(report.category)}</td>

                    <td>{report.reported_by_username || "Unknown"}</td>

                    <td>{report.contact_email || "N/A"}</td>

                    <td>
                      {report.reported_property ? (
                        <div className="report-property-cell">
                          <strong
                            className="clickable-link"
                            onClick={() =>
                              navigate(`/detail/${report.reported_property}`)
                            }
                          >
                            {getPropertyDisplayName(report)}
                          </strong>
                          <span>{getPropertyLocation(report)}</span>
                          <small>ID: {report.reported_property}</small>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>

                    <td>
                      {report.reported_property ? (
                        <div className="report-owner-cell">
                          <strong>{report.owner_name || "N/A"}</strong>
                          <span>{report.owner_phone || "No phone"}</span>
                          <small>{report.owner_email || "No email"}</small>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>

                    <td>{report.reported_user || "N/A"}</td>

                    <td>{report.reported_booking || "N/A"}</td>

                    <td>
                      <span
                        className={`report-status ${getStatusClass(
                          report.status
                        )}`}
                      >
                        {getStatusLabel(report.status)}
                      </span>
                    </td>

                    <td>
                      <span className={getPropertyModerationClass(report)}>
                        {getPropertyModerationLabel(report)}
                      </span>
                    </td>

                    <td>
                      <div className="report-actions">
                        <button
                          type="button"
                          className="report-action-btn reviewing"
                          onClick={() =>
                            handleStatusUpdate(report.id, "reviewing")
                          }
                          disabled={
                            isUpdatingThisReport ||
                            report.status === "reviewing"
                          }
                        >
                          {isUpdatingThisReport ? "Updating..." : "Reviewing"}
                        </button>

                        <button
                          type="button"
                          className="report-action-btn resolved"
                          onClick={() =>
                            handleStatusUpdate(report.id, "resolved")
                          }
                          disabled={
                            isUpdatingThisReport || report.status === "resolved"
                          }
                        >
                          {isUpdatingThisReport ? "Updating..." : "Resolve"}
                        </button>

                        <button
                          type="button"
                          className="report-action-btn dismissed"
                          onClick={() =>
                            handleStatusUpdate(report.id, "dismissed")
                          }
                          disabled={
                            isUpdatingThisReport ||
                            report.status === "dismissed"
                          }
                        >
                          {isUpdatingThisReport ? "Updating..." : "Dismiss"}
                        </button>

                        {report.reported_property && (
                          <>
                            <button
                              type="button"
                              className="report-action-btn view"
                              onClick={() =>
                                navigate(`/detail/${report.reported_property}`)
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="report-action-btn danger"
                              onClick={() => openHideConfirm(report)}
                              disabled={
                                isModeratingThisProperty || listingAlreadyHidden
                              }
                            >
                              {isModeratingThisProperty
                                ? "Hiding..."
                                : listingAlreadyHidden
                                ? "Hidden"
                                : "Hide Listing"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                    <td>{formatDate(report.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmModalOpen && selectedReportForModeration && (
        <div className="report-modal-backdrop" onClick={closeHideConfirm}>
          <div
            className="report-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="report-confirm-icon">!</div>
            <h3>Hide Property Listing</h3>

            <p>
              Are you sure you want to remove this property from public listings?
            </p>

            <p className="report-confirm-subtext">
              This will hide the listing from users and keep it out of featured
              and public property lists until it is reviewed and restored.
            </p>

            <div className="report-confirm-actions">
              <button
                type="button"
                className="report-confirm-cancel"
                onClick={closeHideConfirm}
                disabled={!!moderatingPropertyId}
              >
                Cancel
              </button>

              <button
                type="button"
                className="report-confirm-danger"
                onClick={handleHideListing}
                disabled={!!moderatingPropertyId}
              >
                {moderatingPropertyId ? "Hiding..." : "Yes, Hide Listing"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReport;