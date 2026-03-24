import React, { useEffect, useState } from "react";
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

      const access = localStorage.getItem("access");

      if (!access) {
        setApiError("No access token found. Please log in again.");
        setLoading(false);
        return;
      }

      const response = await fetch("http://127.0.0.1:8000/api/reports/admin/", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || "Failed to fetch reports."
        );
      }

    const reportList = Array.isArray(data) ? data : data.results || [];
setReports(reportList);
setFilteredReports(reportList);
    } catch (error) {
      setApiError(error.message || "Something went wrong while fetching reports.");
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
        return category;
    }
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
                  <td>{report.reported_property || "N/A"}</td>
                  <td>{report.reported_user || "N/A"}</td>
                  <td>{report.reported_booking || "N/A"}</td>
                  <td>
                    <span className={`report-status ${getStatusClass(report.status)}`}>
                      {report.status}
                    </span>
                  </td>
                  <td>
                    {report.created_at
                      ? new Date(report.created_at).toLocaleDateString()
                      : "N/A"}
                  </td>
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