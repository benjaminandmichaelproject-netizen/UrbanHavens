import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../Owner/UploadDetails/api/api.js";
import "./Report.css";

const AdminReport = () => {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [disablingPropertyId, setDisablingPropertyId] = useState(null);
const [confirmModalOpen, setConfirmModalOpen] = useState(false);
const [selectedPropertyToDisable, setSelectedPropertyToDisable] = useState(null);
  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (statusFilter === "all") {
      setFilteredReports(reports);
    } else {
      setFilteredReports(
        reports.filter((report) => report.status === statusFilter)
      );
    }
  }, [reports, statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setApiError("");

      const res = await api.get("/reports/admin/");
      const data = res.data;
      const reportList = Array.isArray(data) ? data : data.results || [];
      setReports(reportList);
      setFilteredReports(reportList);
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
      setUpdatingId(reportId);
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
      setUpdatingId(null);
    }
  };

const openDisableConfirm = (propertyId) => {
  setSelectedPropertyToDisable(propertyId);
  setConfirmModalOpen(true);
};

const closeDisableConfirm = () => {
  if (disablingPropertyId) return;
  setConfirmModalOpen(false);
  setSelectedPropertyToDisable(null);
};

const handleDisableProperty = async () => {
  if (!selectedPropertyToDisable) return;

  try {
    setDisablingPropertyId(selectedPropertyToDisable);
    setApiError("");

    await api.patch(`/properties/${selectedPropertyToDisable}/`, {
      is_available: false,
    });

    closeDisableConfirm();
    await fetchReports();
  } catch (err) {
    const msg =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      "Failed to disable property.";
    setApiError(msg);
  } finally {
    setDisablingPropertyId(null);
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
                <th>Status</th>
                <th>Actions</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredReports.map((report, index) => {
                const isUpdatingThisReport = updatingId === report.id;
                const isDisablingThisProperty =
                  disablingPropertyId === report.reported_property;

                return (
                  <tr
                    key={report.id}
                    className={report.category === "scam" ? "report-row-danger" : ""}
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
                            onClick={() =>navigate(`/detail/${report.reported_property}`)}
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
                        className={`report-status ${getStatusClass(report.status)}`}
                      >
                        {getStatusLabel(report.status)}
                      </span>
                    </td>

                    <td>
                      <div className="report-actions">
                        <button
                          type="button"
                          className="report-action-btn reviewing"
                          onClick={() => handleStatusUpdate(report.id, "reviewing")}
                          disabled={
                            isUpdatingThisReport || report.status === "reviewing"
                          }
                        >
                          {isUpdatingThisReport ? "Updating..." : "Reviewing"}
                        </button>

                        <button
                          type="button"
                          className="report-action-btn resolved"
                          onClick={() => handleStatusUpdate(report.id, "resolved")}
                          disabled={
                            isUpdatingThisReport || report.status === "resolved"
                          }
                        >
                          {isUpdatingThisReport ? "Updating..." : "Resolve"}
                        </button>

                        <button
                          type="button"
                          className="report-action-btn dismissed"
                          onClick={() => handleStatusUpdate(report.id, "dismissed")}
                          disabled={
                            isUpdatingThisReport || report.status === "dismissed"
                          }
                        >
                          {isUpdatingThisReport ? "Updating..." : "Dismiss"}
                        </button>

                        {report.reported_property && (
                          <>
                            <button
                              type="button"
                              className="report-action-btn view"
                              onClick={() => navigate(`/detail/${report.reported_property}`)}
                            >
                              View
                            </button>

                           <button
  type="button"
  className="report-action-btn danger"
  onClick={() => openDisableConfirm(report.reported_property)}
  disabled={isDisablingThisProperty}
>
  {isDisablingThisProperty ? "Disabling..." : "Disable"}
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

      {confirmModalOpen && (
        <div className="report-modal-backdrop" onClick={closeDisableConfirm}>
          <div
            className="report-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="report-confirm-icon">!</div>
            <h3>Disable Property</h3>
            <p>
              Are you sure you want to disable this property listing?
            </p>
            <p className="report-confirm-subtext">
              This will make the property unavailable to users.
            </p>

            <div className="report-confirm-actions">
              <button
                type="button"
                className="report-confirm-cancel"
                onClick={closeDisableConfirm}
                disabled={!!disablingPropertyId}
              >
                Cancel
              </button>

              <button
                type="button"
                className="report-confirm-danger"
                onClick={handleDisableProperty}
                disabled={!!disablingPropertyId}
              >
                {disablingPropertyId ? "Disabling..." : "Yes, Disable"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminReport;