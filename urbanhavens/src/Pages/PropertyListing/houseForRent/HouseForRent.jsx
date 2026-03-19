import React, { useState, useEffect } from "react";
import PropertyCard from "../Shared/PropertyCard";

const HouseForRent = ({ viewMode }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/properties/house/")
      .then(res => res.json())
      .then(data => { setProperties(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading houses...</p>;
  if (!properties.length) return <p>No houses available.</p>;

  return (
    <div className="house-for-rent">
      <div className="property-cards">
        {properties.map(p => <PropertyCard key={p.id} property={p} viewMode={viewMode} />)}
      </div>
    </div>
  );
};

export default HouseForRent;