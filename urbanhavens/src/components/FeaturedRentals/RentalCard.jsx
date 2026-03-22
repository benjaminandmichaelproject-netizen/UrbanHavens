import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMapMarkerAlt,
  faHome,
  faBuilding,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import "./FeaturedRentals.css";

const cardVariant = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,
             transition: { duration: 0.45, ease: "easeOut" } },
};

const CATEGORY_LABELS = {
  hostel:     "Hostel",
  house_rent: "House for Rent",
};

/**
 * theme: "dark" (default — for dark section backgrounds)
 *        "light" (for light section backgrounds like property listing)
 */
const RentalCard = ({
  image, title, city, region, category,
  price, amenities = [], onBook, theme = "dark",
}) => (
  <motion.div
    className={`fr-card fr-card--${theme}`}
    variants={cardVariant}
    whileHover={{ y: -6, transition: { duration: 0.22 } }}
  >
    {/* Image */}
    <div className="fr-card-img-wrap">
      {image ? (
        <img src={image} alt={title} className="fr-card-img" />
      ) : (
        <div className="fr-card-img-placeholder">
          <FontAwesomeIcon icon={faHome} />
        </div>
      )}

      {/* Category badge */}
      {category && (
        <span className="fr-card-badge">
          <FontAwesomeIcon
            icon={category === "hostel" ? faBuilding : faHome}
            style={{ marginRight: 5 }}
          />
          {CATEGORY_LABELS[category] || category}
        </span>
      )}
    </div>

    {/* Body */}
    <div className="fr-card-body">
      <h3 className="fr-card-title">{title}</h3>

      <p className="fr-card-location">
        <FontAwesomeIcon icon={faMapMarkerAlt} className="fr-card-pin" />
        {[city, region].filter(Boolean).join(", ")}
      </p>

      {/* Amenities */}
      {amenities.length > 0 && (
        <div className="fr-card-amenities">
          {amenities.map((a, i) => (
            <span key={i} className="fr-card-amenity">{a}</span>
          ))}
        </div>
      )}

      {/* Price + CTA */}
      <div className="fr-card-footer">
        <div className="fr-card-price">
          <span className="fr-card-price-amount">
            GHS {Number(price).toLocaleString()}
          </span>
          <span className="fr-card-price-period">/mo</span>
        </div>
        <button className="fr-card-btn" onClick={onBook}>
          View <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </div>
  </motion.div>
);

export default RentalCard;