import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaLocationArrow, FaMapMarkerAlt, FaTimes,
  FaSpinner, FaExclamationTriangle,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import RentalCard from "../FeaturedRentals/RentalCard";
import "./NearbyProperties.css";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };


// ── Distance badge inside card overlay ───────────────────────────
const DistanceBadge = ({ label }) => (
  <span className="np-dist-badge">
    <FaMapMarkerAlt /> {label}
  </span>
);

const NearbyProperties = () => {
  const navigate = useNavigate();

  const [state, setState]         = useState("idle");
  // idle | requesting | loading | success | denied | error
  const [properties, setProps]    = useState([]);
  const [userCoords, setCoords]   = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [radius, setRadius]       = useState(20); // km

  // ── Fetch nearby from backend ──────────────────────────────────
  const fetchNearby = useCallback(async (lat, lng, km = radius) => {
    setState("loading");
    try {
      const res = await fetch(
       // ✅ correct
`http://127.0.0.1:8000/api/nearby-properties/?lat=${lat}&lng=${lng}&radius=${km}&limit=12`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProps(data.properties || []);
      setState("success");
    } catch (err) {
      console.error("Nearby fetch error:", err);
      setState("error");
    }
  }, [radius]);

  // ── Request location ───────────────────────────────────────────
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState("error");
      return;
    }
    setState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        fetchNearby(latitude, longitude);
      },
      (err) => {
        console.warn("Location denied:", err.message);
        setState("denied");
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, [fetchNearby]);

  // ── Radius change re-fetch ─────────────────────────────────────
  const handleRadiusChange = (km) => {
    setRadius(km);
    if (userCoords) fetchNearby(userCoords.lat, userCoords.lng, km);
  };

  // If dismissed, render nothing
  if (dismissed) return null;

  return (
    <section className="np-section">

      {/* ── Idle — prompt to enable location ──────────────────── */}
      {state === "idle" && (
        <motion.div
          className="np-prompt"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="np-prompt-icon">
            <FaLocationArrow />
          </div>
          <div className="np-prompt-text">
            <h4>Find Properties Near You</h4>
            <p>Enable location to discover rentals in your area instantly</p>
          </div>
          <div className="np-prompt-actions">
            <button className="np-enable-btn" onClick={requestLocation}>
              <FaLocationArrow /> Enable Location
            </button>
            <button className="np-dismiss-btn" onClick={() => setDismissed(true)}>
              <FaTimes />
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Requesting / Loading ───────────────────────────────── */}
      {(state === "requesting" || state === "loading") && (
        <motion.div
          className="np-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <FaSpinner className="np-spin" />
          <p>
            {state === "requesting"
              ? "Waiting for location permission..."
              : "Finding properties near you..."}
          </p>
        </motion.div>
      )}

      {/* ── Denied — silent fallback ───────────────────────────── */}
      {state === "denied" && null /* show nothing, page continues normally */}

      {/* ── Error ─────────────────────────────────────────────── */}
      {state === "error" && (
        <div className="np-error">
          <FaExclamationTriangle />
          <p>Couldn't fetch nearby properties. <button onClick={requestLocation}>Try again</button></p>
        </div>
      )}

      {/* ── Success ───────────────────────────────────────────── */}
      {state === "success" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="np-header">
            <div className="np-header-left">
              <div className="np-header-icon"><FaLocationArrow /></div>
              <div>
                <h3 className="np-title">Properties Near You</h3>
                <p className="np-subtitle">
                  {properties.length > 0
                    ? `${properties.length} propert${properties.length === 1 ? "y" : "ies"} within ${radius} km`
                    : `No properties found within ${radius} km`}
                </p>
              </div>
            </div>

            {/* Radius pills */}
            <div className="np-radius-pills">
              {[5, 10, 20, 50].map(km => (
                <button
                  key={km}
                  className={`np-radius-pill ${radius === km ? "active" : ""}`}
                  onClick={() => handleRadiusChange(km)}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          {properties.length > 0 ? (
            <motion.div
              className="np-grid"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {properties.map(p => (
                <div key={p.id} className="np-card-wrap">
                  {/* Distance badge floated on top of card */}
                  {p.distance_label && (
                    <DistanceBadge label={p.distance_label} />
                  )}
                  <RentalCard
                    image={p.images?.[0]?.image || "/default-house.jpg"}
                    title={p.property_name}
                    city={p.city}
                    region={p.region}
                    category={p.category}
                    price={p.price}
                    amenities={
                      Array.isArray(p.amenities)
                        ? p.amenities.slice(0, 3)
                        : []
                    }
                    onBook={() => navigate(`/detail/${p.id}`)}
                    theme="light"
                  />
                </div>
              ))}
            </motion.div>
          ) : (
            <div className="np-empty">
              <FaMapMarkerAlt className="np-empty-icon" />
              <p>No properties found within {radius} km of your location.</p>
              <p className="np-empty-hint">Try increasing the radius above.</p>
            </div>
          )}
        </motion.div>
      )}

    </section>
  );
};

export default NearbyProperties;