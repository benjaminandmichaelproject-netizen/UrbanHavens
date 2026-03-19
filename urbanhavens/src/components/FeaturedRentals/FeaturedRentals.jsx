import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./FeaturedRentals.css";
import RentalCard from "./RentalCard";

const FeaturedRentals = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/properties/")
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched Data:", data);

        if (Array.isArray(data)) {
          setProperties(data);
          setError("");
        } else {
          setProperties([]);
          setError(data.detail || "Failed to fetch properties");
        }
      })
      .catch((err) => {
        console.error("Error fetching properties:", err);
        setProperties([]);
        setError("Error fetching properties");
      });
  }, []);

  const handleBook = (property) => {
    navigate(`/detail/${property.id}`, { state: { property } });
  };

  const getImageUrl = (property) => {
    const firstImage = property?.images?.[0]?.image;

    if (!firstImage) return "";

    if (firstImage.startsWith("http")) {
      return firstImage;
    }

    return `http://127.0.0.1:8000${firstImage}`;
  };

  const getAmenitiesPreview = (amenities) => {
    if (!amenities) return [];

    let parsedAmenities = amenities;

    if (typeof amenities === "string") {
      try {
        parsedAmenities = JSON.parse(amenities);
      } catch {
        parsedAmenities = amenities.split(",").map((item) => item.trim());
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

      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

      <div className="rentals-container">
        {properties.length > 0 ? (
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