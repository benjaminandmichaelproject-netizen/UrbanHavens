import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon issue in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const PropertyLocation = ({ data = {}, update, next, prev }) => {
  const [errors, setErrors] = useState({});

  const regions = [
    { label: "Greater Accra", value: "greater_accra" },
    { label: "Ashanti", value: "ashanti" },
    { label: "Western", value: "western" },
    { label: "Eastern", value: "eastern" },
  ];

  const schools = [
    { label: "University of Ghana", value: "ug" },
    { label: "KNUST", value: "knust" },
    { label: "Ashesi University", value: "ashesi" },
  ];

  // Handle select/input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    update({ [name]: value?.trim() });
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  // Leaflet map click to update marker
  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        update({ lat, lng });
        setErrors(prev => ({ ...prev, lat: "", lng: "" }));
      },
    });

    if (!data.lat || !data.lng) return null;
    return <Marker position={[data.lat, data.lng]} />;
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    if (!data.region) newErrors.region = "Region is required";
    if (!data.city?.trim()) newErrors.city = "City is required";
    if (data.category === "hostel" && !data.school) newErrors.school = "School is required";
    if (!data.lat || !data.lng) newErrors.map = "You must select a location on the map";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) next();
  };

  return (
    <div className="form-section">
      <div className="form-grid">
        <div className="form-group">
          <label>Region</label>
          <select name="region" value={data.region || ""} onChange={handleChange}>
            <option value="">Select</option>
            {regions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {errors.region && <span className="error-text">{errors.region}</span>}
        </div>

        <div className="form-group">
          <label>City</label>
          <input name="city" value={data.city || ""} onChange={handleChange} />
          {errors.city && <span className="error-text">{errors.city}</span>}
        </div>

        {data.category === "hostel" && (
          <div className="form-group">
            <label>Nearby School</label>
            <select name="school" value={data.school || ""} onChange={handleChange}>
              <option value="">Select</option>
              {schools.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {errors.school && <span className="error-text">{errors.school}</span>}
          </div>
        )}

        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label>Pick Location on Map</label>
          <MapContainer
            center={data.lat && data.lng ? [data.lat, data.lng] : [5.6037, -0.1870]} // default Accra
            zoom={13}
            style={{ height: "300px", width: "100%", borderRadius: "8px" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker />
          </MapContainer>
          {errors.map && <span className="error-text">{errors.map}</span>}
        </div>
      </div>

      <div className="form-actions-row">
        <button className="prv-btn" onClick={prev}>Previous</button>
        <button className="nxt-btn" onClick={handleNext}>Next</button>
      </div>
    </div>
  );
};

export default PropertyLocation;