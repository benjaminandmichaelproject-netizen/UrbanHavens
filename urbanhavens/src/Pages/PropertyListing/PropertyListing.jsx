import React, { useState } from 'react';
import './PropertyListing.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faChevronDown, faThLarge, faList, faSlidersH } from "@fortawesome/free-solid-svg-icons";

import HouseForRent from './HouseForRent/HouseForRent';
import Hostel from './hostelForRent/Hostel';

const categories = ["house", "hostel"]; // can expand later

const PropertyListing = () => {
  const [selectedCategory, setSelectedCategory] = useState("house");
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // Grid or List

  const renderCategoryComponent = () => {
    if (selectedCategory === "house") return <HouseForRent viewMode={viewMode} />;
    if (selectedCategory === "hostel") return <Hostel viewMode={viewMode} />;
    return <p>No category selected</p>;
  };

  return (
    <div className="property-page-wrapper">
      {/* HERO SECTION */}
      <section className="hero-container3">
        <div className="hero-content-overlay">
          <div className="hero-inner-layout">
            <div className="hero-text-block">
              <span className="hero-label">CURATED STAYS</span>
              <h1>Find Your <span>Perfect Stay</span> with Us</h1>
              <p>Discover unique homes, apartments, and experiences worldwide.</p>
              <div className="hero-action-btns">
                <button className="btn-white">Browse stays</button>
                <button className="btn-glass">Talk to concierge</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH / FILTER */}
      <section className="fleet-section-container">
        <div className="fleet-section">
          <div className="fleet-header">
            <span className="small-title centered">FLEET</span>
            <h2>Choose the <span>perfect Home</span></h2>
          </div>

          <div className="search-container-box">
            <div className="search-bar-wrapper">
              <div className="search-input-group">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input type="text" placeholder="Search by location..." className="main-search-input" />
              </div>

              <div className="search-controls">
                <div className={`dropdown-control ${isDropdownOpen ? "open" : ""}`} onClick={() => setDropdownOpen(!isDropdownOpen)}>
                  <span>{selectedCategory === "house" ? "House for Rent" : "Hostel for Rent"}</span>
                  <FontAwesomeIcon icon={faChevronDown} className="chevron-icon" />
                  <ul className="dropdown-menu">
                    {categories.map((cat) => (
                      <li key={cat} onClick={() => { setSelectedCategory(cat); setDropdownOpen(false); }}>
                        {cat === "house" ? "House for Rent" : "Hostel for Rent"}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="view-toggle">
                  <button className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}>
                    <FontAwesomeIcon icon={faThLarge} />
                  </button>
                  <button className={`toggle-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>
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

      {/* PROPERTIES SECTION */}
      <section className='properties'>
        {renderCategoryComponent()}
      </section>
    </div>
  );
};

export default PropertyListing;