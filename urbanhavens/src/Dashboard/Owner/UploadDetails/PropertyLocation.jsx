import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import SchoolAutocomplete from "./Schoolautocomplete";
import { api } from "./api/api";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Default map centre per region value
const REGION_CENTERS = {};

const PropertyLocation = ({ data = {}, update, next, prev }) => {
  const [errors, setErrors]   = useState({});
  const [regions, setRegions] = useState([]);

  // Fetch available regions dynamically from schools
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        // Get distinct regions from schools endpoint
        const res = await api.get("/schools/regions/");
        if (Array.isArray(res.data)) {
          setRegions(res.data);
          res.data.forEach((r) => {
            if (r.center_lat && r.center_lng) {
              REGION_CENTERS[r.value] = [r.center_lat, r.center_lng];
            }
          });
        }
      } catch {
        // Fallback — always show at minimum these two
        setRegions([
          { value: "greater_accra", label: "Greater Accra", center_lat: 5.6037,  center_lng: -0.187  },
          { value: "ashanti",       label: "Ashanti (Kumasi)", center_lat: 6.6885, center_lng: -1.6244 },
        ]);
      }
    };
    fetchRegions();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    update({ [name]: value?.trim() });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleRegionChange = (e) => {
    const value = e.target.value;
    update({ region: value, lat: null, lng: null });
    setErrors((prev) => ({ ...prev, region: "", map: "" }));
  };

  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        update({ lat: e.latlng.lat, lng: e.latlng.lng });
        setErrors((prev) => ({ ...prev, map: "" }));
      },
    });
    if (!data.lat || !data.lng) return null;
    return <Marker position={[data.lat, data.lng]} />;
  };

  const validate = () => {
    const newErrors = {};
    if (!data.region)       newErrors.region = "Region is required";
    if (!data.city?.trim()) newErrors.city   = "City / Area is required";
    if (!data.lat || !data.lng) newErrors.map = "You must pin the location on the map";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => { if (validate()) next(); };

  const selectedRegion = regions.find((r) => r.value === data.region);
  const mapCenter =
    data.lat && data.lng
      ? [data.lat, data.lng]
      : selectedRegion
      ? [selectedRegion.center_lat, selectedRegion.center_lng]
      : [5.6037, -0.187];

  return (
    <div className="form-section">
      <div className="form-grid">

        {/* Region — dynamic from backend */}
        <div className="form-group">
          <label>Region</label>
          <select
            name="region"
            value={data.region ?? ""}
            onChange={handleRegionChange}
            className={errors.region ? "error-input" : ""}
          >
            <option value="">Select Region</option>
            {regions.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {errors.region && <span className="error-text">{errors.region}</span>}
        </div>

        {/* City / Area */}
        <div className="form-group">
          <label>City / Area</label>
          <input
            name="city"
            value={data.city ?? ""}
            onChange={handleChange}
            placeholder="e.g. East Legon, Spintex, KNUST Area"
            className={errors.city ? "error-input" : ""}
          />
          {errors.city && <span className="error-text">{errors.city}</span>}
        </div>

        {/* School autocomplete */}
        <div className="form-group">
          <label>
            Nearest School / University{" "}
            <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
          </label>
          <SchoolAutocomplete
            value={data.school ?? ""}
            onChange={(val) => {
              update({ school: val });
              setErrors((prev) => ({ ...prev, school: "" }));
            }}
            placeholder="Start typing school name..."
          />
        </div>

        {/* Map */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label>Pin Property Location on Map</label>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 8px" }}>
            Click on the map to drop a pin at the exact property location.
          </p>
          <MapContainer
            key={data.region ?? "default"}
            center={mapCenter}
            zoom={13}
            style={{ height: "300px", width: "100%", borderRadius: "8px" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker />
          </MapContainer>
          {data.lat && data.lng && (
            <p style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "6px" }}>
              ✓ Location pinned: {data.lat.toFixed(5)}, {data.lng.toFixed(5)}
            </p>
          )}
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
