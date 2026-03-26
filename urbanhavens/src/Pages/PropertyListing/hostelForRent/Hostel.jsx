import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import RentalCard from "../../../components/FeaturedRentals/RentalCard";
import "./Hostel.css";
import Footer from "../../../components/Footer/Footer";
const Hostel = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState([]);

  const getAvailability = (property) => {
    if (typeof property?.is_available === "boolean") return property.is_available;

    const status = String(property?.status || "")
      .toLowerCase()
      .trim();

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

      if (!res.ok) {
        setFavoriteIds([]);
        return;
      }

      const data = await res.json();

      const ids = Array.isArray(data)
        ? data.map((item) => item.property?.id).filter(Boolean)
        : [];

      setFavoriteIds(ids);
    } catch (err) {
      console.error("Failed to fetch favorites:", err);
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

    try {
      const res = await fetch(
        isAlreadyFavorited
          ? `/api/favorites/remove/${propertyId}/`
          : "/api/favorites/add/",
        {
          method: isAlreadyFavorited ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: isAlreadyFavorited
            ? null
            : JSON.stringify({ property_id: propertyId }),
        }
      );

      if (res.status === 401) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        localStorage.removeItem("role");
        localStorage.removeItem("username");
        localStorage.removeItem("userId");
        navigate("/login");
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
    } catch (err) {
      console.error("Favorite toggle failed:", err);
    }
  };

  useEffect(() => {
    const fetchHostels = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/properties/?category=hostel");

        if (!res.ok) {
          throw new Error("Failed to fetch hostels.");
        }

        const data = await res.json();
        const results = Array.isArray(data) ? data : data.results || [];

        setProperties(results);
      } catch (err) {
        setError(err.message || "Something went wrong.");
        setProperties([]);
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
    navigate(`/detail/${property.id}`, { state: { property } });
  };

  return (
    <div className="hostel-page">
      <section className="hostel-banner">
        <div className="hostel-banner-overlay"></div>

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
        {loading && <p className="hostel-message">Loading hostels...</p>}

        {error && <p className="hostel-message hostel-error">{error}</p>}

        {!loading && !error && !properties.length && (
          <p className="hostel-message">No hostels available.</p>
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
                amenities={getAmenitiesPreview(property.amenities)}
                onBook={() => handleBook(property)}
                isAvailable={getAvailability(property)}
                isFavorited={favoriteIds.includes(property.id)}
                onFavorite={() => toggleFavorite(property.id)}
              />
            ))}
          </div>
        )}
      </section>
         <Footer/>
    </div>
  );
};

export default Hostel;