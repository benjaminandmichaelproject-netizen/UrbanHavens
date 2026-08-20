import React from "react";
import { FaTimes } from "react-icons/fa";
import "./PropertyModal.css";

const PropertyModal = ({ property, onClose, onApprove, onReject, onDelete }) => {
  if (!property) return null;

  // Supports both the raw backend field and any camelCase field used by
  // existing admin transformations without changing the modal contract.
  const apartmentListingType =
    property.apartment_listing_type ??
    property.apartmentListingType ??
    null;

  const isMultiUnitApartment =
    property.category === "apartment" &&
    apartmentListingType === "multi_unit";

  const displayPrice = isMultiUnitApartment
    ? property.starting_price ?? property.startingPrice
    : property.price;

  const hasPrice =
    displayPrice !== null &&
    displayPrice !== undefined &&
    displayPrice !== "";

  // Avoids adding a second GHS prefix when an existing transformation
  // has already formatted the value before opening this shared modal.
  const getPriceDisplay = () => {
    if (!hasPrice) {
      return isMultiUnitApartment
        ? "Unit pricing unavailable"
        : "N/A";
    }

    const raw = String(displayPrice).trim();
    const numericValue = Number(raw);
    const value = Number.isFinite(numericValue)
      ? numericValue.toLocaleString()
      : raw;
    const withCurrency = /^GHS\b/i.test(raw) ? raw : `GHS ${value}`;

    return `${isMultiUnitApartment ? "From " : ""}${withCurrency}`;
  };

  const title = property.title ?? property.property_name ?? "Property";
  const owner = property.owner ?? property.owner_name ?? "N/A";
  const location =
    property.location ??
    [property.city, property.region].filter(Boolean).join(", ") ??
    "N/A";

  const typeDisplay =
    property.category === "apartment"
      ? apartmentListingType === "multi_unit"
        ? "Multi-unit Apartment"
        : "Single Apartment"
      : property.propertyType ?? property.property_type ?? "N/A";

  const bedroomsDisplay = isMultiUnitApartment
    ? "Set per unit"
    : property.bedrooms ?? "N/A";

  const bathroomsDisplay = isMultiUnitApartment
    ? "Set per unit"
    : property.bathrooms ?? "N/A";

  const availability =
    typeof property.available === "boolean"
      ? property.available
      : property.is_available;

  const images = Array.isArray(property.images) ? property.images : [];
  const amenities = Array.isArray(property.amenities)
    ? property.amenities
    : [];

  const getImageUrl = (image) => {
    if (typeof image === "string") return image;
    return image?.image || image?.url || "";
  };

  return (
    <div className="property-modal-overlay" onClick={onClose}>
      <div
        className="property-modal-content"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="property-modal-header">
          <h2>{title}</h2>
          <button
            className="property-modal-close"
            onClick={onClose}
            aria-label="Close property details"
          >
            <FaTimes />
          </button>
        </div>

        <div className="property-modal-body">
          {images.length > 0 && (
            <div className="property-modal-image-grid">
              {images.map((image, index) => {
                const imageUrl = getImageUrl(image);

                if (!imageUrl) return null;

                return (
                  <div className="property-modal-image-card" key={index}>
                    <img
                      src={imageUrl}
                      alt={`${title} ${index + 1}`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="property-modal-details-grid">
            <p>
              <strong>Owner:</strong> {owner}
            </p>
            <p>
              <strong>Location:</strong> {location || "N/A"}
            </p>
            <p>
              <strong>Price:</strong> {getPriceDisplay()}
            </p>
            <p>
              <strong>Status:</strong> {property.status ?? "N/A"}
            </p>
            <p>
              <strong>Category:</strong> {property.category ?? "N/A"}
            </p>
            <p>
              <strong>Type:</strong> {typeDisplay}
            </p>
            <p>
              <strong>Bedrooms:</strong> {bedroomsDisplay}
            </p>
            <p>
              <strong>Bathrooms:</strong> {bathroomsDisplay}
            </p>
            <p>
              <strong>Availability:</strong>{" "}
              {typeof availability === "boolean"
                ? availability
                  ? "Available"
                  : "Not Available"
                : "N/A"}
            </p>
          </div>

          <div className="property-modal-section">
            <h4>Description</h4>
            <p>{property.description || "No description available."}</p>
          </div>

          <div className="property-modal-section">
            <h4>Amenities</h4>
            <div className="property-modal-amenities">
              {amenities.length > 0 ? (
                amenities.map((item, index) => (
                  <span key={index} className="property-modal-amenity-badge">
                    {item}
                  </span>
                ))
              ) : (
                <span>No amenities listed.</span>
              )}
            </div>
          </div>
        </div>

        <div className="property-modal-actions">
          <button
            className="property-approve-btn"
            onClick={() => onApprove?.(property)}
          >
            Approve
          </button>
          <button
            className="property-reject-btn"
            onClick={() => onReject?.(property)}
          >
            Reject
          </button>
          <button
            className="property-delete-btn"
            onClick={() => onDelete?.(property)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyModal;