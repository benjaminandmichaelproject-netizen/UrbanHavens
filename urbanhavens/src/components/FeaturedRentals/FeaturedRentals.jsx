import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./FeaturedRentals.css";
import RentalCard from "./RentalCard";

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const FeaturedRentals = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const fetchFeaturedProperties = async () => {
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
    };
    fetchFeaturedProperties();
  }, []);

  const handleBook = (property) =>
    navigate(`/detail/${property.id}`, { state: { property } });

  const getImageUrl = (property) =>
    property?.images?.[0]?.image || "";

  const getAmenitiesPreview = (amenities) => {
    if (!amenities) return [];
    let parsed = amenities;
    if (typeof amenities === "string") {
      try { parsed = JSON.parse(amenities); }
      catch { parsed = amenities.split(",").map(s => s.trim()).filter(Boolean); }
    }
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  };

  return (
    <section className="fr-section">

      {/* ── Header ────────────────────────────────────────── */}
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

      {/* ── States ────────────────────────────────────────── */}
      {loading && (
        <div className="fr-state">
          <div className="fr-spinner" />
          <p>Loading properties...</p>
        </div>
      )}

      {error && !loading && (
        <p className="fr-error">{error}</p>
      )}

      {!loading && !error && properties.length === 0 && (
        <p className="fr-empty">No featured properties available at the moment.</p>
      )}

      {/* ── Grid ──────────────────────────────────────────── */}
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
            />
          ))}
        </motion.div>
      )}

      {/* ── CTA ───────────────────────────────────────────── */}
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

    </section>
  );
};

export default FeaturedRentals;