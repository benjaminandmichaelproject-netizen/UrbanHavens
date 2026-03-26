import { motion } from "framer-motion";
import {
  FaMapMarkerAlt,
  FaHome,
  FaBuilding,
  FaArrowRight,
  FaHeart,
  FaRegHeart,
} from "react-icons/fa";
import "./FeaturedRentals.css";

const cardVariant = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

const CATEGORY_LABELS = {
  hostel: "Hostel",
  house_rent: "House for Rent",
};

const RentalCard = ({
  image,
  title,
  city,
  region,
  category,
  price,
  amenities = [],
  onBook,
  isFavorited = false,
  onFavorite,
  isAvailable = true,
}) => {
  const formatPrice = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    return Number(value).toLocaleString("en-GH", {
      style: "currency",
      currency: "GHS",
      maximumFractionDigits: 0,
    });
  };

  return (
    <motion.article
      className="rental-card"
      variants={cardVariant}
      whileHover={{ y: -6, transition: { duration: 0.22 } }}
    >
      <div className="rental-card-image-wrap">
        {image ? (
          <img src={image} alt={title || "Property"} className="rental-card-image" />
        ) : (
          <div className="rental-card-image-placeholder">
            <FaHome />
          </div>
        )}

        <span className={`rental-card-badge ${isAvailable ? "available" : "unavailable"}`}>
          {isAvailable ? "● Available" : "● Occupied"}
        </span>

        {category && (
          <span className="rental-card-category">
            {category === "hostel" ? <FaBuilding /> : <FaHome />}
            <span>{CATEGORY_LABELS[category] || category}</span>
          </span>
        )}

        <button
          type="button"
          className={`rental-card-fav-btn ${isFavorited ? "favorited" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onFavorite?.();
          }}
          aria-label={isFavorited ? "Remove from favourites" : "Add to favourites"}
          title={isFavorited ? "Remove from favourites" : "Add to favourites"}
        >
          {isFavorited ? <FaHeart /> : <FaRegHeart />}
        </button>
      </div>

      <div className="rental-card-body">
        <h3 className="rental-card-title">{title || "Untitled Property"}</h3>

        <p className="rental-card-location">
          <FaMapMarkerAlt />
          {[city, region].filter(Boolean).join(", ") || "Location TBD"}
        </p>

        {amenities.length > 0 && (
          <div className="rental-card-amenities">
            {amenities.slice(0, 3).map((item, index) => (
              <span key={index} className="rental-card-amenity">
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rental-card-footer">
        <div className="rental-card-price">
          <span className="rental-card-price-amount">{formatPrice(price)}</span>
          <span className="rental-card-price-label">per month</span>
        </div>

        <button
          className="rental-card-book-btn"
          onClick={isAvailable ? onBook : undefined}
          disabled={!isAvailable}
        >
          {isAvailable ? (
            <>
              <span>View</span>
              <FaArrowRight />
            </>
          ) : (
            "Unavailable"
          )}
        </button>
      </div>
    </motion.article>
  );
};

export default RentalCard;