import React, { useEffect, useState } from "react";
import { api } from "../Owner/UploadDetails/api/api.js";
import "./Report.css";

const AdminReport = () => {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredReports.map((report, index) => (
                <tr key={report.id}>
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
                        <strong>{getPropertyDisplayName(report)}</strong>
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

                  <td>{formatDate(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminReport;