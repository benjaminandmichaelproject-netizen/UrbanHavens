import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faChevronDown,
  faThLarge,
  faList,
  faSlidersH,
  faTimes,
  faHome,
} from "@fortawesome/free-solid-svg-icons";
import RentalCard from "../../components/FeaturedRentals/RentalCard";
import "./PropertyListing.css";
import NearbyProperties from "../../components/NearbyProperties/NearbyProperties";
import FavAlert from "../../components/Modals/FavAlert";
import Footer from "../../components/Footer/Footer";

const categories = [
  { key: "all", label: "All Properties" },
  { key: "house_rent", label: "House for Rent" },
  { key: "hostel", label: "Hostel for Rent" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 36 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const stagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
};

const PropertyListing = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [displayed, setDisplayed] = useState([]);
  const [selectedCategory, setSelectedCat] = useState("all");
  const [searchTerm, setSearch] = useState("");
  const [dropdownOpen, setDropdown] = useState(false);
  const [viewMode, setView] = useState("grid");
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [showFavAlert, setShowFavAlert] = useState(false);
  const [favAlertMessage, setFavAlertMessage] = useState("");
  const [favAlertType, setFavAlertType] = useState("success");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/properties/");
        if (!res.ok) throw new Error("Failed to fetch properties.");

        const data = await res.json();
        const results = Array.isArray(data) ? data : data.results || [];

        setProperties(results);
        setDisplayed(results);
      } catch (err) {
        setError(err.message || "Something went wrong.");
        setProperties([]);
        setDisplayed([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getImageUrl = (property) =>
    property?.images?.[0]?.image || property?.image || "/default-house.jpg";

  const getAmenities = (amenities) => {
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

  const getAvailability = (property) => {
    if (typeof property?.is_available === "boolean") {
      return property.is_available;
    }

    const status = String(property?.status || "").toLowerCase().trim();

    if (
      ["unavailable", "not available", "occupied", "booked", "rented"].includes(
        status
      )
    ) {
      return false;
    }

    return true;
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

      if (!res.ok) return;

      const data = await res.json();
      const ids = Array.isArray(data)
        ? data.map((item) => item.property?.id).filter(Boolean)
        : [];

      setFavoriteIds(ids);
    } catch {
      setFavoriteIds([]);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

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
        navigate("/login");
        return;
      }

      if (!res.ok) throw new Error("Failed to update favorite.");

      setFavoriteIds((prev) =>
        isAlreadyFavorited
          ? prev.filter((id) => id !== propertyId)
          : [...prev, propertyId]
      );

      setFavAlertMessage(
        isAlreadyFavorited
          ? "Property removed from favorites."
          : "Property added to favorites."
      );
      setFavAlertType(isAlreadyFavorited ? "error" : "success");
      setShowFavAlert(true);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = useMemo(() => {
    let list = [...properties];

    if (selectedCategory !== "all") {
      list = list.filter((property) => property.category === selectedCategory);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();

      list = list.filter(
        (property) =>
          property.property_name?.toLowerCase().includes(q) ||
          property.city?.toLowerCase().includes(q) ||
          property.region?.toLowerCase().includes(q) ||
          property.school?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [properties, selectedCategory, searchTerm]);

  useEffect(() => {
    setFilterLoading(true);

    const timer = setTimeout(() => {
      setDisplayed(filtered);
      setFilterLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [filtered]);

  const catLabel =
    categories.find((category) => category.key === selectedCategory)?.label ||
    "Category";

  return (
    <div className="pl-page">
      <section className="pl-hero">
        <div className="pl-hero-overlay" />
        <div className="pl-hero-texture" />

        <motion.div
          className="pl-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.span className="pl-eyebrow" variants={fadeUp}>
            CURATED RENTALS
          </motion.span>

          <motion.h1 className="pl-hero-title" variants={fadeUp}>
            Find Your <span className="pl-accent">Perfect Home</span>
          </motion.h1>

          <motion.p className="pl-hero-sub" variants={fadeUp}>
            Discover verified houses, hostels, and apartments across Accra &
            Kumasi
          </motion.p>

          <motion.div className="pl-hero-btns" variants={fadeUp}>
            <button
              className="pl-btn-primary"
              onClick={() =>
                document
                  .getElementById("pl-search")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Browse Properties →
            </button>

            <button className="pl-btn-ghost">Talk to Us</button>
          </motion.div>
        </motion.div>
      </section>

      <section className="pl-search-section" id="pl-search">
        <motion.div
          className="pl-search-box"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <div className="pl-search-header">
            <span className="pl-eyebrow-light">FIND A PROPERTY</span>
            <h2 className="pl-search-title">
              Choose Your{" "}
              <span className="pl-accent-dark">Perfect Home</span>
            </h2>
          </div>

          <div className="pl-controls">
            <div className="pl-input-wrap">
              <FontAwesomeIcon icon={faSearch} className="pl-search-icon" />

              <input
                type="text"
                placeholder="Search by city, region or school..."
                value={searchTerm}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-input"
              />

              {searchTerm && (
                <button
                  type="button"
                  className="pl-input-clear"
                  onClick={() => setSearch("")}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </div>

            <div className="pl-controls-right">
              <div
                className={`pl-dropdown ${dropdownOpen ? "open" : ""}`}
                onClick={() => setDropdown((prev) => !prev)}
              >
                <span>{catLabel}</span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="pl-chevron"
                />

                <ul className="pl-dropdown-menu">
                  {categories.map((category) => (
                    <li
                      key={category.key}
                      className={
                        category.key === selectedCategory ? "active" : ""
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCat(category.key);
                        setDropdown(false);
                      }}
                    >
                      {category.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pl-view-toggle">
                <button
                  type="button"
                  className={`pl-toggle-btn ${
                    viewMode === "grid" ? "active" : ""
                  }`}
                  onClick={() => setView("grid")}
                  title="Grid view"
                >
                  <FontAwesomeIcon icon={faThLarge} />
                </button>

                <button
                  type="button"
                  className={`pl-toggle-btn ${
                    viewMode === "list" ? "active" : ""
                  }`}
                  onClick={() => setView("list")}
                  title="List view"
                >
                  <FontAwesomeIcon icon={faList} />
                </button>
              </div>

              <button type="button" className="pl-filter-btn">
                <FontAwesomeIcon icon={faSlidersH} /> Filters
              </button>
            </div>
          </div>

          {!loading && !error && (
            <p className="pl-result-count">
              {filterLoading
                ? "Searching..."
                : `${displayed.length} propert${
                    displayed.length === 1 ? "y" : "ies"
                  } found`}
            </p>
          )}
        </motion.div>
      </section>

      <section className="pl-nearby-section">
        <NearbyProperties />
      </section>

      <section className="pl-grid-section">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              className="pl-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="pl-spinner" />
              <p>Loading properties...</p>
            </motion.div>
          ) : error ? (
            <motion.p
              key="error"
              className="pl-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          ) : filterLoading ? (
            <motion.div
              key="filter"
              className="pl-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="pl-spinner" />
              <p>Filtering...</p>
            </motion.div>
          ) : displayed.length > 0 ? (
            <motion.div
              key={`results-${viewMode}`}
              className={`pl-cards ${
                viewMode === "list"
                  ? "pl-cards-list"
                  : "featured-rentals-grid pl-cards-grid"
              }`}
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {displayed.map((property) => (
                <div
                  key={property.id}
                  className={`pl-card-shell ${
                    viewMode === "list" ? "pl-card-shell-list" : ""
                  }`}
                >
                  <RentalCard
                    image={getImageUrl(property)}
                    title={property.property_name}
                    city={property.city}
                    region={property.region}
                    category={property.category}
                    price={property.price}
                    amenities={getAmenities(property.amenities)}
                    onBook={() => navigate(`/detail/${property.id}`)}
                    isAvailable={getAvailability(property)}
                    isFavorited={favoriteIds.includes(property.id)}
                    onFavorite={() => toggleFavorite(property.id)}
                  />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="pl-empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="pl-empty-icon-wrap">
                <FontAwesomeIcon icon={faHome} className="pl-empty-icon" />
              </div>

              <h3 className="pl-empty-title">No Properties Found</h3>
              <p className="pl-empty-desc">
                Try adjusting your search term or selecting a different
                category.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <FavAlert
        show={showFavAlert}
        message={favAlertMessage}
        type={favAlertType}
        onClose={() => setShowFavAlert(false)}
      />

      <Footer />
    </div>
  );
};

export default PropertyListing;