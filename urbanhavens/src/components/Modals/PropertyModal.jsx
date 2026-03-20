import React from "react";
import { FaTimes } from "react-icons/fa";
import "./PropertyModal.css";

const PropertyModal = ({ property, onClose, onApprove, onReject, onDelete }) => {
  if (!property) return null;

  return (
    <div className="property-modal-overlay" onClick={onClose}>
      <div
        className="property-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="property-modal-header">
          <h2>{property.title}</h2>
          <button className="property-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="property-modal-body">
          {property.images && property.images.length > 0 && (
            <div className="property-modal-image-grid">
              {property.images.map((image, index) => (
                <div className="property-modal-image-card" key={index}>
                  <img
                    src={image}
                    alt={`${property.title} ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="property-modal-details-grid">
            <p><strong>Owner:</strong> {property.owner}</p>
            <p><strong>Location:</strong> {property.location}</p>
            <p><strong>Price:</strong> {property.price}</p>
            <p><strong>Status:</strong> {property.status}</p>
            <p><strong>Category:</strong> {property.category}</p>
            <p><strong>Type:</strong> {property.propertyType}</p>
            <p><strong>Bedrooms:</strong> {property.bedrooms}</p>
            <p><strong>Bathrooms:</strong> {property.bathrooms}</p>
            <p>
              <strong>Availability:</strong>{" "}
              {property.available ? "Available" : "Not Available"}
            </p>
          </div>

          <div className="property-modal-section">
            <h4>Description</h4>
            <p>{property.description}</p>
          </div>

          <div className="property-modal-section">
            <h4>Amenities</h4>
            <div className="property-modal-amenities">
              {property.amenities?.map((item, index) => (
                <span key={index} className="property-modal-amenity-badge">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="property-modal-actions">
          <button className="property-approve-btn" onClick={() => onApprove?.(property)}>
            Approve
          </button>
          <button className="property-reject-btn" onClick={() => onReject?.(property)}>
            Reject
          </button>
          <button className="property-delete-btn" onClick={() => onDelete?.(property)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyModal;