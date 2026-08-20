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

  // Tracks the individual report currently being updated.
  const [updatingReportId, setUpdatingReportId] = useState(null);


  useEffect(() => {
    fetchReports();
  }, []);


  // Applies the selected report-status filter locally.
  const filteredReports = useMemo(() => {
    if (statusFilter === "all") {
      return reports;
    }

    return reports.filter(
      (report) => report.status === statusFilter
    );
  }, [reports, statusFilter]);


  // Loads all reports available to the authenticated administrator.
  const fetchReports = async () => {
    try {
      setLoading(true);
      setApiError("");

      const res = await api.get(
        "/reports/admin/"
      );

      const data = res.data;

      const reportList = Array.isArray(data)
        ? data
        : data.results || [];

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


  // Updates the report itself.
  // The backend then recalculates the related property's moderation state.
  const handleStatusUpdate = async (
    reportId,
    newStatus
  ) => {
    try {
      setUpdatingReportId(reportId);
      setApiError("");

      await api.patch(
        `/reports/admin/${reportId}/`,
        {
          status: newStatus,
        }
      );

      // Reload so report status, property moderation state,
      // report count, and reason summary stay synchronized.
      await fetchReports();
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Failed to update report status.";

      setApiError(msg);
    } finally {
      setUpdatingReportId(null);
    }
  };


  // Returns the CSS class for a report's admin-review status.
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


  // Converts backend report statuses into readable labels.
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


  // Converts report category codes into readable labels.
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


  // Converts the property's moderation status into an admin-facing label.
  const getPropertyModerationLabel = (report) => {
    const moderationStatus =
      report.report_flag_status;

    switch (moderationStatus) {
      case "hidden":
        return "Hidden";

      case "flagged":
        return "Flagged";

      case "reviewing":
        return "Under Review";

      case "resolved":
        return "Resolved";

      case "active":
        return "Active";

      default:
        return "Active";
    }
  };


  // Returns the existing CSS badge class for property moderation.
  const getPropertyModerationClass = (report) => {
    const moderationStatus =
      report.report_flag_status;

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


  // Formats backend timestamps for the reports table.
  const formatDate = (value) => {
    if (!value) {
      return "N/A";
    }

    return new Date(value).toLocaleDateString();
  };


  // Provides a safe property name fallback.
  const getPropertyDisplayName = (report) => {
    if (report.property_name) {
      return report.property_name;
    }

    if (report.reported_property) {
      return `Property #${report.reported_property}`;
    }

    return "N/A";
  };


  // Builds the property location from available city/region data.
  const getPropertyLocation = (report) => {
    const location = [
      report.property_city,
      report.property_region,
    ]
      .filter(Boolean)
      .join(", ");

    return location || "Location not available";
  };


  return (
    <div className="admin-reports-page">

      {/* Page header and report-status filter. */}
      <div className="admin-reports-header">
        <div>
          <h2>Reports Management</h2>

          <p>
            View and manage all reports submitted by users.
          </p>
        </div>

        <div className="admin-reports-filter">
          <label htmlFor="statusFilter">
            Filter by Status
          </label>

          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="all">
              All Reports
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="reviewing">
              Under Review
            </option>

            <option value="resolved">
              Resolved
            </option>

            <option value="dismissed">
              Dismissed
            </option>
          </select>
        </div>
      </div>


      {/* Loading state. */}
      {loading && (
        <div className="reports-state">
          Loading reports...
        </div>
      )}


      {/* API error state. */}
      {!loading && apiError && (
        <div className="reports-state error">
          {apiError}
        </div>
      )}


      {/* Empty state. */}
      {!loading &&
        !apiError &&
        filteredReports.length === 0 && (
          <div className="reports-state">
            No reports found.
          </div>
        )}


      {/* Reports table. */}
      {!loading &&
        !apiError &&
        filteredReports.length > 0 && (
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
                {filteredReports.map(
                  (report, index) => {
                    const isUpdatingThisReport =
                      updatingReportId === report.id;

                    return (
                      <tr
                        key={report.id}
                        className={
                          report.category === "scam"
                            ? "report-row-danger"
                            : ""
                        }
                      >

                        {/* Row number. */}
                        <td>
                          {index + 1}
                        </td>


                        {/* Report subject and description. */}
                        <td>
                          <div className="report-subject-cell">
                            <strong>
                              {report.subject}
                            </strong>

                            <span>
                              {report.description}
                            </span>
                          </div>
                        </td>


                        {/* Report category. */}
                        <td>
                          {getCategoryLabel(
                            report.category
                          )}
                        </td>


                        {/* Reporting user. */}
                        <td>
                          {report.reported_by_username ||
                            "Unknown"}
                        </td>


                        {/* Reporter contact email. */}
                        <td>
                          {report.contact_email ||
                            "N/A"}
                        </td>


                        {/* Reported property. */}
                        <td>
                          {report.reported_property ? (
                            <div className="report-property-cell">

                              <strong
                                className="clickable-link"
                                onClick={() =>
                                  navigate(
                                    `/detail/${report.reported_property}`
                                  )
                                }
                              >
                                {getPropertyDisplayName(
                                  report
                                )}
                              </strong>

                              <span>
                                {getPropertyLocation(
                                  report
                                )}
                              </span>

                              <small>
                                ID:{" "}
                                {report.reported_property}
                              </small>

                              {/* Shows the current valid report count. */}
                              <small>
                                Reports:{" "}
                                {report.reported_count ??
                                  0}
                              </small>

                              {/* Shows the backend-generated reason summary. */}
                              {report.report_flag_reason_summary && (
                                <small>
                                  Reasons:{" "}
                                  {
                                    report.report_flag_reason_summary
                                  }
                                </small>
                              )}

                            </div>
                          ) : (
                            "N/A"
                          )}
                        </td>


                        {/* Property owner information. */}
                        <td>
                          {report.reported_property ? (
                            <div className="report-owner-cell">
                              <strong>
                                {report.owner_name ||
                                  "N/A"}
                              </strong>

                              <span>
                                {report.owner_phone ||
                                  "No phone"}
                              </span>

                              <small>
                                {report.owner_email ||
                                  "No email"}
                              </small>
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </td>


                        {/* Directly reported user, when applicable. */}
                        <td>
                          {report.reported_user ||
                            "N/A"}
                        </td>


                        {/* Directly reported booking, when applicable. */}
                        <td>
                          {report.reported_booking ||
                            "N/A"}
                        </td>


                        {/* Individual report status. */}
                        <td>
                          <span
                            className={`report-status ${getStatusClass(
                              report.status
                            )}`}
                          >
                            {getStatusLabel(
                              report.status
                            )}
                          </span>
                        </td>


                        {/* Current property moderation state. */}
                        <td>
                          <span
                            className={getPropertyModerationClass(
                              report
                            )}
                          >
                            {getPropertyModerationLabel(
                              report
                            )}
                          </span>
                        </td>


                        {/* Admin actions. */}
                        <td>
                          <div className="report-actions">

                            {/* Marks this report as being actively reviewed. */}
                            <button
                              type="button"
                              className="report-action-btn reviewing"
                              onClick={() =>
                                handleStatusUpdate(
                                  report.id,
                                  "reviewing"
                                )
                              }
                              disabled={
                                isUpdatingThisReport ||
                                report.status ===
                                  "reviewing"
                              }
                            >
                              {isUpdatingThisReport
                                ? "Updating..."
                                : "Reviewing"}
                            </button>


                            {/* Resolves a valid report.
                                The backend recalculates the property automatically. */}
                            <button
                              type="button"
                              className="report-action-btn resolved"
                              onClick={() =>
                                handleStatusUpdate(
                                  report.id,
                                  "resolved"
                                )
                              }
                              disabled={
                                isUpdatingThisReport ||
                                report.status ===
                                  "resolved"
                              }
                            >
                              {isUpdatingThisReport
                                ? "Updating..."
                                : "Resolve"}
                            </button>


                            {/* Dismisses an invalid/unsubstantiated report.
                                Dismissed reports no longer count against the property. */}
                            <button
                              type="button"
                              className="report-action-btn dismissed"
                              onClick={() =>
                                handleStatusUpdate(
                                  report.id,
                                  "dismissed"
                                )
                              }
                              disabled={
                                isUpdatingThisReport ||
                                report.status ===
                                  "dismissed"
                              }
                            >
                              {isUpdatingThisReport
                                ? "Updating..."
                                : "Dismiss"}
                            </button>


                            {/* Opens the property for inspection.
                                Property moderation itself remains backend-controlled. */}
                            {report.reported_property && (
                              <button
                                type="button"
                                className="report-action-btn view"
                                onClick={() =>
                                  navigate(
                                    `/detail/${report.reported_property}`
                                  )
                                }
                              >
                                View
                              </button>
                            )}

                          </div>
                        </td>


                        {/* Report submission date. */}
                        <td>
                          {formatDate(
                            report.created_at
                          )}
                        </td>

                      </tr>
                    );
                  }
                )}
              </tbody>

            </table>
          </div>
        )}

    </div>
  );
};


export default AdminReport;