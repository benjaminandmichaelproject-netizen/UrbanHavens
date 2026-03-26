import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./HouseTypePage.css";
import RentalCard from "../../../components/FeaturedRentals/RentalCard";
import FavAlert from "../../../components/Modals/FavAlert";
import Footer from "../../../components/Footer/Footer";
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const HouseForRent = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [showFavAlert, setShowFavAlert] = useState(false);
  const [favAlertMessage, setFavAlertMessage] = useState("");
  const [favAlertType, setFavAlertType] = useState("success");

  const getAvailability = (property) => {
    if (typeof property?.is_available === "boolean") return property.is_available;

    const status = String(property?.status || "").toLowerCase().trim();

    if (
      ["unavailable", "not available", "occupied", "booked", "rented"].includes(
        status
      )
    ) {
      return false;
    }

    return true;
  };

  const getImageUrl = (property) => {
    if (property?.images?.length && property.images[0]?.image) {
      return property.images[0].image;
    }

    if (property?.image) {
      return property.image;
    }

    return "";
  };

  const getAmenitiesPreview = (amenities) => {
    if (!amenities) return [];

    let parsed = amenities;

    if (typeof amenities === "string") {
      try {
        parsed = JSON.parse(amenities);
      } catch {
        parsed = amenities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  };

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
    } catch {
      return null;
    }
  };

  const fetchFavorites = useCallback(async () => {
    const token = localStorage.getItem("access");

    if (!token) {
      setFavoriteIds([]);
      return;
    }

    try {
      const res = await fetch("/api/favorites/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        setFavoriteIds([]);
        return;
      }

      if (!res.ok) {
        setFavoriteIds([]);
        return;
      }

      const data = await res.json();
      const ids = Array.isArray(data)
        ? data.map((item) => item.property?.id).filter(Boolean)
        : [];

      setFavoriteIds(ids);
    } catch {
      setFavoriteIds([]);
    }
  }, []);

  const toggleFavorite = async (propertyId) => {
    const token = localStorage.getItem("access");

    if (!token) {
      navigate("/login");
      return;
    }

    const isAlreadyFavorited = favoriteIds.includes(propertyId);
    const url = isAlreadyFavorited
      ? `/api/favorites/remove/${propertyId}/`
      : "/api/favorites/add/";

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
          localStorage.removeItem("refresh");
          localStorage.removeItem("role");
          localStorage.removeItem("username");
          localStorage.removeItem("userId");
          navigate("/login");
          return;
        }

        await toggleFavorite(propertyId);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to update favorite.");
      }

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

  useEffect(() => {
    const fetchHouses = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/properties/?category=house_rent");

        if (!res.ok) {
          throw new Error("Failed to fetch houses.");
        }

        const data = await res.json();
        const results = Array.isArray(data) ? data : data.results || [];

        setProperties(results);
      } catch (err) {
        setProperties([]);
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchHouses();
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleBook = (property) => {
    navigate(`/detail/${property.id}`, { state: { property } });
  };

  return (
    <section className="house-rent-page">
      <section className="house-rent-banner">
        <div className="house-rent-banner-overlay"></div>

        <div className="house-rent-banner-content">
          <span className="house-rent-badge">Comfortable Rental Homes</span>
          <h1>Find Houses for Rent with Confidence</h1>
          <p>
            Discover verified rental homes in great locations across Ghana.
            Browse comfortable, secure, and affordable houses that fit your
            lifestyle and budget.
          </p>
        </div>
      </section>

      {loading && (
        <div className="fr-state">
          <div className="fr-spinner" />
          <p>Loading houses...</p>
        </div>
      )}

      {error && !loading && <p className="fr-error">{error}</p>}

      {!loading && !error && properties.length === 0 && (
        <p className="fr-empty">Property is not available.</p>
      )}

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

      <FavAlert
        show={showFavAlert}
        message={favAlertMessage}
        type={favAlertType}
        onClose={() => setShowFavAlert(false)}
      />
      <Footer/>
    </section>
  );
};

export default HouseForRent;