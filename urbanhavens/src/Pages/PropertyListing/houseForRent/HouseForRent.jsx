import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import RentalCard from "../../../components/FeaturedRentals/RentalCard";
import FavAlert from "../../../components/Modals/FavAlert";
import Footer from "../../../components/Footer/Footer";
import {
  api,
  clearAuthStorage,
} from "../../../Dashboard/Owner/UploadDetails/api/api";

import "./HouseTypePage.css";

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
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

  // Determine whether a property can currently be booked.
  const getAvailability = (property) => {
    if (typeof property?.is_available === "boolean") {
      return property.is_available;
    }

    const status = String(property?.status || "")
      .toLowerCase()
      .trim();

    const unavailableStatuses = [
      "unavailable",
      "not available",
      "occupied",
      "booked",
      "rented",
    ];

    return !unavailableStatuses.includes(status);
  };

  // Return the first available property image.
  const getImageUrl = (property) => {
    if (property?.images?.length && property.images[0]?.image) {
      return property.images[0].image;
    }

    return property?.image || "";
  };

  // Convert amenities into a short three-item preview.
  const getAmenitiesPreview = (amenities) => {
    if (!amenities) {
      return [];
    }

    let parsedAmenities = amenities;

    if (typeof amenities === "string") {
      try {
        parsedAmenities = JSON.parse(amenities);
      } catch {
        parsedAmenities = amenities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return Array.isArray(parsedAmenities)
      ? parsedAmenities.slice(0, 3)
      : [];
  };

  // Load the current user's favorite property IDs.
  const fetchFavorites = useCallback(async () => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("token");

    if (!token) {
      setFavoriteIds([]);
      return;
    }

    try {
      const response = await api.get("/favorites/");
      const data = response.data;

      const favoriteResults = Array.isArray(data)
        ? data
        : data.results || [];

      const ids = favoriteResults
        .map((item) => item.property?.id)
        .filter(Boolean);

      setFavoriteIds(ids);
    } catch (err) {
      console.error(
        "Failed to load favorites:",
        err.response?.data || err.message
      );

      if (err.response?.status === 401) {
        clearAuthStorage();
      }

      setFavoriteIds([]);
    }
  }, []);

  // Add or remove a property from the user's favorites.
  const toggleFavorite = async (propertyId) => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    const isAlreadyFavorited = favoriteIds.includes(propertyId);

    try {
      if (isAlreadyFavorited) {
        await api.delete(`/favorites/remove/${propertyId}/`);
      } else {
        await api.post("/favorites/add/", {
          property_id: propertyId,
        });
      }

      setFavoriteIds((previousIds) =>
        isAlreadyFavorited
          ? previousIds.filter((id) => id !== propertyId)
          : [...previousIds, propertyId]
      );

      setFavAlertMessage(
        isAlreadyFavorited
          ? "Removed from favorites."
          : "Added to favorites."
      );

      setFavAlertType(
        isAlreadyFavorited ? "error" : "success"
      );

      setShowFavAlert(true);
    } catch (err) {
      console.error(
        "Failed to update favorite:",
        err.response?.data || err.message
      );

      if (err.response?.status === 401) {
        clearAuthStorage();
        navigate("/login");
        return;
      }

      setFavAlertMessage(
        err.response?.data?.detail ||
          "Failed to update favorite."
      );

      setFavAlertType("error");
      setShowFavAlert(true);
    }
  };

  // Load all available house-rent properties.
  useEffect(() => {
    const fetchHouses = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          "/properties/?category=house_rent"
        );

        const data = response.data;

        const results = Array.isArray(data)
          ? data
          : data.results || [];

        setProperties(results);
      } catch (err) {
        console.error(
          "Failed to fetch houses:",
          err.response?.data || err.message
        );

        setProperties([]);

        setError(
          err.response?.data?.detail ||
            err.message ||
            "Something went wrong."
        );
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
    navigate(`/detail/${property.id}`, {
      state: { property },
    });
  };

  return (
    <section className="house-rent-page">
      <section className="house-rent-banner">
        <div className="house-rent-banner-overlay" />

        <div className="house-rent-banner-content">
          <span className="house-rent-badge">
            Comfortable Rental Homes
          </span>

          <h1>Find Houses for Rent with Confidence</h1>

          <p>
            Discover verified rental homes in great locations
            across Ghana. Browse comfortable, secure, and
            affordable houses that fit your lifestyle and budget.
          </p>
        </div>
      </section>

      {loading && (
        <div className="fr-state">
          <div className="fr-spinner" />
          <p>Loading houses...</p>
        </div>
      )}

      {error && !loading && (
        <p className="fr-error">{error}</p>
      )}

      {!loading &&
        !error &&
        properties.length === 0 && (
          <p className="fr-empty">
            Property is not available.
          </p>
        )}

      {!loading &&
        !error &&
        properties.length > 0 && (
          <motion.div
            className="featured-rentals-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{
              once: true,
              margin: "-40px",
            }}
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
                amenities={getAmenitiesPreview(
                  property.amenities
                )}
                onBook={() => handleBook(property)}
                isAvailable={getAvailability(property)}
                isFavorited={favoriteIds.includes(
                  property.id
                )}
                onFavorite={() =>
                  toggleFavorite(property.id)
                }
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

      <Footer />
    </section>
  );
};

export default HouseForRent;