import React from "react";
import "./OwnerDashboard.css";
import MyProperties from "../MyProperties/MyProperties";
const OwnerDashboard = () => {
  return (
    <div className="owner-dashboard">

      {/* HERO SECTION */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <h2>Welcome!</h2>
          <p>
            Manage your properties and track everything in one place.
          </p>
          <button className="hero-btn">Learn How It Works</button>
        </div>
      </div>

      {/* ACTION CARDS */}
      <div className="dashboard-actions">
        <div className="action-card">
          <h4>Invite Landlords</h4>
          <p>Send invitations to property owners</p>
        </div>

        <div className="action-card">
          <h4>Create Property</h4>
          <p>Add a new property to the system</p>
        </div>

        <div className="action-card">
          <h4>Create Contract</h4>
          <p>Start a rental agreement</p>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="dashboard-table">
       

         <MyProperties/>
      </div>

    </div>
  );
};

export default OwnerDashboard;