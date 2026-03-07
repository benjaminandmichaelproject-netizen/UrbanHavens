import "./AgreementModal.css";
import { Link } from "react-router-dom";

const AgreementModal = ({ isOpen, onClose, rental, onAccept }) => {
  if (!isOpen || !rental) return null;

  const handleAccept = () => {
    onAccept(rental);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">

        <div className="modal-header">
          <h2>Tenancy Agreement</h2>
          <span className="close-btn" onClick={onClose}>×</span>
        </div>

        <div className="terms-box">
          <h3>Key Terms & Conditions:</h3>
          <ul>
            <li>Full payment required before rental commencement</li>
            <li>Reservation confirmed upon payment verification</li>
            <li>Cancellations 24hrs before = 10% fee</li>
            <li>Cancellations within 24hrs = 40% fee</li>
            <li>After rental begins, payment is non-refundable</li>
            <li>All damages are tenant's responsibility</li>
            <li>No smoking or illegal activity</li>
          </ul>
        </div>

        <div className="complete-terms-card">
          <div className="terms-icon">↗</div>

          <div className="terms-content">
            <h4>Complete Terms & Conditions</h4>
            <Link
              to={`/terms/${rental.id}`}
              className="terms-link"
              onClick={onClose}
            >
              Terms & Conditions ↗
            </Link>
          </div>
        </div>

        <div className="selected-vehicle">
          Selected Property: {rental.title}
        </div>

        <div className="modal-actions">
          <button className="decline" onClick={onClose}>
            I Decline
          </button>

          <button className="accept" onClick={handleAccept}>
            I Accept & Continue
          </button>
        </div>

      </div>
    </div>
  );
};

export default AgreementModal;