import React from "react";
import {
  FaUsers,
  FaHome,
  FaCalendarCheck,
  FaClipboardCheck,
  FaArrowUp,
} from "react-icons/fa";
import "./AdminDashboard.css";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  const stats = [
    {
      title: "Total Users",
      value: 245,
      icon: <FaUsers />,
      note: "+12 this week",
    },
    {
      title: "Total Properties",
      value: 128,
      icon: <FaHome />,
      note: "+8 new listings",
    },
    {
      title: "Bookings",
      value: 64,
      icon: <FaCalendarCheck />,
      note: "+5 today",
    },
    {
      title: "Pending Approvals",
      value: 17,
      icon: <FaClipboardCheck />,
      note: "Needs review",
    },
  ];

  const activities = [
    "New owner account registered",
    "2 new properties submitted for approval",
    "Booking confirmed for East Legon apartment",
    "Admin updated listing status",
    "Tenant reported a property issue",
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>
            Welcome back. Here’s an overview of the UrbanHavens platform.
          </p>
        </div>

        <div className="action-btn">
          <button className="admin-action-btn">
          <FaArrowUp />
          <span>Generate Report</span>
        </button>
        <button
  className="admin-action-btn"
  onClick={() => navigate("/dashboard/admin/add-property")}
>
  <FaArrowUp />
  <span>Add Property</span>
</button>
        </div>
      </div>

      <div className="admin-stats-grid">
        {stats.map((item, index) => (
          <div className="admin-stat-card" key={index}>
            <div className="admin-stat-top">
              <div className="admin-stat-icon">{item.icon}</div>
              <h3>{item.title}</h3>
            </div>
            <h2>{item.value}</h2>
            <p>{item.note}</p>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-bottom">
        <div className="admin-panel admin-activity-panel">
          <h3>Recent Activity</h3>
          <ul>
            {activities.map((activity, index) => (
              <li key={index}>{activity}</li>
            ))}
          </ul>
        </div>

        <div className="admin-panel admin-actions-panel">
          <h3>Quick Actions</h3>
          <div className="admin-quick-actions">
            <button>Manage Users</button>
            <button>View Properties</button>
            <button>Review Approvals</button>
            <button>Check Bookings</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;