import React from "react";
import "./ConfirmModal.css";

const ErrorModal = ({ title = "Submission Failed", message, onClose }) => {
  return (
    <div className="error-modal-overlay" onClick={onClose}>
      <div
        className="error-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="error-icon-wrap">
          <div className="error-icon-circle">!</div>
        </div>

        <h2>{title}</h2>
        <p>{message}</p>

        <button className="error-modal-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default ErrorModal;