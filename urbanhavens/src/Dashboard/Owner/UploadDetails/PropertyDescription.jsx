import React, { useMemo, useState } from "react";

const NUMBER_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const ROOM_OPTIONS = Array.from({ length: 50 }, (_, i) => i + 1);
const CAPACITY_OPTIONS = Array.from({ length: 6 }, (_, i) => i + 1);

const createEmptyRoom = (index = 1, propertyType = "mixed") => ({
  temp_id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  room_number: "",
  room_type: "mixed",
  gender_restriction:
    propertyType === "male_only"
      ? "male"
      : propertyType === "female_only"
      ? "female"
      : "mixed",
  max_capacity: 1,
  price_override: "",
});

const PropertyDescription = ({ data = {}, update, next, prev }) => {
  const [errors, setErrors] = useState({});

  const isHostel = data.category === "hostel";
  const amenities = Array.isArray(data.amenities) ? data.amenities : [];
  const rooms = Array.isArray(data.rooms) ? data.rooms : [];

  const normalizedRooms = useMemo(() => rooms, [rooms]);

  const updateRooms = (newRooms) => {
    update({ rooms: newRooms });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    const formatted = ["price", "bedrooms", "bathrooms"].includes(name)
      ? Number(value) || 0
      : value;

    if (name === "category") {
      if (value === "hostel") {
        update({
          category: value,
          bathrooms: 1,
          property_type: "",
          rooms:
            normalizedRooms.length > 0
              ? normalizedRooms
              : [createEmptyRoom(1)],
        });
      } else {
        update({
          category: value,
          property_type: "",
          rooms: [],
        });
      }

      setErrors((prev) => ({ ...prev, [name]: "" }));
      return;
    }

    if (name === "property_type" && isHostel) {
      const mappedGender =
        value === "male_only"
          ? "male"
          : value === "female_only"
          ? "female"
          : "mixed";

      update({
        property_type: value,
        rooms: normalizedRooms.map((room) => ({
          ...room,
          gender_restriction: mappedGender,
        })),
      });

      setErrors((prev) => ({ ...prev, [name]: "", rooms: "" }));
      return;
    }

    update({ [name]: formatted });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const addAmenity = () => update({ amenities: [...amenities, ""] });

  const updateAmenity = (i, val) => {
    const copy = [...amenities];
    copy[i] = val;
    update({ amenities: copy });
  };

  const removeAmenity = (i) =>
    update({ amenities: amenities.filter((_, idx) => idx !== i) });

  const addRoom = () => {
    const propertyType = data.property_type || "mixed";
    updateRooms([
      ...normalizedRooms,
      createEmptyRoom(normalizedRooms.length + 1, propertyType),
    ]);
    setErrors((prev) => ({ ...prev, rooms: "" }));
  };

  const removeRoom = (tempId) => {
    updateRooms(normalizedRooms.filter((room) => room.temp_id !== tempId));
  };

  const updateRoomField = (tempId, field, value) => {
    const formatted =
      field === "max_capacity"
        ? Number(value) || 1
        : field === "price_override"
        ? value === "" ? "" : Number(value) || 0
        : value;

    updateRooms(
      normalizedRooms.map((room) =>
        room.temp_id === tempId
          ? {
              ...room,
              [field]: formatted,
            }
          : room
      )
    );
  };

  const validateRooms = () => {
    if (!isHostel) return {};

    const roomErrors = {};

    if (!normalizedRooms.length) {
      roomErrors.rooms = "Add at least one hostel room.";
      return roomErrors;
    }

    const seenRoomNumbers = new Set();

    normalizedRooms.forEach((room, index) => {
      const prefix = `room_${index}`;

      if (!room.room_number?.trim()) {
        roomErrors[`${prefix}_room_number`] = "Room number is required";
      } else {
        const normalized = room.room_number.trim().toLowerCase();
        if (seenRoomNumbers.has(normalized)) {
          roomErrors[`${prefix}_room_number`] = "Room number must be unique";
        }
        seenRoomNumbers.add(normalized);
      }

      if (!room.room_type) {
        roomErrors[`${prefix}_room_type`] = "Room type is required";
      }

      if (!room.gender_restriction) {
        roomErrors[`${prefix}_gender_restriction`] =
          "Gender restriction is required";
      }

      if (!room.max_capacity || room.max_capacity < 1 || room.max_capacity > 6) {
        roomErrors[`${prefix}_max_capacity`] =
          "Capacity must be between 1 and 6";
      }

      if (
        room.price_override !== "" &&
        room.price_override !== null &&
        Number(room.price_override) < 0
      ) {
        roomErrors[`${prefix}_price_override`] =
          "Price override cannot be negative";
      }
    });

    return roomErrors;
  };

  const validate = () => {
    const newErrors = {};

    if (!data.property_name?.trim()) {
      newErrors.property_name = "Property name is required";
    }

    if (!data.category) {
      newErrors.category = "Category is required";
    }

    if (data.category === "house_rent" && !data.property_type) {
      newErrors.property_type = "Property type is required";
    }

    if (!data.bedrooms || data.bedrooms < 1) {
      newErrors.bedrooms = isHostel
        ? "Total rooms required"
        : "Valid bedrooms required";
    }

    if (!isHostel && (!data.bathrooms || data.bathrooms < 1)) {
      newErrors.bathrooms = "Valid bathrooms required";
    }

    if (!data.price || data.price <= 0) {
      newErrors.price = isHostel
        ? "Base room price required"
        : "Valid price required";
    }

    if (!data.description?.trim()) {
      newErrors.description = "Description is required";
    }

    Object.assign(newErrors, validateRooms());

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;

    const cleanedRooms = isHostel
      ? normalizedRooms.map((room) => ({
          room_number: room.room_number?.trim(),
          room_type: room.room_type,
          gender_restriction: room.gender_restriction,
          max_capacity: Number(room.max_capacity) || 1,
          price_override:
            room.price_override === "" || room.price_override === null
              ? null
              : Number(room.price_override),
        }))
      : [];

    update({ rooms: cleanedRooms });
    next();
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
          {errors.property_name && (
            <span className="error-text">{errors.property_name}</span>
          )}
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
          {errors.category && (
            <span className="error-text">{errors.category}</span>
          )}
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
            {errors.property_type && (
              <span className="error-text">{errors.property_type}</span>
            )}
          </div>
        )}

        {isHostel && (
          <div className="form-group">
            <label>Hostel Type</label>
            <select
              name="property_type"
              value={data.property_type ?? ""}
              onChange={handleChange}
            >
              <option value="">Select</option>
              <option value="mixed">Mixed</option>
              <option value="male_only">Male Only</option>
              <option value="female_only">Female Only</option>
            </select>
          </div>
        )}

        <div className="form-group">
          <label>{isHostel ? "Total Rooms" : "Bedrooms"}</label>
          <select
            name="bedrooms"
            value={data.bedrooms ?? ""}
            onChange={handleChange}
            className={errors.bedrooms ? "error-input" : ""}
          >
            <option value="">Select</option>
            {(isHostel ? ROOM_OPTIONS : NUMBER_OPTIONS).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {errors.bedrooms && (
            <span className="error-text">{errors.bedrooms}</span>
          )}
        </div>

        {!isHostel && (
          <div className="form-group">
            <label>Bathrooms</label>
            <select
              name="bathrooms"
              value={data.bathrooms ?? ""}
              onChange={handleChange}
              className={errors.bathrooms ? "error-input" : ""}
            >
              <option value="">Select</option>
              {NUMBER_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {errors.bathrooms && (
              <span className="error-text">{errors.bathrooms}</span>
            )}
          </div>
        )}

        <div className="form-group">
          <label>{isHostel ? "Base Room Price (GHS)" : "Price (GHS)"}</label>
          <input
            type="number"
            name="price"
            value={data.price ?? ""}
            onChange={handleChange}
            className={errors.price ? "error-input" : ""}
          />
          {errors.price && (
            <span className="error-text">{errors.price}</span>
          )}
        </div>
      </div>

      {isHostel && (
        <>
          <div className="hostel-info-banner">
            <span>🏠</span>
            <p>
              For hostels, you now need to define the actual room setup.
              Each lease will attach to a real room, not just the main property.
            </p>
          </div>

          <div className="hostel-rooms-builder">
            <div className="hostel-rooms-header">
              <div>
                <h3>Hostel Rooms Setup</h3>
                <p>Add the actual rooms available in this hostel property.</p>
              </div>

              <button
                type="button"
                className="add-amenity-btn"
                onClick={addRoom}
              >
                + Add Room
              </button>
            </div>

            {errors.rooms && (
              <span className="error-text">{errors.rooms}</span>
            )}

            {normalizedRooms.length > 0 ? (
              <div className="hostel-rooms-list">
                {normalizedRooms.map((room, index) => {
                  const prefix = `room_${index}`;

                  return (
                    <div className="hostel-room-card" key={room.temp_id}>
                      <div className="hostel-room-card-top">
                        <h4>Room {index + 1}</h4>
                        <button
                          type="button"
                          className="clear-amenity-btn"
                          onClick={() => removeRoom(room.temp_id)}
                          aria-label="Remove room"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="form-grid">
                        <div className="form-group">
                          <label>Room Number</label>
                          <input
                            value={room.room_number ?? ""}
                            onChange={(e) =>
                              updateRoomField(
                                room.temp_id,
                                "room_number",
                                e.target.value
                              )
                            }
                            className={
                              errors[`${prefix}_room_number`]
                                ? "error-input"
                                : ""
                            }
                            placeholder="e.g. A1, 101, B4"
                          />
                          {errors[`${prefix}_room_number`] && (
                            <span className="error-text">
                              {errors[`${prefix}_room_number`]}
                            </span>
                          )}
                        </div>

                        <div className="form-group">
                          <label>Room Type</label>
                          <select
                            value={room.room_type ?? "mixed"}
                            onChange={(e) =>
                              updateRoomField(
                                room.temp_id,
                                "room_type",
                                e.target.value
                              )
                            }
                            className={
                              errors[`${prefix}_room_type`]
                                ? "error-input"
                                : ""
                            }
                          >
                            <option value="single">Single</option>
                            <option value="double">Double</option>
                            <option value="mixed">Mixed</option>
                          </select>
                          {errors[`${prefix}_room_type`] && (
                            <span className="error-text">
                              {errors[`${prefix}_room_type`]}
                            </span>
                          )}
                        </div>

                        <div className="form-group">
                          <label>Gender Restriction</label>
                          <select
                            value={room.gender_restriction ?? "mixed"}
                            onChange={(e) =>
                              updateRoomField(
                                room.temp_id,
                                "gender_restriction",
                                e.target.value
                              )
                            }
                            className={
                              errors[`${prefix}_gender_restriction`]
                                ? "error-input"
                                : ""
                            }
                          >
                            <option value="male">Male only</option>
                            <option value="female">Female only</option>
                            <option value="mixed">Mixed</option>
                          </select>
                          {errors[`${prefix}_gender_restriction`] && (
                            <span className="error-text">
                              {errors[`${prefix}_gender_restriction`]}
                            </span>
                          )}
                        </div>

                        <div className="form-group">
                          <label>Max Capacity</label>
                          <select
                            value={room.max_capacity ?? 1}
                            onChange={(e) =>
                              updateRoomField(
                                room.temp_id,
                                "max_capacity",
                                e.target.value
                              )
                            }
                            className={
                              errors[`${prefix}_max_capacity`]
                                ? "error-input"
                                : ""
                            }
                          >
                            {CAPACITY_OPTIONS.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                          {errors[`${prefix}_max_capacity`] && (
                            <span className="error-text">
                              {errors[`${prefix}_max_capacity`]}
                            </span>
                          )}
                        </div>

                        <div className="form-group">
                          <label>Room Price Override (optional)</label>
                          <input
                            type="number"
                            value={room.price_override ?? ""}
                            onChange={(e) =>
                              updateRoomField(
                                room.temp_id,
                                "price_override",
                                e.target.value
                              )
                            }
                            className={
                              errors[`${prefix}_price_override`]
                                ? "error-input"
                                : ""
                            }
                            placeholder="Leave blank to use base hostel price"
                          />
                          {errors[`${prefix}_price_override`] && (
                            <span className="error-text">
                              {errors[`${prefix}_price_override`]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="hostel-room-empty">
                <p>No rooms added yet. Add at least one hostel room.</p>
              </div>
            )}
          </div>
        </>
      )}

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
              type="button"
              className="clear-amenity-btn"
              onClick={() => removeAmenity(i)}
              aria-label="Remove amenity"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-amenity-btn"
          onClick={addAmenity}
        >
          + Add amenity
        </button>
      </div>

      <div className="form-group full-width">
        <label>Description</label>
        <textarea
          name="description"
          value={data.description ?? ""}
          onChange={handleChange}
          className={errors.description ? "error-input" : ""}
        />
        {errors.description && (
          <span className="error-text">{errors.description}</span>
        )}
      </div>

      <div className="form-actions-row">
        <button type="button" className="prv-btn" onClick={prev}>
          Previous
        </button>
        <button type="button" className="nxt-btn" onClick={handleNext}>
          Next
        </button>
      </div>
    </div>
  );
};

export default PropertyDescription;