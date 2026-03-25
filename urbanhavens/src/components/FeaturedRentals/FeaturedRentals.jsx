import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./FeaturedRentals.css";
import RentalCard from "./RentalCard";
import FavAlert from "../Modals/FavAlert";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

// ── Token refresh helper ─────────────────────────────────
const refreshAccessToken = async () => {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return null;

  try {
    const res = await fetch(`${API_BASE}/users/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    localStorage.setItem("access", data.access);
    localStorage.setItem("token", data.access);
    return data.access;
  } catch {
    return null;
  }
};

const FeaturedRentals = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [showFavAlert, setShowFavAlert] = useState(false);
  const [favAlertMessage, setFavAlertMessage] = useState("");
  const [favAlertType, setFavAlertType] = useState("success");

  // ── Helpers ────────────────────────────────────────────
  const getAvailability = (property) => {
    if (typeof property?.is_available === "boolean") return property.is_available;
    const status = String(property?.status || "").toLowerCase().trim();
    if (["unavailable", "not available", "occupied", "booked", "rented"].includes(status)) {
      return false;
    }
    return true;
  };

  const getImageUrl = (property) => property?.images?.[0]?.image || "";

  const getAmenitiesPreview = (amenities) => {
    if (!amenities) return [];
    let parsed = amenities;
    if (typeof amenities === "string") {
      try {
        parsed = JSON.parse(amenities);
      } catch {
        parsed = amenities.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  };

  // ── Fetch featured properties ──────────────────────────
  useEffect(() => {
    const fetchFeaturedProperties = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/properties/featured/`);
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
    };

    fetchFeaturedProperties();
  }, []);

  // ── Fetch favorites ────────────────────────────────────
  const fetchFavorites = useCallback(async () => {
    const token = localStorage.getItem("access") || localStorage.getItem("token");

    if (!token) {
      setFavoriteIds([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/favorites/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        setFavoriteIds([]);
        return;
      }

      if (!res.ok) return;

      const data = await res.json();
      const ids = Array.isArray(data)
        ? data.map((item) => item.property?.id).filter(Boolean)
        : [];

      setFavoriteIds(ids);
    } catch {
      setFavoriteIds([]);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // ── Toggle favorite ────────────────────────────────────
  const toggleFavorite = async (propertyId) => {
    const token = localStorage.getItem("access") || localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    const isAlreadyFavorited = favoriteIds.includes(propertyId);
    const url = isAlreadyFavorited
      ? `${API_BASE}/favorites/remove/${propertyId}/`
      : `${API_BASE}/favorites/add/`;

    try {
      const res = await fetch(url, {
        method: isAlreadyFavorited ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        ...(isAlreadyFavorited
          ? {}
          : { body: JSON.stringify({ property_id: propertyId }) }),
      });

      if (res.status === 401) {
        const newToken = await refreshAccessToken();

        if (!newToken) {
          localStorage.removeItem("access");
          localStorage.removeItem("token");
          localStorage.removeItem("refresh");
          navigate("/login");
          return;
        }

        await toggleFavorite(propertyId);
        return;
      }

      if (!res.ok) throw new Error("Failed to update favorite.");

      setFavoriteIds((prev) =>
        isAlreadyFavorited
          ? prev.filter((id) => id !== propertyId)
          : [...prev, propertyId]
      );

      setFavAlertMessage(
        isAlreadyFavorited ? "Removed from favorites." : "Added to favorites."
      );
      setFavAlertType(isAlreadyFavorited ? "error" : "success");
      setShowFavAlert(true);
    } catch (err) {
      console.error("toggleFavorite error:", err);
    }
  };

  // ── Handlers ───────────────────────────────────────────
  const handleBook = (property) =>
    navigate(`/detail/${property.id}`, { state: { property } });

  // ── Render ─────────────────────────────────────────────
  return (
    <section className="fr-section">
      <motion.div
        className="fr-header"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        <motion.span className="fr-eyebrow" variants={fadeUp}>
          HANDPICKED FOR YOU
        </motion.span>
        <motion.h2 className="fr-title" variants={fadeUp}>
          Featured <span className="fr-accent">Properties</span>
        </motion.h2>
        <motion.p className="fr-sub" variants={fadeUp}>
          Explore our selection of premium verified rental listings across Ghana
        </motion.p>
      </motion.div>

      {loading && (
        <div className="fr-state">
          <div className="fr-spinner" />
          <p>Loading properties...</p>
        </div>
      )}

      {error && !loading && <p className="fr-error">{error}</p>}

      {!loading && !error && properties.length === 0 && (
        <p className="fr-empty">No featured properties available at the moment.</p>
      )}

      {!loading && !error && properties.length > 0 && (
        <motion.div
          className="fr-grid"
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
              theme="dark"
              isAvailable={getAvailability(property)}
              isFavorited={favoriteIds.includes(property.id)}
              onFavorite={() => toggleFavorite(property.id)}
            />
          ))}
        </motion.div>
      )}

      <motion.div
        className="fr-cta"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <button
          className="fr-cta-btn"
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