import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PropertyListing.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faChevronDown,
  faThLarge,
  faList,
  faSlidersH,
} from "@fortawesome/free-solid-svg-icons";
import RentalCard from "../../components/FeaturedRentals/RentalCard";

const categories = [
  { key: "all", label: "All Properties" },
  { key: "house_rent", label: "House for Rent" },
  { key: "hostel", label: "Hostel for Rent" },
];

const PropertyListing = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [displayedProperties, setDisplayedProperties] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
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

        setProperties(results);
        setDisplayedProperties(results);
      } catch (err) {
        console.error("Error fetching properties:", err);
        setError(err.message || "Something went wrong.");
        setProperties([]);
        setDisplayedProperties([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const getImageUrl = (property) => {
    const firstImage = property?.images?.[0]?.image;
    if (!firstImage) return "/default-house.jpg";
    return firstImage;
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

  const filteredProperties = useMemo(() => {
    let filtered = [...properties];

    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (property) => property.category === selectedCategory
      );
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();

      filtered = filtered.filter((property) => {
        return (
          property.property_name?.toLowerCase().includes(query) ||
          property.city?.toLowerCase().includes(query) ||
          property.region?.toLowerCase().includes(query) ||
          property.school?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [properties, selectedCategory, searchTerm]);

  useEffect(() => {
    setFilterLoading(true);

    const timer = setTimeout(() => {
      setDisplayedProperties(filteredProperties);
      setFilterLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [filteredProperties]);

  const selectedLabel =
    categories.find((cat) => cat.key === selectedCategory)?.label ||
    "Select Category";

  return (
    <div className="property-page-wrapper">
      <section className="hero-container3">
        <div className="hero-content-overlay">
          <div className="hero-inner-layout">
            <div className="hero-text-block">
              <span className="hero-label">CURATED STAYS</span>
              <h1>
                Find Your <span>Perfect Stay</span> with Us
              </h1>
              <p>
                Discover unique homes, apartments, and experiences worldwide.
              </p>
              <div className="hero-action-btns">
                <button className="btn-white">Browse stays</button>
                <button className="btn-glass">Talk to concierge</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="fleet-section-container">
        <div className="fleet-section">
          <div className="fleet-header">
            <span className="small-title centered">FLEET</span>
            <h2>
              Choose the <span>perfect Home</span>
            </h2>
          </div>

          <div className="search-container-box">
            <div className="search-bar-wrapper">
              <div className="search-input-group">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by location..."
                  className="main-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="search-controls">
                <div
                  className={`dropdown-control ${isDropdownOpen ? "open" : ""}`}
                  onClick={() => setDropdownOpen(!isDropdownOpen)}
                >
                  <span>{selectedLabel}</span>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="chevron-icon"
                  />

                  <ul className="dropdown-menu">
                    {categories.map((cat) => (
                      <li
                        key={cat.key}
                        onClick={() => {
                          setSelectedCategory(cat.key);
                          setDropdownOpen(false);
                        }}
                      >
                        {cat.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="view-toggle">
                  <button
                    className={`toggle-btn ${
                      viewMode === "grid" ? "active" : ""
                    }`}
                    onClick={() => setViewMode("grid")}
                  >
                    <FontAwesomeIcon icon={faThLarge} />
                  </button>

                  <button
                    className={`toggle-btn ${
                      viewMode === "list" ? "active" : ""
                    }`}
                    onClick={() => setViewMode("list")}
                  >
                    <FontAwesomeIcon icon={faList} />
                  </button>
                </div>

                <button className="filter-btn">
                  <FontAwesomeIcon icon={faSlidersH} /> Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="properties">
        {loading ? (
          <div className="property-loader-container">
            <div className="spinner"></div>
            <p>Loading properties...</p>
          </div>
        ) : error ? (
          <p className="property-message error">{error}</p>
        ) : filterLoading ? (
          <div className="property-loader-container fade-in">
            <div className="spinner"></div>
            <p>Filtering properties...</p>
          </div>
        ) : displayedProperties.length > 0 ? (
          <div className="prop-container">
            <div
              className={`property-cards ${
                viewMode === "list" ? "list-view" : "grid-view"
              } fade-in`}
            >
              {displayedProperties.map((property) => (
                <RentalCard
                  key={property.id}
                  image={getImageUrl(property)}
                  title={property.property_name}
                  city={`${property.city || ""}, ${property.region || ""}`}
                  price={property.price}
                  amenities={getAmenitiesPreview(property.amenities)}
                  onBook={() => navigate(`/detail/${property.id}`)}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="property-message">No properties found.</p>
        )}
      </section>
    </div>
  );
};

export default PropertyListing;