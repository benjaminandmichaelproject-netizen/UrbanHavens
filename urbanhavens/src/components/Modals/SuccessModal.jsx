import React from "react";
import "./PropertyModal.css";

const SuccessModal = ({ title, message, buttonText = "OK", onClose }) => {
  return (
    <div className="success-modal-overlay" onClick={onClose}>
      <div
        className="success-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="success-icon-wrap">
          <div className="success-icon-circle">✓</div>
        </div>

        <h2>{title}</h2>
        <p>{message}</p>

        <button className="success-modal-btn" onClick={onClose}>
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default SuccessModal;