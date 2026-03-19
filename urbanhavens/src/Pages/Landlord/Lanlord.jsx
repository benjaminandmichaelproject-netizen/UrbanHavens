import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./LandLord.css";
import { FaEdit, FaChartBar, FaPhoneAlt, FaCheckCircle } from "react-icons/fa";

const Landlord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("posts");
  const [landlord, setLandlord] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loggedInRole = localStorage.getItem("role");
  const loggedInUserId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");

  const isOwnLandlordProfile =
    (loggedInRole === "owner" || loggedInRole === "landlord") &&
    String(loggedInUserId) === String(id);

  const getInitials = (name) => {
    if (!name) return "L";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getImageUrl = (prop) => {
    const firstImage = prop?.images?.[0]?.image;
    if (!firstImage) return "/default-house.jpg";
    return firstImage;
  };

  const parseAmenities = (amenities) => {
    if (!amenities) return [];

    if (Array.isArray(amenities)) return amenities;

    if (typeof amenities === "string") {
      try {
        const parsed = JSON.parse(amenities);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return amenities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return [];
  };

  useEffect(() => {
    const fetchLandlordData = async () => {
      try {
        setLoading(true);

        const resLandlord = await fetch(`http://127.0.0.1:8000/api/landlords/${id}/`);
        const landlordData = resLandlord.ok ? await resLandlord.json() : null;

        if (!landlordData) {
          setLandlord(null);
          return;
        }

        setLandlord(landlordData);

        const resListings = await fetch(`http://127.0.0.1:8000/api/landlords/${id}/properties/`);
        const listingData = resListings.ok ? await resListings.json() : [];
        setListings(Array.isArray(listingData) ? listingData : []);
      } catch (err) {
        console.error("Error fetching landlord data:", err);
        setLandlord(null);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLandlordData();
  }, [id]);

  const handleViewDetails = (property) => navigate(`/detail/${property.id}`);

  const handleContactLandlord = () => {
    if (!token) {
      navigate("/login", {
        state: { message: "Please log in to contact the landlord." },
      });
      return;
    }

    if (landlord?.phone) {
      window.location.href = `tel:${landlord.phone}`;
      return;
    }

    alert("No contact number available for this landlord.");
  };

  const defaultCover =
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1974&auto=format&fit=crop";

  if (loading) return <div className="loading-msg">Loading landlord profile...</div>;
  if (!landlord) return <div className="error-msg">Landlord not found.</div>;

  return (
    <div className="landlord-page-wrapper">
      <div className="cover-section">
        <img
          src={landlord.coverPhoto || defaultCover}
          alt="Cover"
          className="cover-img"
        />
      </div>

      <div className="profile-header-content">
        <div className="profile-main-flex">
          <div className="profile-img-container">
            {landlord.photo ? (
              <img
                src={landlord.photo}
                alt={landlord.name || "Landlord"}
                className="profile-circle-img"
              />
            ) : (
              <div className="profile-circle-img initials-avatar">
                {getInitials(landlord.name)}
              </div>
            )}
          </div>

          <div className="profile-details-flex">
            <div className="landlord-text">
              <h1>
                {landlord.name || "Unnamed Landlord"}
                {landlord.is_verified && (
                  <span className="verified-badge">
                    <FaCheckCircle /> Verified
                  </span>
                )}
              </h1>

              <p className="professional-tag">
                {landlord.title || "Property Owner"}
              </p>

              <p className="contact-tag">
                {landlord.phone || "No contact info"}
              </p>
            </div>

            <div className="profile-btns">
              {isOwnLandlordProfile && (
                <button
                  type="button"
                  className="btn-blue"
                  onClick={() => navigate("/dashboard/owner")}
                >
                  <FaChartBar /> Dashboard
                </button>
              )}

              {isOwnLandlordProfile && (
                <button
                  type="button"
                  className="btn-gray"
                  onClick={() => navigate("/dashboard/owner/profile-edit")}
                >
                  <FaEdit /> Edit Profile
                </button>
              )}

              {!isOwnLandlordProfile && (
                <button
                  type="button"
                  className="btn-blue"
                  onClick={handleContactLandlord}
                >
                  <FaPhoneAlt /> Contact Landlord
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <hr className="nav-divider" />

      <div className="profile-nav-tabs">
        <button
          className={`nav-item ${activeTab === "posts" ? "active" : ""}`}
          onClick={() => setActiveTab("posts")}
        >
          All Posts
        </button>
        <button
          className={`nav-item ${activeTab === "reviews" ? "active" : ""}`}
          onClick={() => setActiveTab("reviews")}
        >
          Reviews
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "posts" && (
          <div className="property-cards-wrapper">
            <div className="property-cards">
              {listings.length > 0 ? (
                listings.map((prop) => {
                  const amenities = parseAmenities(prop.amenities);

                  return (
                    <div key={prop.id} className="property-card">
                      <img
                        src={getImageUrl(prop)}
                        alt={prop.property_name || "Property"}
                      />

                      <div className="property-card-info">
                        <h4>{prop.property_name || "Untitled"}</h4>

                        <p className="property-location">
                          {[prop.city, prop.region].filter(Boolean).join(", ") || "Unknown"}
                        </p>

                        <div className="property-amenities">
                          {amenities.length > 0 ? (
                            amenities.slice(0, 3).map((amenity, idx) => (
                              <span key={idx} className="amenity">
                                {amenity}
                              </span>
                            ))
                          ) : (
                            <span className="amenity">No amenities</span>
                          )}

                          {amenities.length > 3 && <span>...</span>}
                        </div>

                        <div className="price-view-d">
                          <p className="property-price">
                            {prop.price ? `GHS ${prop.price}` : "Contact"}
                          </p>

                          <button
                            type="button"
                            className="btn-view-details"
                            onClick={() => handleViewDetails(prop)}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p>No listings found for {landlord.name}.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="reviews-tab">
            <p>No reviews yet for {landlord.name}.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Landlord;