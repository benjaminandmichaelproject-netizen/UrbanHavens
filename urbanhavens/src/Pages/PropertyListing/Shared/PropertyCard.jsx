import React from "react";
import { useNavigate } from "react-router-dom";
import "./PropertyCard.css";

const PropertyCard = ({ property, viewMode }) => {
  const navigate = useNavigate();

  // Multi-unit apartments use the cheapest available unit price
  // instead of the intentionally empty parent property price.
  const isMultiUnitApartment =
    property?.category === "apartment" &&
    property?.apartment_listing_type === "multi_unit";

  const displayPrice = isMultiUnitApartment
    ? property?.starting_price
    : property?.price;

  const hasPrice =
    displayPrice !== null &&
    displayPrice !== undefined &&
    displayPrice !== "";

  return (
    <div
      className={`property-card ${
        viewMode === "list" ? "list-view" : ""
      }`}
    >
      <img
        src={property.main_image || "/default-house.jpg"}
        alt={property.title}
      />

      <div className="property-card-info">
        <h4>{property.title}</h4>

        <p className="property-location">
          {property.city}, {property.region}
        </p>

        <div className="property-amenities">
          {property.amenities
            ?.slice(0, 3)
            .map((amenity, idx) => (
              <span key={idx} className="amenity">
                {amenity}
              </span>
            ))}

          {property.amenities?.length > 3 && (
            <span>...</span>
          )}
        </div>

        <div className="price-view-d">
          <p className="property-price">
            {hasPrice
              ? `${
                  isMultiUnitApartment ? "From " : ""
                }GHS ${displayPrice}`
              : isMultiUnitApartment
              ? "Unit pricing unavailable"
              : "Price unavailable"}
          </p>

          <button
            className="btn-view-details"
            onClick={() =>
              navigate(`/detail/${property.id}`, {
                state: { property },
              })
            }
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;