import React, { useEffect, useState } from "react";
import PropertyCard from "../Shared/PropertyCard";

const HouseForRent = ({ viewMode }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/properties/");
        if (!res.ok) {
          throw new Error("Failed to fetch properties.");
        }

        const data = await res.json();
        const results = Array.isArray(data) ? data : data.results || [];

        const houses = results.filter(
          (property) => property.category === "house_rent"
        );

        setProperties(houses);
      } catch (err) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  if (loading) return <p>Loading houses...</p>;
  if (error) return <p>{error}</p>;
  if (!properties.length) return <p>No houses available.</p>;

  return (
    <div className="house-for-rent">
      <div className="property-cards">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
};

export default HouseForRent;