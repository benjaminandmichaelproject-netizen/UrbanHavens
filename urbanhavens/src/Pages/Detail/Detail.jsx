import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import BookingForm from "../../components/BookingForm/BookingForm";
import { FaBath, FaRulerCombined, FaHome, FaBed } from "react-icons/fa";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Detail.css";

// Fix default Leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const Detail = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);

        const token = localStorage.getItem("token");

        const res = await fetch(`/api/properties/${id}/`, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        });

        if (!res.ok) {
          throw new Error("Failed to fetch property");
        }

        const data = await res.json();
        setProperty(data);
      } catch (err) {
        console.error("Error fetching property:", err);
        setProperty(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

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

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/default-house.jpg";
    return imagePath;
  };

  const formatCategory = (category) => {
    if (!category) return "N/A";
    if (category === "house_rent") return "House for Rent";
    if (category === "hostel") return "Hostel";
    return category;
  };

  const landlordRoute =
    property?.owner_source && property?.owner_reference_id
      ? `/landlord/${property.owner_source}/${property.owner_reference_id}`
      : null;
if (loading) {
  return (
    <div className="detail-loading">
      <div className="loader-box">
        <div className="spinner"></div>
        <h2>Loading property details...</h2>
      </div>
    </div>
  );
}
  if (!property) {
    return (
      <div className="detail-main loading">
        <h2>Property details not found.</h2>
        <button className="btn-primary" onClick={() => navigate("/")}>
          Go back to listings
        </button>
      </div>
    );
  }

  const images = Array.isArray(property.images) ? property.images : [];
  const amenities = parseAmenities(property.amenities);

  const heroImage =
    images.length > 0 ? getImageUrl(images[0].image) : "/default-house.jpg";

  const currentImage =
    images.length > 0
      ? getImageUrl(images[currentImageIndex]?.image)
      : "/default-house.jpg";

  const locationText = [property.city, property.region]
    .filter(Boolean)
    .join(", ");

  const hasCoordinates =
    property.lat !== null &&
    property.lat !== undefined &&
    property.lng !== null &&
    property.lng !== undefined;

  return (
    <div className="detail-main">
      <section
        className="detail-hero"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="detail-hero-overlay">
          <div className="detail-hero-content">
            <p className="hero-location">{locationText || "Unknown location"}</p>

            <h1>{property.property_name || "Untitled Property"}</h1>

            <p className="hero-sub">
              {formatCategory(property.category)} -{" "}
              {property.property_type || "N/A"}
            </p>

            <div className="hero-meta">
              <span>
                {property.price ? `GHS ${property.price}/month` : "Contact"}
              </span>
              <span>{property.bedrooms || 0} Beds</span>
              <span>{property.bathrooms || 0} Baths</span>
            </div>

            <div className="landlord-profile">
              <p>
                Landlord:{" "}
                {landlordRoute ? (
                  <span
                    onClick={() =>
                      navigate(landlordRoute, {
                        state: {
                          ownerSource: property.owner_source,
                          ownerReferenceId: property.owner_reference_id,
                        },
                      })
                    }
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                  >
                    {property.owner_name || "N/A"}
                  </span>
                ) : (
                  <span>{property.owner_name || "N/A"}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="detail-container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Go Back
        </button>

        <div className="detail-main-container">
          <div className="detail">
            {images.length > 0 && (
              <div className="detailed-images">
                <div className="image-slider">
                  {images.length > 1 && (
                    <button
                      className="prev-btn"
                      onClick={() =>
                        setCurrentImageIndex((prev) =>
                          prev === 0 ? images.length - 1 : prev - 1
                        )
                      }
                    >
                      ◀
                    </button>
                  )}

                  <img
                    src={currentImage}
                    alt={`${property.property_name} image ${
                      currentImageIndex + 1
                    }`}
                  />

                  {images.length > 1 && (
                    <button
                      className="next-btn"
                      onClick={() =>
                        setCurrentImageIndex((prev) =>
                          prev === images.length - 1 ? 0 : prev + 1
                        )
                      }
                    >
                      ▶
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="detail-info">
              <div className="price-specs">
                <div className="price-sp">
                  <h1>{property.property_name}</h1>
                  <p className="price">
                    {property.price
                      ? `GHS ${property.price}/month`
                      : "Contact for price"}
                  </p>
                </div>

                <div className="specs">
                  <div className="spec-item">
                    <div className="spec-icon">
                      <FaHome />
                    </div>
                    <span>{formatCategory(property.category)}</span>
                  </div>

                  <div className="spec-item">
                    <div className="spec-icon">
                      <FaHome />
                    </div>
                    <span>{property.property_type || "N/A"}</span>
                  </div>

                  <div className="spec-item">
                    <div className="spec-icon">
                      <FaBed />
                    </div>
                    <span>{property.bedrooms || 0} Bedrooms</span>
                  </div>

                  <div className="spec-item">
                    <div className="spec-icon">
                      <FaBath />
                    </div>
                    <span>{property.bathrooms || 0} Bathrooms</span>
                  </div>

                  <div className="spec-item">
                    <div className="spec-icon">
                      <FaRulerCombined />
                    </div>
                    <span>{property.region || "N/A"}</span>
                  </div>

                  <div className="spec-item">
                    <div className="spec-icon">
                      <FaRulerCombined />
                    </div>
                    <span>{property.city || "N/A"}</span>
                  </div>

                  {property.school && (
                    <div className="spec-item">
                      <div className="spec-icon">
                        <FaRulerCombined />
                      </div>
                      <span>{property.school}</span>
                    </div>
                  )}

                  {amenities.length > 0 &&
                    amenities.map((amenity, idx) => (
                      <div key={idx} className="spec-item">
                        <div className="spec-icon">
                          <FaHome />
                        </div>
                        <span>{amenity}</span>
                      </div>
                    ))}
                </div>
              </div>

              {hasCoordinates && (
                <div className="property-map">
                  <h3>Location</h3>
                  <MapContainer
                    center={[parseFloat(property.lat), parseFloat(property.lng)]}
                    zoom={15}
                    style={{
                      height: "300px",
                      width: "100%",
                      borderRadius: "8px",
                      marginBottom: "20px",
                    }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker
                      position={[
                        parseFloat(property.lat),
                        parseFloat(property.lng),
                      ]}
                    />
                  </MapContainer>
                </div>
              )}
            </div>
          </div>

          <div className="detail-form">
            <BookingForm property={property} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detail;