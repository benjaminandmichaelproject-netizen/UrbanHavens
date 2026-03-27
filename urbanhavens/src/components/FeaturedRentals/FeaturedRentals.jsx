import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./FeaturedRentals.css";
import FavAlert from "../Modals/FavAlert";

/* ─── Animation Variants ──────────────────────────────────────────── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
  },
};

/* ─── Inline Rental Card ──────────────────────────────────────────── */
const RentalCard = ({
  id,
  image,
  title,
  city,
  region,
  category,
  price,
  amenities = [],
  onBook,
  isAvailable,
  isFavorited,
  onFavorite,
}) => {
  const formatPrice = (p) => {
    if (!p && p !== 0) return "—";
    return Number(p).toLocaleString("en-GH", {
      style: "currency",
      currency: "GHS",
      maximumFractionDigits: 0,
    });
  };

  return (
    <motion.article className="rental-card" variants={cardVariant}>
      {/* ── Image ── */}
      <div className="rental-card-image-wrap">
        {image ? (
          <img src={image} alt={title} loading="lazy" />
        ) : (
          <div className="rental-card-image-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff">
              <path
                d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
                strokeWidth="1.5"
              />
              <path d="M9 21V12h6v9" strokeWidth="1.5" />
            </svg>
          </div>
        )}

        {/* Availability badge */}
        <span className={`rental-card-badge ${isAvailable ? "available" : "unavailable"}`}>
          {isAvailable ? "● Available" : "● Occupied"}
        </span>

        {/* Category */}
        {category && <span className="rental-card-category">{category}</span>}

        {/* Favourite */}
        <button
          className={`rental-card-fav-btn ${isFavorited ? "favorited" : ""}`}
          onClick={(e) => { e.stopPropagation(); onFavorite?.(); }}
          aria-label={isFavorited ? "Remove from favourites" : "Add to favourites"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>

      {/* ── Body ── */}
      <div className="rental-card-body">
        <h3 className="rental-card-title">{title || "Untitled Property"}</h3>

        <p className="rental-card-location">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {[city, region].filter(Boolean).join(", ") || "Location TBD"}
        </p>

        {amenities.length > 0 && (
          <div className="rental-card-amenities">
            {amenities.map((a, i) => (
              <span key={i} className="rental-card-amenity">{a}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="rental-card-footer">
        <div className="rental-card-price">
          <span className="rental-card-price-amount">{formatPrice(price)}</span>
          <span className="rental-card-price-label">per month</span>
        </div>

        <button
          className="rental-card-book-btn"
          onClick={onBook}
          disabled={!isAvailable}
        >
          {isAvailable ? "Book Now" : "Unavailable"}
        </button>
      </div>
    </motion.article>
  );
};

/* ─── Helpers ─────────────────────────────────────────────────────── */
const getAvailability = (property) => {
  if (typeof property?.is_available === "boolean") return property.is_available;
  const status = String(property?.status || "").toLowerCase().trim();
  return !["unavailable", "not available", "occupied", "booked", "rented"].includes(status);
};

const getImageUrl = (property) => property?.images?.[0]?.image || "";

const getAmenitiesPreview = (amenities) => {
  if (!amenities) return [];
  let parsed = amenities;
  if (typeof amenities === "string") {
    try { parsed = JSON.parse(amenities); }
    catch { parsed = amenities.split(",").map((s) => s.trim()).filter(Boolean); }
  }
  return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
};

/* ─── Main Component ──────────────────────────────────────────────── */
const FeaturedRentals = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [showFavAlert, setShowFavAlert] = useState(false);
  const [favAlertMessage, setFavAlertMessage] = useState("");
  const [favAlertType, setFavAlertType] = useState("success");

  const refreshAccessToken = async () => {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) return null;
    try {
      const res = await fetch("/api/users/token/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      localStorage.setItem("access", data.access);
      return data.access;
    } catch { return null; }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/properties/featured/");
        if (!res.ok) throw new Error("Failed to fetch featured properties.");
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : []);
        if (!Array.isArray(data)) setError("Invalid response from server.");
      } catch (err) {
        setProperties([]);
        setError(err.message || "Error fetching featured properties.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchFavorites = useCallback(async () => {
    const token = localStorage.getItem("access");
    if (!token) { setFavoriteIds([]); return; }
    try {
      const res = await fetch("/api/favorites/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || !res.ok) { setFavoriteIds([]); return; }
      const data = await res.json();
      const ids = Array.isArray(data)
        ? data.map((item) => item.property?.id).filter(Boolean)
        : [];
      setFavoriteIds(ids);
    } catch { setFavoriteIds([]); }
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const toggleFavorite = async (propertyId) => {
    const token = localStorage.getItem("access");
    if (!token) { navigate("/login"); return; }

    const isAlreadyFavorited = favoriteIds.includes(propertyId);
    const url = isAlreadyFavorited
      ? `/api/favorites/remove/${propertyId}/`
      : "/api/favorites/add/";

    try {
      const res = await fetch(url, {
        method: isAlreadyFavorited ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        ...(isAlreadyFavorited ? {} : { body: JSON.stringify({ property_id: propertyId }) }),
      });

      if (res.status === 401) {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          navigate("/login");
          return;
        }
        await toggleFavorite(propertyId);
        return;
      }

      if (!res.ok) throw new Error("Failed to update favorite.");

      setFavoriteIds((prev) =>
        isAlreadyFavorited ? prev.filter((id) => id !== propertyId) : [...prev, propertyId]
      );
      setFavAlertMessage(isAlreadyFavorited ? "Removed from favorites." : "Added to favorites.");
      setFavAlertType(isAlreadyFavorited ? "error" : "success");
      setShowFavAlert(true);
    } catch (err) {
      console.error("toggleFavorite error:", err);
    }
  };

  const handleBook = (property) => {
    navigate(`/detail/${property.id}`, { state: { property } });
  };

  return (
    <section className="featured-rentals-section">
      {/* ── Header ── */}
      <motion.div
        className="featured-rentals-header"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        <motion.span className="featured-rentals-eyebrow" variants={fadeUp}>
          Handpicked For You
        </motion.span>

        <motion.h2 className="featured-rentals-title" variants={fadeUp}>
          Featured{" "}
          <span className="featured-rentals-title-accent">Properties</span>
        </motion.h2>

        <motion.p className="featured-rentals-subtitle" variants={fadeUp}>
          Explore our selection of premium verified rental listings across Ghana
        </motion.p>
      </motion.div>

      {/* ── Loading ── */}
      {loading && (
        <div className="featured-rentals-loading-state">
          <div className="featured-rentals-spinner" />
          <p>Loading properties…</p>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <p className="featured-rentals-error-message">{error}</p>
      )}

      {/* ── Empty ── */}
      {!loading && !error && properties.length === 0 && (
        <p className="featured-rentals-empty-message">
          No featured properties available at the moment.
        </p>
      )}

      {/* ── Grid ── */}
      {!loading && !error && properties.length > 0 && (
        <motion.div
          className="featured-rentals-grid"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          {properties.map((property) => (
            <RentalCard
              key={property.id}
              id={property.id}
              image={getImageUrl(property)}
              title={property.property_name}
              city={property.city}
              region={property.region}
              category={property.category}
              price={property.price}
              amenities={getAmenitiesPreview(property.amenities)}
              onBook={() => handleBook(property)}
              isAvailable={getAvailability(property)}
              isFavorited={favoriteIds.includes(property.id)}
              onFavorite={() => toggleFavorite(property.id)}
            />
          ))}
        </motion.div>
      )}

      {/* ── CTA ── */}
      <motion.div
        className="featured-rentals-call-to-action"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <button
          className="featured-rentals-view-all-button"
          onClick={() => navigate("/propertylisting")}
        >
          View All Properties →
        </button>
      </motion.div>

      <FavAlert
        show={showFavAlert}
        message={favAlertMessage}
        type={favAlertType}
        onClose={() => setShowFavAlert(false)}
      />
    </section>
  );
};

export default FeaturedRentals;