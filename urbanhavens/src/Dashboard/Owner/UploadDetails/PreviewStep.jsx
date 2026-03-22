import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const PreviewStep = ({ formData, files, prev, finish, isSubmitting }) => {
  const { personal_info = {}, identification = {}, property = {}, property_location = {} } = formData;

  const [idImageUrl, setIdImageUrl] = useState(null);
  const [propertyImageUrls, setPropertyImageUrls] = useState([]);

  useEffect(() => {
    if (files.identification?.id_image instanceof File) {
      const url = URL.createObjectURL(files.identification.id_image);
      setIdImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setIdImageUrl(null);
  }, [files.identification]);

  useEffect(() => {
    const imageFiles = Array.isArray(files.property_images?.property_images)
      ? files.property_images.property_images
      : [];

    if (imageFiles.length > 0) {
      const urls = imageFiles.map((file) =>
        file instanceof File ? URL.createObjectURL(file) : null
      );

      setPropertyImageUrls(urls);

      return () => {
        urls.forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        });
      };
    }

    setPropertyImageUrls([]);
  }, [files.property_images]);

  return (
    <div className="form-section">
      <h2>Preview & Confirm</h2>

      {/* <div className="preview-section">
        <h3>Personal Info</h3>
        <p><strong>First Name:</strong> {personal_info.first_name}</p>
        <p><strong>Last Name:</strong> {personal_info.last_name}</p>
        <p><strong>Contact:</strong> {personal_info.contact}</p>
        <p><strong>Nationality:</strong> {personal_info.nationality}</p>
        <p><strong>Age:</strong> {personal_info.age}</p>
        <p><strong>Gender:</strong> {personal_info.gender}</p>
      </div>

      <div className="preview-section">
        <h3>Identification</h3>
        <p><strong>ID Type:</strong> {identification.id_type}</p>
        <p><strong>ID Number:</strong> {identification.id_number}</p>
        {idImageUrl && <img src={idImageUrl} alt="ID Preview" className="preview-img" />}
      </div> */}

      <div className="preview-section">
        <h3>Property</h3>
        <p><strong>Name:</strong> {property.property_name}</p>
        <p><strong>Category:</strong> {property.category}</p>
        <p><strong>Type:</strong> {property.property_type}</p>
        <p><strong>Bedrooms:</strong> {property.bedrooms}</p>
        <p><strong>Bathrooms:</strong> {property.bathrooms}</p>
        <p><strong>Price:</strong> GHS {property.price}</p>
        <p><strong>Furnishing:</strong> {property.furnishing}</p>
        <p><strong>Description:</strong> {property.description}</p>
        {property.amenities?.length > 0 && (
          <p><strong>Amenities:</strong> {property.amenities.join(", ")}</p>
        )}
      </div>

      <div className="preview-section">
        <h3>Location</h3>
        <p><strong>Region:</strong> {property_location.region}</p>
        <p><strong>City:</strong> {property_location.city}</p>
        {property_location.school && (
          <p><strong>Nearby School:</strong> {property_location.school}</p>
        )}

        {property_location.lat && property_location.lng && (
          <MapContainer
            center={[property_location.lat, property_location.lng]}
            zoom={15}
            style={{ height: "300px", width: "100%", borderRadius: "8px" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[property_location.lat, property_location.lng]} />
          </MapContainer>
        )}
      </div>

      <div className="preview-section">
        <h3>Property Images</h3>
        <div className="image-preview-grid">
          {propertyImageUrls.map((url, i) =>
            url ? (
              <img key={i} src={url} alt={`property ${i + 1}`} className="preview-img" />
            ) : null
          )}
        </div>
      </div>

      <div className="form-actions-row">
        <button className="prv-btn" onClick={prev}>Previous</button>
        <button className="nxt-btn" onClick={finish} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
};

export default PreviewStep;