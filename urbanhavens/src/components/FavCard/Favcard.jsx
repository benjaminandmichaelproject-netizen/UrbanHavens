import React from "react";
import {
  FaMapMarkerAlt,
  FaHeart,
  FaHome,
  FaBuilding,
  FaArrowRight,
} from "react-icons/fa";
import "./Favcard.css";

const CATEGORY_LABELS = {
  hostel: "Hostel",
  house_rent: "House for Rent",
  apartment: "Apartment",
};

const Favcard = ({ favorite, onRemove, onView }) => {
  const property = favorite?.property;

  if (!property) return null;

  const image = property?.images?.[0]?.image || "";

  const isAvailable =
    typeof property?.is_available === "boolean"
      ? property.is_available
      : true;

  // Multi-unit apartments use the cheapest available unit price.
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
    <div className="fav-card">
      <div className="fav-card-image-wrap">
        {image ? (
          <img
            src={image}
            alt={property.property_name}
            className="fav-card-image"
          />
        ) : (
          <div className="fav-card-image-placeholder">
            <FaHome />
          </div>
        )}

        <button
          type="button"
          className="fav-card-heart"
          onClick={onRemove}
          title="Remove from favorites"
          aria-label="Remove from favorites"
        >
          <FaHeart />
        </button>

        <span
          className={`fav-card-availability ${
            isAvailable ? "available" : "unavailable"
          }`}
        >
          <span className="fav-card-dot" />
          {isAvailable ? "Available" : "Unavailable"}
        </span>

        {property.category && (
          <span className="fav-card-category">
            {property.category === "hostel" ? (
              <FaBuilding />
            ) : (
              <FaHome />
            )}

            {CATEGORY_LABELS[property.category] ||
              property.category}
          </span>
        )}
      </div>

      <div className="fav-card-body">
        <h3 className="fav-card-title">
          {property.property_name}
        </h3>

        <p className="fav-card-location">
          <FaMapMarkerAlt />

          {[property.city, property.region]
            .filter(Boolean)
            .join(", ")}
        </p>

        <div className="fav-card-footer">
          <div className="fav-card-price">
            {hasPrice ? (
              <>
                {isMultiUnitApartment ? "From " : ""}
                GHS {Number(displayPrice).toLocaleString()}
                <span>/mo</span>
              </>
            ) : (
              <span>
                {isMultiUnitApartment
                  ? "Unit pricing unavailable"
                  : "Price unavailable"}
              </span>
            )}
          </div>

          <button
            className="fav-card-btn"
            onClick={onView}
          >
            View <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Favcard;