import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import "./LandLord.css";
import {
  FaEdit,
  FaChartBar,
  FaPhoneAlt,
  FaCheckCircle,
} from "react-icons/fa";
import RentalCard from "../../components/FeaturedRentals/RentalCard";

const Landlord = () => {
  const { id, type } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("posts");
  const [landlord, setLandlord] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loggedInRole = localStorage.getItem("role");
  const loggedInUserId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");

  const ownerSourceFromState = location.state?.ownerSource || null;
  const landlordType = type || ownerSourceFromState || null;

  const isOwnLandlordProfile =
    landlordType === "registered" &&
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

        const endpointOptions = landlordType
          ? [landlordType]
          : ["registered", "external"];

        let landlordData = null;
        let listingData = [];
        let resolvedType = null;

        for (const currentType of endpointOptions) {
          const detailBase =
            currentType === "registered"
              ? `/api/registered-landlords/${id}/`
              : `/api/external-landlords/${id}/`;

          const listingsBase =
            currentType === "registered"
              ? `/api/registered-landlords/${id}/properties/`
              : `/api/external-landlords/${id}/properties/`;

          const resLandlord = await fetch(detailBase);
          if (!resLandlord.ok) {
            continue;
          }

          const landlordJson = await resLandlord.json();
          landlordData = {
            ...landlordJson,
            owner_source: currentType,
          };
          resolvedType = currentType;

          const resListings = await fetch(listingsBase);
          if (resListings.ok) {
            const listingsJson = await resListings.json();
            listingData = Array.isArray(listingsJson)
              ? listingsJson
              : listingsJson.results || [];
          }

          break;
        }

        if (!landlordData) {
          setLandlord(null);
          setListings([]);
          return;
        }

        setLandlord({
          ...landlordData,
          title:
            landlordData.owner_source === "external"
              ? "External Property Owner"
              : landlordData.title || "Property Owner",
        });

        setListings(listingData);
      } catch (err) {
        console.error("Error fetching landlord data:", err);
        setLandlord(null);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLandlordData();
  }, [id, landlordType]);

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

  if (loading) {
    return <div className="loading-msg">Loading landlord profile...</div>;
  }

  if (!landlord) {
    return <div className="error-msg">Landlord not found.</div>;
  }

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
                alt={landlord.name || landlord.full_name || "Landlord"}
                className="profile-circle-img"
              />
            ) : (
              <div className="profile-circle-img initials-avatar">
                {getInitials(landlord.name || landlord.full_name)}
              </div>
            )}
          </div>

          <div className="profile-details-flex">
            <div className="landlord-text">
              <h1>
                {landlord.name || landlord.full_name || "Unnamed Landlord"}
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
                listings.map((prop) => (
                  <RentalCard
                    key={prop.id}
                    image={getImageUrl(prop)}
                    title={prop.property_name || "Untitled"}
                    city={[prop.city, prop.region].filter(Boolean).join(", ")}
                    amenities={parseAmenities(prop.amenities).slice(0, 3)}
                    price={prop.price}
                    onBook={() => handleViewDetails(prop)}
                    viewMode="grid"
                  />
                ))
              ) : (
                <p>
                  No listings found for{" "}
                  {landlord.name || landlord.full_name || "this landlord"}.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="reviews-tab">
            <p>
              No reviews yet for{" "}
              {landlord.name || landlord.full_name || "this landlord"}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Landlord;