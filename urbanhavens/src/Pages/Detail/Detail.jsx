import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import BookingForm from "../../components/BookingForm/BookingForm";
import {
  FaBath, FaBed, FaCheckCircle, FaMapMarkerAlt,
  FaHome, FaBuilding, FaArrowLeft, FaSchool,
} from "react-icons/fa";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Detail.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const fadeUp   = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } } };
const stagger  = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const fadeLeft = { hidden: { opacity: 0, x: -30 }, show: { opacity: 1, x: 0, transition: { duration: 0.55, ease: "easeOut" } } };

const Detail = () => {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [property, setProperty]                 = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const res = await fetch(`http://127.0.0.1:8000/api/properties/${id}/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to fetch property");
        setProperty(await res.json());
      } catch (err) {
        console.error(err);
        setProperty(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const parseAmenities = (a) => {
    if (!a) return [];
    if (Array.isArray(a)) return a;
    if (typeof a === "string") {
      try { const p = JSON.parse(a); return Array.isArray(p) ? p : []; }
      catch { return a.split(",").map(s => s.trim()).filter(Boolean); }
    }
    return [];
  };

  const getImageUrl  = (path) => path || "/default-house.jpg";
  const formatCat    = (c) => c === "house_rent" ? "House for Rent" : c === "hostel" ? "Hostel" : c || "N/A";

  /* ── Loading ── */
  if (loading) return (
    <div className="dt-loading">
      <div className="dt-spinner" />
      <p>Loading property details...</p>
    </div>
  );

  /* ── Not found ── */
  if (!property) return (
    <div className="dt-notfound">
      <FaHome className="dt-nf-icon" />
      <h2>Property not found</h2>
      <button className="dt-back-btn" onClick={() => navigate("/propertylisting")}>
        <FaArrowLeft /> Back to listings
      </button>
    </div>
  );

  const images    = Array.isArray(property.images) ? property.images : [];
  const amenities = parseAmenities(property.amenities);
  const locText   = [property.city, property.region].filter(Boolean).join(", ");
  const hasCords  = property.lat != null && property.lng != null;
  const currentImg = images.length > 0 ? getImageUrl(images[currentImageIndex]?.image) : "/default-house.jpg";

  const landlordRoute =
    property?.owner_source && property?.owner_reference_id
      ? `/landlord/${property.owner_source}/${property.owner_reference_id}`
      : null;

  const specs = [
    { icon: <FaHome />,         label: formatCat(property.category)        },
    { icon: <FaBed />,          label: `${property.bedrooms || 0} Bedrooms` },
    { icon: <FaBath />,         label: `${property.bathrooms || 0} Bathrooms` },
    { icon: <FaMapMarkerAlt />, label: property.region || "N/A"            },
    { icon: <FaMapMarkerAlt />, label: property.city || "N/A"              },
    ...(property.school ? [{ icon: <FaSchool />, label: property.school }] : []),
  ];

  return (
    <div className="dt-page">

      {/* ── HERO — gradient only ─────────────────────────────── */}
      <section className="dt-hero">
        <div className="dt-hero-texture" />
        <div className="dt-hero-glow" />

        <motion.div
          className="dt-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.button
            className="dt-back-btn"
            variants={fadeUp}
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft /> Back
          </motion.button>

          <motion.span className="dt-eyebrow" variants={fadeUp}>
            {formatCat(property.category)}
          </motion.span>

          <motion.h1 className="dt-hero-title" variants={fadeUp}>
            {property.property_name || "Untitled Property"}
          </motion.h1>

          <motion.p className="dt-hero-location" variants={fadeUp}>
            <FaMapMarkerAlt /> {locText || "Unknown location"}
          </motion.p>

          <motion.div className="dt-hero-pills" variants={fadeUp}>
            <span className="dt-pill">
              <FaBed /> {property.bedrooms || 0} Beds
            </span>
            <span className="dt-pill">
              <FaBath /> {property.bathrooms || 0} Baths
            </span>
            <span className="dt-pill dt-pill-price">
              GHS {property.price ? Number(property.price).toLocaleString() : "—"}/mo
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── BODY ────────────────────────────────────────────── */}
      <div className="dt-body">
        <div className="dt-left">

          {/* Image slider */}
          {images.length > 0 && (
            <motion.div
              className="dt-slider"
              variants={fadeLeft}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <img src={currentImg} alt={property.property_name} className="dt-slider-img" />

              {images.length > 1 && (
                <>
                  <button className="dt-slider-btn dt-slider-prev"
                    onClick={() => setCurrentImageIndex(p => p === 0 ? images.length - 1 : p - 1)}>
                    ‹
                  </button>
                  <button className="dt-slider-btn dt-slider-next"
                    onClick={() => setCurrentImageIndex(p => p === images.length - 1 ? 0 : p + 1)}>
                    ›
                  </button>
                  <div className="dt-slider-dots">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        className={`dt-slider-dot ${i === currentImageIndex ? "active" : ""}`}
                        onClick={() => setCurrentImageIndex(i)}
                      />
                    ))}
                  </div>
                  <div className="dt-slider-count">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Price + name */}
          <motion.div
            className="dt-card"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <div className="dt-card-title-row">
              <h2 className="dt-prop-name">{property.property_name}</h2>
              <span className="dt-price">
                GHS {property.price ? Number(property.price).toLocaleString() : "—"}
                <small>/mo</small>
              </span>
            </div>

            {/* Specs grid */}
            <div className="dt-specs">
              {specs.map((s, i) => (
                <div className="dt-spec" key={i}>
                  <span className="dt-spec-icon">{s.icon}</span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <motion.div
              className="dt-card"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <h3 className="dt-card-heading">Amenities & Features</h3>
              <div className="dt-amenities">
                {amenities.map((a, i) => (
                  <div className="dt-amenity" key={i}>
                    <FaCheckCircle className="dt-amenity-icon" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Landlord */}
          <motion.div
            className="dt-card dt-landlord-card"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <h3 className="dt-card-heading">Landlord</h3>
            <div className="dt-landlord">
              <div className="dt-landlord-avatar">
                {(property.owner_name || "L")[0].toUpperCase()}
              </div>
              <div>
                {landlordRoute ? (
                  <p
                    className="dt-landlord-name dt-landlord-link"
                    onClick={() => navigate(landlordRoute, {
                      state: {
                        ownerSource: property.owner_source,
                        ownerReferenceId: property.owner_reference_id,
                      },
                    })}
                  >
                    {property.owner_name || "N/A"}
                    <span className="dt-landlord-arrow">→ View Profile</span>
                  </p>
                ) : (
                  <p className="dt-landlord-name">{property.owner_name || "N/A"}</p>
                )}
                {property.owner_email && <p className="dt-landlord-info">{property.owner_email}</p>}
                {property.owner_phone && <p className="dt-landlord-info">{property.owner_phone}</p>}
              </div>
            </div>
          </motion.div>

          {/* Map */}
          {hasCords && (
            <motion.div
              className="dt-card"
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <h3 className="dt-card-heading">Location</h3>
              <MapContainer
                center={[parseFloat(property.lat), parseFloat(property.lng)]}
                zoom={15}
                style={{ height: "280px", width: "100%", borderRadius: "12px" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[parseFloat(property.lat), parseFloat(property.lng)]} />
              </MapContainer>
            </motion.div>
          )}

        </div>

        {/* ── Booking form ──────────────────────────────── */}
        <div className="dt-right">
          <div className="dt-form-sticky">
            <BookingForm property={property} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default Detail;