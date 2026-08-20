import React from "react";
import { useNavigate } from "react-router-dom";
import "./PropertyCard.css";

const PropertyCard = ({ property, viewMode }) => {
  const navigate = useNavigate();

  // Multi-unit apartments use the cheapest unit price instead of a
  // parent property price because each apartment unit has its own rent.
  const isMultiUnitApartment =
    property.category === "apartment" &&
    property.apartment_listing_type === "multi_unit";

  const displayPrice = isMultiUnitApartment
    ? property.starting_price
    : property.price;

  const priceText =
    displayPrice !== null &&
    displayPrice !== undefined &&
    displayPrice !== ""
      ? `${isMultiUnitApartment ? "From " : ""}GHS ${Number(
          displayPrice
        ).toLocaleString()}`
      : isMultiUnitApartment
      ? "Unit pricing unavailable"
      : "Price unavailable";

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
          {property.amenities?.slice(0, 3).map((amenity, idx) => (
            <span key={idx} className="amenity">
              {amenity}
            </span>
          ))}

          {property.amenities?.length > 3 && <span>...</span>}
        </div>

        <div className="price-view-d">
          <p className="property-price">{priceText}</p>

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