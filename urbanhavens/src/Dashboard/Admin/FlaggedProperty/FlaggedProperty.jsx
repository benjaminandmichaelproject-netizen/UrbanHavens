import React, { useEffect, useMemo, useState } from "react";

import {
  FaEye,
  FaCheck,
  FaTimes,
  FaTrash,
  FaSyncAlt,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaShieldAlt,
  FaImage,
} from "react-icons/fa";

import "./FlaggedProperty.css";

// Reuses the same authenticated Axios client already used by the owner dashboard.
import { api } from "../../Owner/UploadDetails/api/api";

// Identifies apartment buildings whose bedrooms, bathrooms and rent
// belong to ApartmentUnit records rather than the parent Property.
const isMultiUnitApartment = (property) =>
  property?.category === "apartment" &&
  property?.apartment_listing_type === "multi_unit";

// Displays the correct rent without turning a null multi-unit parent price into GHS 0.
const getPropertyDisplayPrice = (property) => {
  const isMultiUnit = isMultiUnitApartment(property);
  const value = isMultiUnit ? property?.starting_price : property?.price;

  if (value === null || value === undefined || value === "") {
    return isMultiUnit ? "Unit pricing unavailable" : "N/A";
  }

  const numericValue = Number(value);
  const formattedValue = Number.isFinite(numericValue)
    ? numericValue.toLocaleString()
    : String(value);

  return `${isMultiUnit ? "From " : ""}GHS ${formattedValue}`;
};

// Keeps parent-level specifications honest for multi-unit apartment buildings.
const getBedroomsDisplay = (property) =>
  isMultiUnitApartment(property)
    ? "Beds per unit"
    : property?.bedrooms ?? "N/A";

const getBathroomsDisplay = (property) =>
  isMultiUnitApartment(property)
    ? "Baths per unit"
    : property?.bathrooms ?? "N/A";

// Converts raw backend category/listing values into a readable admin label.
const getPropertyTypeDisplay = (property) => {
  if (property?.category === "apartment") {
    return property?.apartment_listing_type === "multi_unit"
      ? "Multi-unit Apartment"
      : "Single Apartment";
  }

  return property?.property_type || "N/A";
};

const FlaggedProperty = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [search, setSearch] = useState("");

  // Loads only security-flagged properties from the existing admin endpoint.
  const fetchFlaggedProperties = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/properties/admin-list/");
      const data = response.data;
      const results = Array.isArray(data) ? data : data.results || [];

      const flaggedOnly = results.filter(
        (property) => property.security_flagged === true
      );

      setProperties(flaggedOnly);
    } catch (requestError) {
      console.error(requestError);
      setError(
        requestError.response?.data?.detail ||
          requestError.message ||
          "Something went wrong while fetching flagged properties."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlaggedProperties();
  }, []);

  // Preserves the existing approve moderation action.
  const handleApprove = async (propertyId) => {
    try {
      setActionLoading(`approve-${propertyId}`);

      await api.post(`/properties/${propertyId}/approve/`);
      await fetchFlaggedProperties();

      if (selectedProperty?.id === propertyId) {
        setSelectedProperty(null);
      }

      setConfirmAction(null);
    } catch (requestError) {
      console.error(requestError);
      alert(requestError.response?.data?.detail || "Approve failed.");
    } finally {
      setActionLoading(null);
    }
  };

  // Preserves the existing reject moderation action.
  const handleReject = async (propertyId) => {
    try {
      setActionLoading(`reject-${propertyId}`);

      await api.post(`/properties/${propertyId}/reject/`);
      await fetchFlaggedProperties();

      if (selectedProperty?.id === propertyId) {
        setSelectedProperty(null);
      }

      setConfirmAction(null);
    } catch (requestError) {
      console.error(requestError);
      alert(requestError.response?.data?.detail || "Reject failed.");
    } finally {
      setActionLoading(null);
    }
  };

  // Preserves the existing permanent-delete action.
  const handleDelete = async (propertyId) => {
    try {
      setActionLoading(`delete-${propertyId}`);

      await api.delete(`/properties/${propertyId}/`);
      await fetchFlaggedProperties();

      if (selectedProperty?.id === propertyId) {
        setSelectedProperty(null);
      }

      setConfirmAction(null);
    } catch (requestError) {
      console.error(requestError);
      alert(requestError.response?.data?.detail || "Delete failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return properties;

    return properties.filter((property) =>
      [
        property.property_name,
        property.owner_name,
        property.owner_email,
        property.owner_phone,
        property.city,
        property.region,
        property.security_flag_reason,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [properties, search]);

  // Returns the first property image while keeping the existing placeholder fallback.
  const firstImage = (property) => {
    if (property?.images?.length > 0) {
      const image = property.images[0];
      return typeof image === "string" ? image : image?.image || image?.url;
    }

    return "https://via.placeholder.com/300x220?text=No+Image";
  };

  return (
    <div className="flagged-property-page">
      <div className="flagged-header">
        <div>
          <h2>Flagged Properties</h2>
          <p>
            Review suspicious listings, inspect owner details, and take action.
          </p>
        </div>

        <div className="flagged-header-actions">
          <input
            type="text"
            placeholder="Search flagged properties..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="flagged-search"
          />

          <button className="refresh-btn" onClick={fetchFlaggedProperties}>
            <FaSyncAlt /> Refresh
          </button>
        </div>
      </div>

      <div className="flagged-stats">
        <div className="flagged-stat-card">
          <span>Total Flagged</span>
          <strong>{properties.length}</strong>
        </div>

        <div className="flagged-stat-card warning">
          <span>Showing</span>
          <strong>{filteredProperties.length}</strong>
        </div>
      </div>

      {loading ? (
        <div className="flagged-empty">Loading flagged properties...</div>
      ) : error ? (
        <div className="flagged-empty error">{error}</div>
      ) : filteredProperties.length === 0 ? (
        <div className="flagged-empty">No flagged properties found.</div>
      ) : (
        <div className="flagged-grid">
          {filteredProperties.map((property) => (
            <div className="flagged-card" key={property.id}>
              <div className="flagged-card-image-wrap">
                <img
                  src={firstImage(property)}
                  alt={property.property_name}
                  className="flagged-card-image"
                />

                <div className="flagged-badge">
                  <FaExclamationTriangle /> Flagged
                </div>
              </div>

              <div className="flagged-card-body">
                <div className="flagged-card-top">
                  <h3>{property.property_name}</h3>
                  <span className="flagged-price">
                    {getPropertyDisplayPrice(property)}
                  </span>
                </div>

                <p className="flagged-location">
                  <FaMapMarkerAlt /> {property.city}, {property.region}
                </p>

                <div className="flagged-owner-box">
                  <p>
                    <FaUser /> <strong>{property.owner_name || "No owner name"}</strong>
                  </p>
                  <p>
                    <FaEnvelope /> {property.owner_email || "No email"}
                  </p>
                  <p>
                    <FaPhone /> {property.owner_phone || "No phone"}
                  </p>
                </div>

                <div className="flagged-alert-box">
                  <p className="flagged-alert-title">
                    <FaShieldAlt /> Alert Reason
                  </p>
                  <p className="flagged-alert-text">
                    {property.security_flag_reason ||
                      "Property flagged for review."}
                  </p>
                </div>

                {property.duplicate_matches?.length > 0 && (
                  <div className="flagged-match-preview">
                    <p>
                      <strong>Top Match:</strong>{" "}
                      {property.duplicate_matches[0]?.matched_property_name ||
                        "Matched property"}
                    </p>
                    <p>
                      <strong>Reason:</strong>{" "}
                      {property.duplicate_matches[0]?.match_reason ||
                        "Possible duplicate match"}
                    </p>
                    <p>
                      <strong>Score:</strong>{" "}
                      {property.duplicate_matches[0]?.match_score ?? "-"}
                    </p>
                  </div>
                )}

                <div className="flagged-meta-row">
                  <span>{property.category}</span>
                  <span>{getBedroomsDisplay(property)}</span>
                  <span>{getBathroomsDisplay(property)}</span>
                  <span>
                    {property.images?.length || 0} <FaImage />
                  </span>
                </div>

                <div className="flagged-actions">
                  <button
                    className="action-btn view"
                    onClick={() => setSelectedProperty(property)}
                  >
                    <FaEye /> View Full
                  </button>

                  <button
                    className="action-btn approve"
                    onClick={() =>
                      setConfirmAction({ type: "approve", property })
                    }
                    disabled={actionLoading === `approve-${property.id}`}
                  >
                    <FaCheck /> Approve
                  </button>

                  <button
                    className="action-btn reject"
                    onClick={() =>
                      setConfirmAction({ type: "reject", property })
                    }
                    disabled={actionLoading === `reject-${property.id}`}
                  >
                    <FaTimes /> Reject
                  </button>

                  <button
                    className="action-btn delete"
                    onClick={() =>
                      setConfirmAction({ type: "delete", property })
                    }
                    disabled={actionLoading === `delete-${property.id}`}
                  >
                    <FaTrash /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProperty && (
        <div
          className="flagged-modal-overlay"
          onClick={() => setSelectedProperty(null)}
        >
          <div
            className="flagged-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flagged-modal-header">
              <div>
                <h3>{selectedProperty.property_name}</h3>
                <p>
                  {selectedProperty.city}, {selectedProperty.region}
                </p>
              </div>

              <button
                className="close-btn"
                onClick={() => setSelectedProperty(null)}
                aria-label="Close property details"
              >
                <FaTimes />
              </button>
            </div>

            <div className="flagged-modal-grid">
              <div className="flagged-modal-gallery">
                {selectedProperty.images?.length > 0 ? (
                  selectedProperty.images.map((image, index) => {
                    const src =
                      typeof image === "string"
                        ? image
                        : image?.image || image?.url;

                    return (
                      <img
                        key={image?.id ?? `${src}-${index}`}
                        src={src}
                        alt="Property"
                        className="flagged-modal-image"
                      />
                    );
                  })
                ) : (
                  <div className="flagged-no-images">
                    No images available
                  </div>
                )}
              </div>

              <div className="flagged-modal-details">
                <div className="detail-box">
                  <h4>Owner Details</h4>
                  <p>
                    <strong>Name:</strong>{" "}
                    {selectedProperty.owner_name || "N/A"}
                  </p>
                  <p>
                    <strong>Email:</strong>{" "}
                    {selectedProperty.owner_email || "N/A"}
                  </p>
                  <p>
                    <strong>Phone:</strong>{" "}
                    {selectedProperty.owner_phone || "N/A"}
                  </p>
                  <p>
                    <strong>Source:</strong>{" "}
                    {selectedProperty.owner_source || "N/A"}
                  </p>
                </div>

                <div className="detail-box">
                  <h4>Property Details</h4>
                  <p>
                    <strong>Category:</strong> {selectedProperty.category}
                  </p>
                  <p>
                    <strong>Type:</strong>{" "}
                    {getPropertyTypeDisplay(selectedProperty)}
                  </p>
                  <p>
                    <strong>Bedrooms:</strong>{" "}
                    {getBedroomsDisplay(selectedProperty)}
                  </p>
                  <p>
                    <strong>Bathrooms:</strong>{" "}
                    {getBathroomsDisplay(selectedProperty)}
                  </p>
                  <p>
                    <strong>Price:</strong>{" "}
                    {getPropertyDisplayPrice(selectedProperty)}
                  </p>
                  <p>
                    <strong>School:</strong>{" "}
                    {selectedProperty.school || "N/A"}
                  </p>
                  <p>
                    <strong>Available:</strong>{" "}
                    {selectedProperty.is_available ? "Yes" : "No"}
                  </p>
                </div>

                <div className="detail-box">
                  <h4>Security Alert</h4>
                  <p>
                    <strong>Flag Type:</strong>{" "}
                    {selectedProperty.security_flag_type || "N/A"}
                  </p>
                  <p>
                    <strong>Reason:</strong>{" "}
                    {selectedProperty.security_flag_reason || "N/A"}
                  </p>
                  <p>
                    <strong>Under Review:</strong>{" "}
                    {selectedProperty.security_under_review ? "Yes" : "No"}
                  </p>
                  <p>
                    <strong>Flagged At:</strong>{" "}
                    {selectedProperty.security_flagged_at || "N/A"}
                  </p>
                </div>

                {selectedProperty.duplicate_matches?.length > 0 && (
                  <div className="detail-box">
                    <h4>Duplicate Matches</h4>
                    {selectedProperty.duplicate_matches.map((match) => (
                      <div className="match-item" key={match.id}>
                        <p>
                          <strong>Matched Property:</strong>{" "}
                          {match.matched_property_name}
                        </p>
                        <p>
                          <strong>Reason:</strong> {match.match_reason}
                        </p>
                        <p>
                          <strong>Score:</strong> {match.match_score}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="detail-box">
                  <h4>Description</h4>
                  <p>
                    {selectedProperty.description ||
                      "No description available."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div
          className="flagged-modal-overlay"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="confirm-box"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {confirmAction.type === "approve" && "Approve Property"}
              {confirmAction.type === "reject" && "Reject Property"}
              {confirmAction.type === "delete" && "Delete Property"}
            </h3>

            <p>
              Are you sure you want to {confirmAction.type}{" "}
              <strong>{confirmAction.property.property_name}</strong>?
            </p>

            <div className="confirm-actions">
              <button
                className="cancel-btn"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>

              {confirmAction.type === "approve" && (
                <button
                  className="confirm-btn approve"
                  onClick={() => handleApprove(confirmAction.property.id)}
                >
                  Confirm Approve
                </button>
              )}

              {confirmAction.type === "reject" && (
                <button
                  className="confirm-btn reject"
                  onClick={() => handleReject(confirmAction.property.id)}
                >
                  Confirm Reject
                </button>
              )}

              {confirmAction.type === "delete" && (
                <button
                  className="confirm-btn delete"
                  onClick={() => handleDelete(confirmAction.property.id)}
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlaggedProperty;