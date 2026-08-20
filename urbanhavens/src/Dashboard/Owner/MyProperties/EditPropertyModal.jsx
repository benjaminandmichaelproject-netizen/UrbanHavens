import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./Editpropertymodal.css";
import L from "leaflet";
import {
  FaTimes,
  FaHome,
  FaMapMarkerAlt,
  FaImages,
  FaSave,
  FaChevronLeft,
  FaChevronRight,
  FaTrash,
  FaPlus,
  FaExclamationCircle,
  FaCheckCircle,
} from "react-icons/fa";
import { updateProperty } from "../UploadDetails/api/api";

// Keeps the default Leaflet marker icons working inside Vite.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const API_MEDIA_BASE = "http://127.0.0.1:8000";
const MAX_IMAGES = 6;
const NUMBER_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const ROOM_OPTIONS = Array.from({ length: 50 }, (_, i) => i + 1);
const RENTAL_DURATION_OPTIONS = [6, 12, 18, 24];

const TABS = [
  { id: "details", label: "Details", icon: <FaHome /> },
  { id: "location", label: "Location", icon: <FaMapMarkerAlt /> },
  { id: "images", label: "Images", icon: <FaImages /> },
];

// Converts relative backend media paths into URLs the browser can display.
const normalizeUrl = (img) => {
  if (!img) return "";
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return `${API_MEDIA_BASE}${img}`;
};

const EditPropertyModal = ({ property, onClose, onUpdated }) => {
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Preserves the existing editable parent-property fields and also
  // carries the apartment listing type required by the new architecture.
  const [form, setForm] = useState({
    property_name: property.property_name ?? "",
    category: property.category ?? "",
    property_type: property.property_type ?? "",
    apartment_listing_type: property.apartment_listing_type ?? "",
    bedrooms: property.bedrooms ?? "",
    bathrooms: property.bathrooms ?? "",
    price: property.price ?? "",
    description: property.description ?? "",
    amenities: Array.isArray(property.amenities) ? property.amenities : [],
    allowed_rental_months: Array.isArray(property.allowed_rental_months)
      ? property.allowed_rental_months
      : [],
  });
  const [detailErrors, setDetailErrors] = useState({});

  const [loc, setLoc] = useState({
    region: property.region ?? "",
    city: property.city ?? "",
    school: property.school ?? "",
    lat: property.lat ?? null,
    lng: property.lng ?? null,
  });
  const [locErrors, setLocErrors] = useState({});

  // Existing image URLs and newly selected files remain separate so the
  // current delete/add image workflow is preserved.
  const [existingImages, setExistingImages] = useState(
    (property.images || []).map((url) => ({
      url: normalizeUrl(url),
      toDelete: false,
    }))
  );
  const [newFiles, setNewFiles] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const urls = newFiles.map((file) => URL.createObjectURL(file));
    setNewPreviews(urls);

    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [newFiles]);

  const totalImageCount =
    existingImages.filter((image) => !image.toDelete).length + newFiles.length;

  const isHostel = form.category === "hostel";
  const isApartment = form.category === "apartment";
  const isMultiUnitApartment =
    isApartment && form.apartment_listing_type === "multi_unit";

  // Updates normal text/number fields without changing the existing form flow.
  const handleForm = (event) => {
    const { name, value } = event.target;
    const parsed = ["price", "bedrooms", "bathrooms"].includes(name)
      ? Number(value) || 0
      : value;

    setForm((previous) => ({
      ...previous,
      [name]: parsed,
    }));

    setDetailErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  // Keeps category-only fields from leaking into another property category.
  const handleCategoryChange = (event) => {
    const category = event.target.value;

    setForm((previous) => {
      if (category === "hostel") {
        return {
          ...previous,
          category,
          property_type: "",
          apartment_listing_type: "",
          bathrooms: 1,
        };
      }

      if (category === "apartment") {
        return {
          ...previous,
          category,
          property_type: "",
          apartment_listing_type:
            previous.category === "apartment"
              ? previous.apartment_listing_type
              : "",
        };
      }

      return {
        ...previous,
        category,
        property_type: "",
        apartment_listing_type: "",
      };
    });

    setDetailErrors((previous) => ({
      ...previous,
      category: "",
      property_type: "",
      apartment_listing_type: "",
    }));
  };

  const addAmenity = () => {
    setForm((previous) => ({
      ...previous,
      amenities: [...previous.amenities, ""],
    }));
  };

  const updateAmenity = (index, value) => {
    const amenities = [...form.amenities];
    amenities[index] = value;

    setForm((previous) => ({
      ...previous,
      amenities,
    }));
  };

  const removeAmenity = (index) => {
    setForm((previous) => ({
      ...previous,
      amenities: previous.amenities.filter(
        (_, amenityIndex) => amenityIndex !== index
      ),
    }));
  };

  const toggleRentalDuration = (months) => {
    setForm((previous) => {
      const current = Array.isArray(previous.allowed_rental_months)
        ? previous.allowed_rental_months
        : [];

      const updated = current.includes(months)
        ? current.filter((month) => month !== months)
        : [...current, months];

      return {
        ...previous,
        allowed_rental_months: updated,
      };
    });

    setDetailErrors((previous) => ({
      ...previous,
      allowed_rental_months: "",
    }));
  };

  // Multi-unit apartment parent records intentionally do not carry their own
  // bedrooms, bathrooms or price. Those values remain managed per unit.
  const validateDetails = () => {
    const errors = {};

    if (!form.property_name?.trim()) {
      errors.property_name = "Required";
    }

    if (!form.category) {
      errors.category = "Required";
    }

    if (form.category === "house_rent" && !form.property_type) {
      errors.property_type = "Required";
    }

    if (isApartment && !form.apartment_listing_type) {
      errors.apartment_listing_type = "Required";
    }

    if (
      !isMultiUnitApartment &&
      (!form.bedrooms || form.bedrooms < 1)
    ) {
      errors.bedrooms = isHostel ? "Total rooms required" : "Required";
    }

    if (
      !isHostel &&
      !isMultiUnitApartment &&
      (!form.bathrooms || form.bathrooms < 1)
    ) {
      errors.bathrooms = "Required";
    }

    if (
      !isMultiUnitApartment &&
      (!form.price || form.price <= 0)
    ) {
      errors.price = "Required";
    }

    if (!form.description?.trim()) {
      errors.description = "Required";
    }

    if (
      !Array.isArray(form.allowed_rental_months) ||
      form.allowed_rental_months.length === 0
    ) {
      errors.allowed_rental_months =
        "Select at least one rental duration.";
    }

    setDetailErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoc = (event) => {
    const { name, value } = event.target;

    setLoc((previous) => ({
      ...previous,
      [name]: value,
    }));

    setLocErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  const validateLocation = () => {
    const errors = {};

    if (!loc.region) errors.region = "Required";
    if (!loc.city?.trim()) errors.city = "Required";
    if (!loc.lat || !loc.lng) errors.map = "Pin location on map";

    setLocErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Lets the owner move the existing map pin by clicking the map.
  const LocationMarker = () => {
    useMapEvents({
      click(event) {
        setLoc((previous) => ({
          ...previous,
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        }));

        setLocErrors((previous) => ({
          ...previous,
          map: "",
        }));
      },
    });

    if (!loc.lat || !loc.lng) return null;
    return <Marker position={[loc.lat, loc.lng]} />;
  };

  const mapCenter =
    loc.lat && loc.lng ? [loc.lat, loc.lng] : [5.6037, -0.187];

  const toggleDeleteExisting = (index) => {
    setExistingImages((previous) =>
      previous.map((image, imageIndex) =>
        imageIndex === index
          ? { ...image, toDelete: !image.toDelete }
          : image
      )
    );
  };

  const handleFileAdd = (event) => {
    const selected = Array.from(event.target.files).filter(
      (file) => file instanceof File
    );
    const slots = MAX_IMAGES - totalImageCount;

    setNewFiles((previous) => [
      ...previous,
      ...selected.slice(0, slots),
    ]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeNewFile = (index) => {
    setNewFiles((previous) =>
      previous.filter((_, fileIndex) => fileIndex !== index)
    );
  };

  const handleSave = async () => {
    const detailOk = validateDetails();
    const locationOk = validateLocation();

    if (!detailOk) {
      setTab("details");
      return;
    }

    if (!locationOk) {
      setTab("location");
      return;
    }

    if (totalImageCount === 0) {
      setTab("images");
      setToast({
        type: "error",
        msg: "At least 1 image is required.",
      });
      return;
    }

    try {
      setSaving(true);

      const payload = new FormData();
      const combined = { ...form, ...loc };

      Object.entries(combined).forEach(([key, value]) => {
        // Never send parent bedroom/bathroom/price values for a multi-unit
        // apartment. Those values belong to ApartmentUnit records.
        if (
          isMultiUnitApartment &&
          ["bedrooms", "bathrooms", "price"].includes(key)
        ) {
          return;
        }

        if (value === undefined || value === null || value === "") {
          return;
        }

        if (key === "amenities" || key === "allowed_rental_months") {
          payload.append(
            key,
            JSON.stringify(Array.isArray(value) ? value : [])
          );
          return;
        }

        payload.append(key, value);
      });

      existingImages
        .filter((image) => image.toDelete)
        .forEach((image) => payload.append("delete_images", image.url));

      newFiles.forEach((file) =>
        payload.append("property_images", file)
      );

      const updated = await updateProperty(property.id, payload);

      setToast({
        type: "success",
        msg: "Property updated successfully!",
      });

      // Keeps real server image URLs after the update instead of temporary
      // browser blob URLs.
      const mergedImages = updated?.images?.length
        ? updated.images.map((image) =>
            typeof image === "string"
              ? image
              : normalizeUrl(image.image ?? image.url ?? "")
          )
        : existingImages
            .filter((image) => !image.toDelete)
            .map((image) => image.url);

      const merged = {
        ...property,
        ...form,
        ...loc,
        ...(updated || {}),
        status: updated?.status ?? property.status ?? "Active",
        images: mergedImages,
      };

      setTimeout(() => {
        onUpdated(merged);
        onClose();
      }, 1200);
    } catch (error) {
      console.error("Update failed:", error);

      const backendMessage =
        error.response?.data?.detail ||
        Object.values(error.response?.data || {})
          .flat()
          .find((value) => typeof value === "string");

      setToast({
        type: "error",
        msg: backendMessage || "Update failed. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="epm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="epm-modal"
          initial={{ y: 40, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="epm-header">
            <div className="epm-header-left">
              <div className="epm-header-icon">
                <FaHome />
              </div>

              <div>
                <h2 className="epm-title">Edit Property</h2>
                <p className="epm-subtitle">
                  #{property.id} - {property.property_name}
                </p>
              </div>
            </div>

            <button className="epm-close" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          <div className="epm-tabs">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.id}
                className={`epm-tab ${
                  tab === tabItem.id ? "epm-tab--active" : ""
                }`}
                onClick={() => setTab(tabItem.id)}
              >
                {tabItem.icon}
                <span>{tabItem.label}</span>

                {tabItem.id === "details" &&
                  Object.keys(detailErrors).length > 0 && (
                    <span className="epm-tab-err" />
                  )}

                {tabItem.id === "location" &&
                  Object.keys(locErrors).length > 0 && (
                    <span className="epm-tab-err" />
                  )}
              </button>
            ))}
          </div>

          <div className="epm-body">
            <AnimatePresence mode="wait">
              {tab === "details" && (
                <motion.div
                  key="details"
                  className="epm-section"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="epm-grid">
                    <div className="epm-field">
                      <label>Property Name</label>
                      <input
                        name="property_name"
                        value={form.property_name}
                        onChange={handleForm}
                        className={
                          detailErrors.property_name
                            ? "epm-input--err"
                            : ""
                        }
                        placeholder="e.g. Cozy Studio near Legon"
                      />
                      {detailErrors.property_name && (
                        <span className="epm-err-text">
                          {detailErrors.property_name}
                        </span>
                      )}
                    </div>

                    <div className="epm-field">
                      <label>Category</label>
                      <select
                        name="category"
                        value={form.category}
                        onChange={handleCategoryChange}
                        className={
                          detailErrors.category ? "epm-input--err" : ""
                        }
                      >
                        <option value="">Select</option>
                        <option value="hostel">Hostel</option>
                        <option value="house_rent">House for Rent</option>
                        <option value="apartment">Apartment</option>
                      </select>
                      {detailErrors.category && (
                        <span className="epm-err-text">
                          {detailErrors.category}
                        </span>
                      )}
                    </div>

                    {form.category === "house_rent" && (
                      <div className="epm-field">
                        <label>Property Type</label>
                        <select
                          name="property_type"
                          value={form.property_type}
                          onChange={handleForm}
                          className={
                            detailErrors.property_type
                              ? "epm-input--err"
                              : ""
                          }
                        >
                          <option value="">Select</option>
                          <option value="single_room">Single Room</option>
                          <option value="chamber_hall">Chamber & Hall</option>
                          <option value="self_contained">Self Contained</option>
                          <option value="office">Office</option>
                        </select>
                        {detailErrors.property_type && (
                          <span className="epm-err-text">
                            {detailErrors.property_type}
                          </span>
                        )}
                      </div>
                    )}

                    {isHostel && (
                      <div className="epm-field">
                        <label>Hostel Type</label>
                        <select
                          name="property_type"
                          value={form.property_type}
                          onChange={handleForm}
                        >
                          <option value="">Select</option>
                          <option value="mixed">Mixed</option>
                          <option value="male_only">Male Only</option>
                          <option value="female_only">Female Only</option>
                        </select>
                      </div>
                    )}

                    {isApartment && (
                      <div className="epm-field">
                        <label>Apartment Listing Type</label>
                        <select
                          name="apartment_listing_type"
                          value={form.apartment_listing_type}
                          onChange={handleForm}
                          className={
                            detailErrors.apartment_listing_type
                              ? "epm-input--err"
                              : ""
                          }
                        >
                          <option value="">Select</option>
                          <option value="single">Single Apartment</option>
                          <option value="multi_unit">
                            Multi-unit Apartment
                          </option>
                        </select>
                        {detailErrors.apartment_listing_type && (
                          <span className="epm-err-text">
                            {detailErrors.apartment_listing_type}
                          </span>
                        )}
                      </div>
                    )}

                    {!isMultiUnitApartment && (
                      <div className="epm-field">
                        <label>{isHostel ? "Total Rooms" : "Bedrooms"}</label>
                        <select
                          name="bedrooms"
                          value={form.bedrooms}
                          onChange={handleForm}
                          className={
                            detailErrors.bedrooms ? "epm-input--err" : ""
                          }
                        >
                          <option value="">Select</option>
                          {(isHostel ? ROOM_OPTIONS : NUMBER_OPTIONS).map(
                            (number) => (
                              <option key={number} value={number}>
                                {number}
                              </option>
                            )
                          )}
                        </select>
                        {detailErrors.bedrooms && (
                          <span className="epm-err-text">
                            {detailErrors.bedrooms}
                          </span>
                        )}
                      </div>
                    )}

                    {!isHostel && !isMultiUnitApartment && (
                      <div className="epm-field">
                        <label>Bathrooms</label>
                        <select
                          name="bathrooms"
                          value={form.bathrooms}
                          onChange={handleForm}
                          className={
                            detailErrors.bathrooms ? "epm-input--err" : ""
                          }
                        >
                          <option value="">Select</option>
                          {NUMBER_OPTIONS.map((number) => (
                            <option key={number} value={number}>
                              {number}
                            </option>
                          ))}
                        </select>
                        {detailErrors.bathrooms && (
                          <span className="epm-err-text">
                            {detailErrors.bathrooms}
                          </span>
                        )}
                      </div>
                    )}

                    {!isMultiUnitApartment && (
                      <div className="epm-field">
                        <label>
                          {isHostel ? "Price per Room (GHS)" : "Price (GHS)"}
                        </label>
                        <input
                          type="number"
                          name="price"
                          value={form.price}
                          onChange={handleForm}
                          className={
                            detailErrors.price ? "epm-input--err" : ""
                          }
                          placeholder="0.00"
                        />
                        {detailErrors.price && (
                          <span className="epm-err-text">
                            {detailErrors.price}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {isMultiUnitApartment && (
                    <div className="epm-field epm-field--full">
                      <p className="epm-map-hint">
                        Bedrooms, bathrooms and rent are managed separately for
                        each apartment through Manage Units. The parent listing
                        does not store those values.
                      </p>
                    </div>
                  )}

                  <div className="epm-field epm-field--full">
                    <label>Amenities</label>
                    <div className="epm-amenities">
                      {form.amenities.map((item, index) => (
                        <div key={index} className="epm-amenity-row">
                          <input
                            value={item}
                            onChange={(event) =>
                              updateAmenity(index, event.target.value)
                            }
                            placeholder={`Amenity ${index + 1}`}
                          />
                          <button
                            className="epm-amenity-remove"
                            onClick={() => removeAmenity(index)}
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ))}

                      <button
                        className="epm-amenity-add"
                        onClick={addAmenity}
                      >
                        <FaPlus /> Add Amenity
                      </button>
                    </div>
                  </div>

                  <div className="epm-field epm-field--full">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleForm}
                      rows={4}
                      className={
                        detailErrors.description ? "epm-input--err" : ""
                      }
                      placeholder="Describe the property..."
                    />
                    {detailErrors.description && (
                      <span className="epm-err-text">
                        {detailErrors.description}
                      </span>
                    )}
                  </div>

                  <div className="epm-tab-nav">
                    <span />
                    <button
                      className="epm-nav-btn epm-nav-btn--next"
                      onClick={() => setTab("location")}
                    >
                      Location <FaChevronRight />
                    </button>
                  </div>
                </motion.div>
              )}

              {tab === "location" && (
                <motion.div
                  key="location"
                  className="epm-section"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="epm-grid">
                    <div className="epm-field">
                      <label>Region</label>
                      <select
                        name="region"
                        value={loc.region}
                        onChange={handleLoc}
                        className={
                          locErrors.region ? "epm-input--err" : ""
                        }
                      >
                        <option value="">Select Region</option>
                        <option value="greater_accra">Greater Accra</option>
                        <option value="ashanti">Ashanti (Kumasi)</option>
                        <option value="central">Central</option>
                        <option value="western">Western</option>
                        <option value="eastern">Eastern</option>
                        <option value="volta">Volta</option>
                        <option value="northern">Northern</option>
                        <option value="upper_east">Upper East</option>
                        <option value="upper_west">Upper West</option>
                        <option value="brong_ahafo">Brong-Ahafo</option>
                      </select>
                      {locErrors.region && (
                        <span className="epm-err-text">
                          {locErrors.region}
                        </span>
                      )}
                    </div>

                    <div className="epm-field">
                      <label>City / Area</label>
                      <input
                        name="city"
                        value={loc.city}
                        onChange={handleLoc}
                        placeholder="e.g. East Legon, Spintex, KNUST Area"
                        className={locErrors.city ? "epm-input--err" : ""}
                      />
                      {locErrors.city && (
                        <span className="epm-err-text">
                          {locErrors.city}
                        </span>
                      )}
                    </div>

                    <div className="epm-field">
                      <label>
                        Nearest School / University
                        <span className="epm-optional"> (optional)</span>
                      </label>
                      <input
                        name="school"
                        value={loc.school}
                        onChange={handleLoc}
                        placeholder="e.g. University of Ghana, KNUST"
                      />
                    </div>
                  </div>

                  <div className="epm-field epm-field--full">
                    <label>Pin Property Location on Map</label>
                    <p className="epm-map-hint">
                      Click on the map to update the pin.
                    </p>
                    <div
                      className={`epm-map-wrap ${
                        locErrors.map ? "epm-map-wrap--err" : ""
                      }`}
                    >
                      <MapContainer
                        key={`${loc.region}-${loc.lat}-${loc.lng}`}
                        center={mapCenter}
                        zoom={13}
                        style={{
                          height: "260px",
                          width: "100%",
                          borderRadius: "10px",
                        }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationMarker />
                      </MapContainer>
                    </div>

                    {loc.lat && loc.lng && (
                      <p className="epm-map-coords">
                        Pinned: {Number(loc.lat).toFixed(5)}, {" "}
                        {Number(loc.lng).toFixed(5)}
                      </p>
                    )}

                    {locErrors.map && (
                      <span className="epm-err-text">{locErrors.map}</span>
                    )}
                  </div>

                  <div className="epm-tab-nav">
                    <button
                      className="epm-nav-btn epm-nav-btn--prev"
                      onClick={() => setTab("details")}
                    >
                      <FaChevronLeft /> Details
                    </button>
                    <button
                      className="epm-nav-btn epm-nav-btn--next"
                      onClick={() => setTab("images")}
                    >
                      Images <FaChevronRight />
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="form-group full-width">
                <label>Available Rental Durations</label>

                <div className="rental-duration-grid">
                  {RENTAL_DURATION_OPTIONS.map((months) => (
                    <label
                      key={months}
                      className="rental-duration-option"
                    >
                      <input
                        type="checkbox"
                        checked={(form.allowed_rental_months || []).includes(
                          months
                        )}
                        onChange={() => toggleRentalDuration(months)}
                      />
                      {months} Months
                    </label>
                  ))}
                </div>

                {detailErrors.allowed_rental_months && (
                  <span className="error-text">
                    {detailErrors.allowed_rental_months}
                  </span>
                )}
              </div>

              {tab === "images" && (
                <motion.div
                  key="images"
                  className="epm-section"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="epm-img-header">
                    <p className="epm-img-count">
                      <FaImages /> {totalImageCount} / {MAX_IMAGES} images
                    </p>

                    {totalImageCount < MAX_IMAGES && (
                      <label className="epm-img-add-btn">
                        <FaPlus /> Add Images
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileAdd}
                          style={{ display: "none" }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="epm-img-grid">
                    {existingImages.map((image, index) => (
                      <div
                        key={`exist-${index}`}
                        className={`epm-img-card ${
                          image.toDelete ? "epm-img-card--marked" : ""
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={`existing ${index + 1}`}
                        />
                        <div className="epm-img-overlay">
                          <button
                            className={`epm-img-del-btn ${
                              image.toDelete
                                ? "epm-img-del-btn--undo"
                                : ""
                            }`}
                            onClick={() => toggleDeleteExisting(index)}
                          >
                            {image.toDelete ? (
                              "Restore"
                            ) : (
                              <>
                                <FaTrash /> Remove
                              </>
                            )}
                          </button>
                        </div>

                        {image.toDelete && (
                          <div className="epm-img-delete-mask">
                            <span>Will be removed</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {newPreviews.map((url, index) => (
                      <div
                        key={`new-${index}`}
                        className="epm-img-card epm-img-card--new"
                      >
                        <img src={url} alt={`new ${index + 1}`} />
                        <div className="epm-img-overlay">
                          <button
                            className="epm-img-del-btn"
                            onClick={() => removeNewFile(index)}
                          >
                            <FaTrash /> Remove
                          </button>
                        </div>
                        <div className="epm-img-new-badge">New</div>
                      </div>
                    ))}

                    {totalImageCount === 0 && (
                      <div className="epm-img-empty">
                        <FaImages />
                        <p>No images yet. Add at least one.</p>
                      </div>
                    )}
                  </div>

                  <div className="epm-tab-nav">
                    <button
                      className="epm-nav-btn epm-nav-btn--prev"
                      onClick={() => setTab("location")}
                    >
                      <FaChevronLeft /> Location
                    </button>
                    <span />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="epm-footer">
            <button
              className="epm-cancel-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="epm-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="epm-spinner" /> Saving...
                </>
              ) : (
                <>
                  <FaSave /> Save Changes
                </>
              )}
            </button>
          </div>

          <AnimatePresence>
            {toast && (
              <motion.div
                className={`epm-toast epm-toast--${toast.type}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                onAnimationComplete={() => {
                  if (toast.type === "error") {
                    setTimeout(() => setToast(null), 3000);
                  }
                }}
              >
                {toast.type === "success" ? (
                  <FaCheckCircle />
                ) : (
                  <FaExclamationCircle />
                )}
                {toast.msg}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditPropertyModal;