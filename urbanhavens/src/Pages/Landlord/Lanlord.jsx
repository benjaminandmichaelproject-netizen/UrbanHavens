import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaEdit, FaChartBar, FaPhoneAlt,
  FaCheckCircle, FaMapMarkerAlt, FaHome, FaStar,
} from "react-icons/fa";
import RentalCard from "../../components/FeaturedRentals/RentalCard";
import "./LandLord.css";

const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

const Landlord = () => {
  const { id, type } = useParams();
  const location     = useLocation();
  const navigate     = useNavigate();

  const [activeTab, setActiveTab] = useState("posts");
  const [landlord, setLandlord]   = useState(null);
  const [listings, setListings]   = useState([]);
  const [loading, setLoading]     = useState(true);

  const loggedInRole   = localStorage.getItem("role");
  const loggedInUserId = localStorage.getItem("userId");
  const token          = localStorage.getItem("token");

  const ownerSourceFromState = location.state?.ownerSource || null;
  const landlordType         = type || ownerSourceFromState || null;

  const isOwnProfile =
    landlordType === "registered" &&
    (loggedInRole === "owner" || loggedInRole === "landlord") &&
    String(loggedInUserId) === String(id);

  const getInitials = (name) => {
    if (!name) return "L";
    return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  const getImageUrl = (prop) => prop?.images?.[0]?.image || "/default-house.jpg";

  const parseAmenities = (a) => {
    if (!a) return [];
    if (Array.isArray(a)) return a;
    if (typeof a === "string") {
      try { const p = JSON.parse(a); return Array.isArray(p) ? p : []; }
      catch { return a.split(",").map(s => s.trim()).filter(Boolean); }
    }
    return [];
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const types = landlordType ? [landlordType] : ["registered", "external"];

        let landlordData = null;
        let listingData  = [];

        for (const t of types) {
          const base = t === "registered"
            ? `/api/registered-landlords/${id}/`
            : `/api/external-landlords/${id}/`;

          const res = await fetch(base);
          if (!res.ok) continue;

          landlordData = { ...(await res.json()), owner_source: t };

          const resL = await fetch(base.replace(/\/$/, "") + "/properties/");
          if (resL.ok) {
            const lj = await resL.json();
            listingData = Array.isArray(lj) ? lj : lj.results || [];
          }
          break;
        }

        if (!landlordData) { setLandlord(null); return; }

        setLandlord({
          ...landlordData,
          title: landlordData.owner_source === "external"
            ? "External Property Owner"
            : landlordData.title || "Property Owner",
        });
        setListings(listingData);
      } catch (err) {
        console.error(err);
        setLandlord(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, landlordType]);

  const handleContact = () => {
    if (!token) { navigate("/login", { state: { message: "Please log in to contact the landlord." } }); return; }
    if (landlord?.phone) { window.location.href = `tel:${landlord.phone}`; return; }
    alert("No contact number available.");
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="ll-loading">
      <div className="ll-spinner" />
      <p>Loading profile...</p>
    </div>
  );

  /* ── Not found ── */
  if (!landlord) return (
    <div className="ll-notfound">
      <FaHome className="ll-nf-icon" />
      <h2>Landlord not found</h2>
      <button className="ll-back-btn" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  );

  const displayName = landlord.name || landlord.full_name || "Unnamed Landlord";

  return (
    <div className="ll-page">

      {/* ── Cover — gradient + SVG decoration ────────────── */}
      <div className="ll-cover">
       
        <div className="ll-cover-fade" />
      </div>

      {/* ── Profile header ────────────────────────────────── */}
      <motion.div
        className="ll-profile-wrap"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Avatar */}
        <motion.div className="ll-avatar-row" variants={fadeUp}>
          <div className="ll-avatar">
            {landlord.photo
              ? <img src={landlord.photo} alt={displayName} className="ll-avatar-img" />
              : <span className="ll-avatar-initials">{getInitials(displayName)}</span>
            }
            {landlord.is_verified && (
              <span className="ll-verified-dot" title="Verified">
                <FaCheckCircle />
              </span>
            )}
          </div>
        </motion.div>

        {/* Name + meta */}
        <motion.div className="ll-meta" variants={fadeUp}>
          <div className="ll-name-row">
            <h1 className="ll-name">{displayName}</h1>
            {landlord.is_verified && (
              <span className="ll-verified-pill">
                <FaCheckCircle /> Verified
              </span>
            )}
          </div>

          <p className="ll-role">{landlord.title || "Property Owner"}</p>

          <div className="ll-info-row">
            {landlord.phone && (
              <span className="ll-info-chip">
                <FaPhoneAlt /> {landlord.phone}
              </span>
            )}
            {(landlord.city || landlord.region) && (
              <span className="ll-info-chip">
                <FaMapMarkerAlt />
                {[landlord.city, landlord.region].filter(Boolean).join(", ")}
              </span>
            )}
            <span className="ll-info-chip">
              <FaHome /> {listings.length} Listing{listings.length !== 1 ? "s" : ""}
            </span>
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div className="ll-btns" variants={fadeUp}>
          {isOwnProfile ? (
            <>
              <button className="ll-btn-primary" onClick={() => navigate("/dashboard/owner")}>
                <FaChartBar /> Dashboard
              </button>
              <button className="ll-btn-ghost" onClick={() => navigate("/dashboard/owner/profile-edit")}>
                <FaEdit /> Edit Profile
              </button>
            </>
          ) : (
            <button className="ll-btn-primary" onClick={handleContact}>
              <FaPhoneAlt /> Contact Landlord
            </button>
          )}
        </motion.div>
      </motion.div>

      {/* ── Stats bar ─────────────────────────────────────── */}
      <motion.div
        className="ll-stats-bar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="ll-stat">
          <strong>{listings.length}</strong>
          <span>Properties</span>
        </div>
        <div className="ll-stat-divider" />
        <div className="ll-stat">
          <strong>{landlord.is_verified ? "Yes" : "No"}</strong>
          <span>Verified</span>
        </div>
        <div className="ll-stat-divider" />
        <div className="ll-stat">
          <strong>
            <FaStar style={{ color: "#f59e0b", fontSize: "0.9rem" }} /> 4.8
          </strong>
          <span>Rating</span>
        </div>
        <div className="ll-stat-divider" />
        <div className="ll-stat">
          <strong>{landlord.owner_source === "registered" ? "Registered" : "External"}</strong>
          <span>Account Type</span>
        </div>
      </motion.div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div className="ll-tabs-wrap">
        <div className="ll-tabs">
          {["posts", "reviews"].map(tab => (
            <button
              key={tab}
              className={`ll-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "posts" ? "All Listings" : "Reviews"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────── */}
      <div className="ll-content">

        {activeTab === "posts" && (
          <motion.div
            className="ll-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {listings.length > 0 ? listings.map(p => (
              <RentalCard
  key={p.id}
  image={getImageUrl(p)}
  title={p.property_name || "Untitled"}
  city={p.city}
  region={p.region}
  category={p.category}
  price={p.price}
  amenities={parseAmenities(p.amenities).slice(0, 3)}
  onBook={() => navigate(`/detail/${p.id}`)}
  theme="light"
  isAvailable={p.is_available}
/>
            )) : (
              <div className="ll-empty">
                <FaHome className="ll-empty-icon" />
                <p>No listings found for {displayName}.</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "reviews" && (
          <div className="ll-reviews-empty">
            <FaStar className="ll-empty-icon" style={{ color: "#f59e0b" }} />
            <p>No reviews yet for {displayName}.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Landlord;