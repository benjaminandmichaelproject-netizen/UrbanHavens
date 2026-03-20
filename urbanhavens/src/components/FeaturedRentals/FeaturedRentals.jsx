import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./FeaturedRentals.css";
import RentalCard from "./RentalCard";

const FeaturedRentals = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedProperties = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/properties/featured/");
        if (!res.ok) {
          throw new Error("Failed to fetch featured properties.");
        }

        const data = await res.json();

        if (Array.isArray(data)) {
          setProperties(data);
        } else {
          setProperties([]);
          setError("Invalid response from server.");
        }
      } catch (err) {
        console.error("Error fetching featured properties:", err);
        setProperties([]);
        setError(err.message || "Error fetching featured properties.");
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProperties();
  }, []);

  const handleBook = (property) => {
    navigate(`/detail/${property.id}`, { state: { property } });
  };

  const getImageUrl = (property) => {
    const firstImage = property?.images?.[0]?.image;
    return firstImage || "";
  };

  const getAmenitiesPreview = (amenities) => {
    if (!amenities) return [];

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

    if (Array.isArray(parsedAmenities)) {
      return parsedAmenities.slice(0, 3);
    }

    return [];
  };

  return (
    <div className="rentals-main-container">
      <div className="subtitle">
        <h1>
          Featured <span>Properties</span>
        </h1>
        <p>Explore our handpicked selection of premium rental properties</p>
      </div>

      {loading && <p style={{ textAlign: "center" }}>Loading featured properties...</p>}
      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

      <div className="rentals-container">
        {!loading && !error && properties.length > 0 ? (
          properties.map((property) => (
            <RentalCard
              key={property.id}
              id={property.id}
              image={getImageUrl(property)}
              title={property.property_name}
              city={property.city}
              price={property.price}
              amenities={getAmenitiesPreview(property.amenities)}
              onBook={() => handleBook(property)}
            />
          ))
        ) : (
          !loading &&
          !error && <p style={{ textAlign: "center" }}>No properties available.</p>
        )}
      </div>

      <div className="view-all-house">
        <button
          onClick={() => navigate("/propertylisting")}
          className="view-all-btn"
        >
          View All Properties
        </button>
      </div>
    </div>
  );
};

export default FeaturedRentals;