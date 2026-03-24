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
  theme = "dark",
  isFavorited = false,
  onFavorite,
  isAvailable = true,
}) => (
  <motion.div
    className={`fr-card fr-card--${theme}`}
    variants={cardVariant}
    whileHover={{ y: -6, transition: { duration: 0.22 } }}
  >
    <div className="fr-card-img-wrap">
      {image ? (
        <img src={image} alt={title} className="fr-card-img" />
      ) : (
        <div className="fr-card-img-placeholder">
          <FaHome />
        </div>
      )}

      {/* Favorite top-left */}
      <button
        type="button"
        className={`fr-card-fav-btn fr-card-fav-btn--top-left${
          isFavorited ? " fr-card-fav-btn--active" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onFavorite && onFavorite();
        }}
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
      >
        {isFavorited ? <FaHeart /> : <FaRegHeart />}
      </button>

      {/* Availability top-right */}
      <span
        className={`fr-card-availability fr-card-availability--${
          isAvailable ? "available" : "unavailable"
        }`}
      >
        <span className="fr-card-availability-dot" />
        {isAvailable ? "Available" : "Unavailable"}
      </span>

      {/* Property type bottom-left */}
      {category && (
        <span className="fr-card-badge fr-card-badge--bottom">
          {category === "hostel" ? (
            <FaBuilding style={{ marginRight: 5 }} />
          ) : (
            <FaHome style={{ marginRight: 5 }} />
          )}
          {CATEGORY_LABELS[category] || category}
        </span>
      )}
    </div>

    <div className="fr-card-body">
      <h3 className="fr-card-title">{title}</h3>

      <p className="fr-card-location">
        <FaMapMarkerAlt className="fr-card-pin" />
        {[city, region].filter(Boolean).join(", ")}
      </p>

      {amenities.length > 0 && (
        <div className="fr-card-amenities">
          {amenities.map((a, i) => (
            <span key={i} className="fr-card-amenity">
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="fr-card-footer">
        <div className="fr-card-price">
          <span className="fr-card-price-amount">
            GHS {Number(price).toLocaleString()}
          </span>
          <span className="fr-card-price-period">/mo</span>
        </div>
        <button className="fr-card-btn" onClick={onBook}>
          View <FaArrowRight />
        </button>
      </div>
    </div>
  </motion.div>
);

export default RentalCard;