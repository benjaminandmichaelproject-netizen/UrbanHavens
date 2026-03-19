import React from "react";
import { FaHome } from "react-icons/fa";
import "./NoPropertyUploaded.css";

const NoPropertyUploaded = ({ onAddProperty }) => {
  return (
    <div className="no-property-wrapper">
      <div className="no-property-illustration">
        <div className="ghost-card ghost-back">
          <div className="ghost-icon"><FaHome /></div>
          <div className="ghost-lines">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <div className="ghost-card ghost-front">
          <div className="ghost-icon"><FaHome /></div>
          <div className="ghost-lines">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        <div className="ghost-card ghost-bottom">
          <div className="ghost-icon"><FaHome /></div>
          <div className="ghost-lines">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      <h2>No Properties</h2>
      <p>Add your first property by clicking below</p>

      <button className="add-property-btn" onClick={onAddProperty}>
        + Add New Property
      </button>
    </div>
  );
};

export default NoPropertyUploaded;