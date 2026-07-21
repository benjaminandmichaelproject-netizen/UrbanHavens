import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import RentalCard from "../../../components/FeaturedRentals/RentalCard";
import Footer from "../../../components/Footer/Footer";
import {
  api,
  clearAuthStorage,
} from "../../../Dashboard/Owner/UploadDetails/api/api";

import "./Hostel.css";

const Hostel = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState([]);

  // Determine whether a property is currently available.
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

  // Return a maximum of three amenities for the card.
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

  // Load the authenticated user's favorite property IDs.
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
        "Failed to fetch favorites:",
        err.response?.data || err.message
      );

      if (err.response?.status === 401) {
        clearAuthStorage();
      }

      setFavoriteIds([]);
    }
  }, []);

  // Add or remove a hostel from the user's favorites.
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
    } catch (err) {
      console.error(
        "Favorite toggle failed:",
        err.response?.data || err.message
      );

      if (err.response?.status === 401) {
        clearAuthStorage();
        navigate("/login");
      }
    }
  };

  // Load hostel properties from the backend.
  useEffect(() => {
    const fetchHostels = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          "/properties/?category=hostel"
        );

        const data = response.data;

        const results = Array.isArray(data)
          ? data
          : data.results || [];

        setProperties(results);
      } catch (err) {
        console.error(
          "Failed to fetch hostels:",
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

    fetchHostels();
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
    <div className="hostel-page">
      <section className="hostel-banner">
        <div className="hostel-banner-overlay" />

        <div className="hostel-banner-content">
          <span className="hostel-badge">
            Student & Private Hostel Listings
          </span>

          <h1>Find Verified Hostels Across Ghana</h1>

          <p>
            Explore trusted hostel spaces in prime student and city locations.
            UrbanHavens helps you discover comfortable, secure, and affordable
            hostel options with ease.
          </p>
        </div>
      </section>

      <section className="hostel-intro">
        <div className="hostel-intro-text">
          <h2>Hostels Made Simple</h2>

          <p>
            Whether you are searching near a university, in the city center, or
            within a quiet neighborhood, browse available hostel properties that
            match your comfort, budget, and lifestyle needs.
          </p>
        </div>
      </section>

      <section className="hostel-list-section">
        {loading && (
          <p className="hostel-message">
            Loading hostels...
          </p>
        )}

        {error && (
          <p className="hostel-message hostel-error">
            {error}
          </p>
        )}

        {!loading && !error && properties.length === 0 && (
          <p className="hostel-message">
            No hostels available.
          </p>
        )}

        {!loading && !error && properties.length > 0 && (
          <div className="featured-rentals-grid">
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
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default Hostel;