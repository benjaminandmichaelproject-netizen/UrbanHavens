import React, { useState } from "react";

const NUMBER_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

const PropertyDescription = ({ data = {}, update, next, prev }) => {
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    const formatted = ["price", "bedrooms", "bathrooms"].includes(name)
      ? Number(value) || 0
      : value;
    update({ [name]: formatted });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ── amenities ──
  // Manage amenities directly via update() — no local useState needed.
  // The parent (Uploadpage) already holds this in formData.property.amenities.
  const amenities = Array.isArray(data.amenities) ? data.amenities : [];

  const addAmenity = () => update({ amenities: [...amenities, ""] });

  const updateAmenity = (i, val) => {
    const copy = [...amenities];
    copy[i] = val;
    update({ amenities: copy });
  };

  const removeAmenity = (i) =>
    update({ amenities: amenities.filter((_, idx) => idx !== i) });

  // ── validation ──
  const validate = () => {
    const newErrors = {};
    if (!data.property_name?.trim()) newErrors.property_name = "Property name is required";
    if (!data.category)              newErrors.category      = "Category is required";
    if (data.category === "house_rent" && !data.property_type)
                                     newErrors.property_type = "Property type is required";
    if (!data.bedrooms || data.bedrooms < 1)   newErrors.bedrooms  = "Valid bedrooms required";
    if (!data.bathrooms || data.bathrooms < 1) newErrors.bathrooms = "Valid bathrooms required";
    if (!data.price || data.price <= 0)        newErrors.price     = "Valid price required";
    if (!data.description?.trim())             newErrors.description = "Description is required";

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
          <label>Property Name</label>
          <input
            name="property_name"
            value={data.property_name ?? ""}
            onChange={handleChange}
            className={errors.property_name ? "error-input" : ""}
          />
          {errors.property_name && <span className="error-text">{errors.property_name}</span>}
        </div>

        <div className="form-group">
          <label>Category</label>
          <select
            name="category"
            value={data.category ?? ""}
            onChange={handleChange}
            className={errors.category ? "error-input" : ""}
          >
            <option value="">Select</option>
            <option value="hostel">Hostel</option>
            <option value="house_rent">House for Rent</option>
          </select>
          {errors.category && <span className="error-text">{errors.category}</span>}
        </div>

        {data.category === "house_rent" && (
          <div className="form-group">
            <label>Property Type</label>
            <select
              name="property_type"
              value={data.property_type ?? ""}
              onChange={handleChange}
              className={errors.property_type ? "error-input" : ""}
            >
              <option value="">Select</option>
              <option value="apartment">Apartment</option>
              <option value="single_room">Single Room</option>
              <option value="chamber_hall">Chamber & Hall</option>
              <option value="self_contained">Self Contained</option>
              <option value="office">Office</option>
            </select>
            {errors.property_type && <span className="error-text">{errors.property_type}</span>}
          </div>
        )}

        <div className="form-group">
          <label>Bedrooms</label>
          <select
            name="bedrooms"
            value={data.bedrooms ?? ""}
            onChange={handleChange}
            className={errors.bedrooms ? "error-input" : ""}
          >
            <option value="">Select</option>
            {NUMBER_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {errors.bedrooms && <span className="error-text">{errors.bedrooms}</span>}
        </div>

        <div className="form-group">
          <label>Bathrooms</label>
          <select
            name="bathrooms"
            value={data.bathrooms ?? ""}
            onChange={handleChange}
            className={errors.bathrooms ? "error-input" : ""}
          >
            <option value="">Select</option>
            {NUMBER_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {errors.bathrooms && <span className="error-text">{errors.bathrooms}</span>}
        </div>

        <div className="form-group">
          <label>Price (GHS)</label>
          <input
            type="number"
            name="price"
            value={data.price ?? ""}
            onChange={handleChange}
            className={errors.price ? "error-input" : ""}
          />
          {errors.price && <span className="error-text">{errors.price}</span>}
        </div>
      </div>

      {/* Amenities */}
      <div className="form-group amenity-group">
        <label>Amenities</label>
        {amenities.map((item, i) => (
          <div key={i} className="amenity-row">
            <input
              value={item}
              onChange={(e) => updateAmenity(i, e.target.value)}
              placeholder={`Amenity ${i + 1}`}
            />
            <button
              className="clear-amenity-btn"
              onClick={() => removeAmenity(i)}
              aria-label="Remove amenity"
            >
              ✕
            </button>
          </div>
        ))}
        <button className="add-amenity-btn" onClick={addAmenity}>+ Add amenity</button>
      </div>

      <div className="form-group full-width">
        <label>Description</label>
        <textarea
          name="description"
          value={data.description ?? ""}
          onChange={handleChange}
          className={errors.description ? "error-input" : ""}
        />
        {errors.description && <span className="error-text">{errors.description}</span>}
      </div>

      <div className="form-actions-row">
        <button className="prv-btn" onClick={prev}>Previous</button>
        <button className="nxt-btn" onClick={handleNext}>Next</button>
      </div>
    </div>
  );
};

export default PropertyDescription;
