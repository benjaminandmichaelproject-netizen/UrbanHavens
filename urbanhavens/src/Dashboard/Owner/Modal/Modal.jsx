// Owner/Modal/Modal.jsx
import React from "react";
import "./modal.css";

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="owner-modal-overlay" onClick={onClose}>
      <div
        className="owner-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="owner-modal-close" onClick={onClose}>
          ×
        </button>

        {children}
      </div>
    </div>
  );
};

export default Modal;