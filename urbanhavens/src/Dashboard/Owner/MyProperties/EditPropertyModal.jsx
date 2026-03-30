import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./Editpropertymodal.css";
import L from "leaflet";
import {
  FaTimes, FaHome, FaMapMarkerAlt, FaImages, FaSave,
  FaChevronLeft, FaChevronRight, FaTrash, FaPlus,
  FaExclamationCircle, FaCheckCircle,
} from "react-icons/fa";
import { updateProperty } from "../UploadDetails/api/api"; // adjust path as needed

/* ── Leaflet icon fix ─────────────────────────────── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const API_MEDIA_BASE  = "http://127.0.0.1:8000";
const MAX_IMAGES      = 6;
const NUMBER_OPTIONS  = Array.from({ length: 10 }, (_, i) => i + 1);
const ROOM_OPTIONS    = Array.from({ length: 50 }, (_, i) => i + 1);

const CATEGORY_LABELS = {
  hostel:     "Hostel",
  house_rent: "House for Rent",
};

const TABS = [
  { id: "details",  label: "Details",  icon: <FaHome /> },
  { id: "location", label: "Location", icon: <FaMapMarkerAlt /> },
  { id: "images",   label: "Images",   icon: <FaImages /> },
];

/* ── helpers ──────────────────────────────────────── */
const normalizeUrl = (img) => {
  if (!img) return "";
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return `${API_MEDIA_BASE}${img}`;
};

/* ================================================================
   MAIN COMPONENT
   Props:
     property  — the full property object from MyProperties state
     onClose   — () => void
     onUpdated — (updatedProperty) => void   (called after success)
   ================================================================ */
const EditPropertyModal = ({ property, onClose, onUpdated }) => {
  /* ── form state ─────────────────────────────────── */
  const [tab, setTab]         = useState("details");
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null); // { type: "success"|"error", msg }

  /* Details */
  const [form, setForm] = useState({
    property_name: property.property_name ?? "",
    category:      property.category      ?? "",
    property_type: property.property_type ?? "",
    bedrooms:      property.bedrooms      ?? "",
    bathrooms:     property.bathrooms     ?? "",
    price:         property.price         ?? "",
    description:   property.description   ?? "",
    amenities:     Array.isArray(property.amenities) ? property.amenities : [],
  });
  const [detailErrors, setDetailErrors] = useState({});

  /* Location */
  const [loc, setLoc] = useState({
    region: property.region ?? "",
    city:   property.city   ?? "",
    school: property.school ?? "",
    lat:    property.lat    ?? null,
    lng:    property.lng    ?? null,
  });
  const [locErrors, setLocErrors] = useState({});

  /* Images — existing URLs + new File objects */
  const [existingImages, setExistingImages] = useState(
    (property.images || []).map((url) => ({ url: normalizeUrl(url), toDelete: false }))
  );
  const [newFiles, setNewFiles] = useState([]);   // File[]
  const [newPreviews, setNewPreviews] = useState([]);
  const fileInputRef = useRef(null);

  /* Rebuild previews for new files */
  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setNewPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newFiles]);

  const totalImageCount =
    existingImages.filter((i) => !i.toDelete).length + newFiles.length;

  /* ── detail helpers ─────────────────────────────── */
  const isHostel = form.category === "hostel";

  const handleForm = (e) => {
    const { name, value } = e.target;
    const parsed = ["price", "bedrooms", "bathrooms"].includes(name)
      ? Number(value) || 0 : value;
    setForm((p) => ({ ...p, [name]: parsed }));
    setDetailErrors((p) => ({ ...p, [name]: "" }));
  };

  const addAmenity    = () => setForm((p) => ({ ...p, amenities: [...p.amenities, ""] }));
  const updateAmenity = (i, v) => {
    const a = [...form.amenities]; a[i] = v;
    setForm((p) => ({ ...p, amenities: a }));
  };
  const removeAmenity = (i) =>
    setForm((p) => ({ ...p, amenities: p.amenities.filter((_, idx) => idx !== i) }));

  const validateDetails = () => {
    const e = {};
    if (!form.property_name?.trim()) e.property_name = "Required";
    if (!form.category)              e.category      = "Required";
    if (form.category === "house_rent" && !form.property_type) e.property_type = "Required";
    if (!form.bedrooms || form.bedrooms < 1)
      e.bedrooms = isHostel ? "Total rooms required" : "Required";
    if (!isHostel && (!form.bathrooms || form.bathrooms < 1)) e.bathrooms = "Required";
    if (!form.price || form.price <= 0) e.price = "Required";
    if (!form.description?.trim()) e.description = "Required";
    setDetailErrors(e);
    return !Object.keys(e).length;
  };

  /* ── location helpers ───────────────────────────── */
  const handleLoc = (e) => {
    const { name, value } = e.target;
    setLoc((p) => ({ ...p, [name]: value }));
    setLocErrors((p) => ({ ...p, [name]: "" }));
  };

  const validateLocation = () => {
    const e = {};
    if (!loc.region)       e.region = "Required";
    if (!loc.city?.trim()) e.city   = "Required";
    if (!loc.lat || !loc.lng) e.map = "Pin location on map";
    setLocErrors(e);
    return !Object.keys(e).length;
  };

  /* ── map marker ─────────────────────────────────── */
  const LocationMarker = () => {
    useMapEvents({
      click(e) {
        setLoc((p) => ({ ...p, lat: e.latlng.lat, lng: e.latlng.lng }));
        setLocErrors((p) => ({ ...p, map: "" }));
      },
    });
    if (!loc.lat || !loc.lng) return null;
    return <Marker position={[loc.lat, loc.lng]} />;
  };

  const mapCenter = loc.lat && loc.lng
    ? [loc.lat, loc.lng]
    : [5.6037, -0.187];

  /* ── image helpers ──────────────────────────────── */
  const toggleDeleteExisting = (i) => {
    setExistingImages((prev) =>
      prev.map((img, idx) => idx === i ? { ...img, toDelete: !img.toDelete } : img)
    );
  };

  const handleFileAdd = (e) => {
    const selected = Array.from(e.target.files).filter((f) => f instanceof File);
    const slots    = MAX_IMAGES - totalImageCount;
    setNewFiles((p) => [...p, ...selected.slice(0, slots)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeNewFile = (i) => setNewFiles((p) => p.filter((_, idx) => idx !== i));

  /* ── submit ─────────────────────────────────────── */
  const handleSave = async () => {
  const detailOk   = validateDetails();
  const locationOk = validateLocation();

  if (!detailOk)   { setTab("details");  return; }
  if (!locationOk) { setTab("location"); return; }
  if (totalImageCount === 0) {
    setTab("images");
    setToast({ type: "error", msg: "At least 1 image is required." });
    return;
  }

  try {
    setSaving(true);
    const payload = new FormData();

    /* flat fields */
    const combined = { ...form, ...loc };
    Object.entries(combined).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        if (key === "amenities") {
          payload.append("amenities", JSON.stringify(Array.isArray(val) ? val : []));
        } else {
          payload.append(key, val);
        }
      }
    });

    /* images to delete */
    existingImages
      .filter((i) => i.toDelete)
      .forEach((i) => payload.append("delete_images", i.url));

    /* new images */
    newFiles.forEach((f) => payload.append("property_images", f));

    const updated = await updateProperty(property.id, payload);

    setToast({ type: "success", msg: "Property updated successfully!" });

    // Use server-returned images so URLs are real, not revoked blob URLs
    const mergedImages = updated?.images?.length
      ? updated.images.map((img) =>
          typeof img === "string" ? img : normalizeUrl(img.image ?? img.url ?? "")
        )
      : existingImages.filter((i) => !i.toDelete).map((i) => i.url);

    const merged = {
      ...property,
      ...form,
      ...loc,
      status: property.status ?? "Active",
      images: mergedImages,
    };

    setTimeout(() => { onUpdated(merged); onClose(); }, 1200);
  } catch (err) {
    console.error("Update failed:", err);
    setToast({ type: "error", msg: "Update failed. Please try again." });
  } finally {
    setSaving(false);
  }
};

  /* ── render ─────────────────────────────────────── */
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
          animate={{ y: 0,  opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Modal Header ── */}
          <div className="epm-header">
            <div className="epm-header-left">
              <div className="epm-header-icon"><FaHome /></div>
              <div>
                <h2 className="epm-title">Edit Property</h2>
                <p className="epm-subtitle">#{property.id} · {property.property_name}</p>
              </div>
            </div>
            <button className="epm-close" onClick={onClose}><FaTimes /></button>
          </div>

          {/* ── Tabs ── */}
          <div className="epm-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`epm-tab ${tab === t.id ? "epm-tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.id === "details"  && Object.keys(detailErrors).length > 0 && <span className="epm-tab-err" />}
                {t.id === "location" && Object.keys(locErrors).length   > 0 && <span className="epm-tab-err" />}
              </button>
            ))}
          </div>

          {/* ── Tab Body ── */}
          <div className="epm-body">

            {/* ────────── DETAILS TAB ────────── */}
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
                        className={detailErrors.property_name ? "epm-input--err" : ""}
                        placeholder="e.g. Cozy Studio near Legon"
                      />
                      {detailErrors.property_name && <span className="epm-err-text">{detailErrors.property_name}</span>}
                    </div>

                    <div className="epm-field">
                      <label>Category</label>
                      <select
                        name="category"
                        value={form.category}
                        onChange={(e) => {
                          handleForm(e);
                          if (e.target.value === "hostel")
                            setForm((p) => ({ ...p, bathrooms: 1, property_type: "" }));
                        }}
                        className={detailErrors.category ? "epm-input--err" : ""}
                      >
                        <option value="">Select</option>
                        <option value="hostel">Hostel</option>
                        <option value="house_rent">House for Rent</option>
                      </select>
                      {detailErrors.category && <span className="epm-err-text">{detailErrors.category}</span>}
                    </div>

                    {form.category === "house_rent" && (
                      <div className="epm-field">
                        <label>Property Type</label>
                        <select
                          name="property_type"
                          value={form.property_type}
                          onChange={handleForm}
                          className={detailErrors.property_type ? "epm-input--err" : ""}
                        >
                          <option value="">Select</option>
                          <option value="apartment">Apartment</option>
                          <option value="single_room">Single Room</option>
                          <option value="chamber_hall">Chamber & Hall</option>
                          <option value="self_contained">Self Contained</option>
                          <option value="office">Office</option>
                        </select>
                        {detailErrors.property_type && <span className="epm-err-text">{detailErrors.property_type}</span>}
                      </div>
                    )}

                    {isHostel && (
                      <div className="epm-field">
                        <label>Hostel Type</label>
                        <select name="property_type" value={form.property_type} onChange={handleForm}>
                          <option value="">Select</option>
                          <option value="mixed">Mixed</option>
                          <option value="male_only">Male Only</option>
                          <option value="female_only">Female Only</option>
                        </select>
                      </div>
                    )}

                    <div className="epm-field">
                      <label>{isHostel ? "Total Rooms" : "Bedrooms"}</label>
                      <select
                        name="bedrooms"
                        value={form.bedrooms}
                        onChange={handleForm}
                        className={detailErrors.bedrooms ? "epm-input--err" : ""}
                      >
                        <option value="">Select</option>
                        {(isHostel ? ROOM_OPTIONS : NUMBER_OPTIONS).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      {detailErrors.bedrooms && <span className="epm-err-text">{detailErrors.bedrooms}</span>}
                    </div>

                    {!isHostel && (
                      <div className="epm-field">
                        <label>Bathrooms</label>
                        <select
                          name="bathrooms"
                          value={form.bathrooms}
                          onChange={handleForm}
                          className={detailErrors.bathrooms ? "epm-input--err" : ""}
                        >
                          <option value="">Select</option>
                          {NUMBER_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        {detailErrors.bathrooms && <span className="epm-err-text">{detailErrors.bathrooms}</span>}
                      </div>
                    )}

                    <div className="epm-field">
                      <label>{isHostel ? "Price per Room (GHS)" : "Price (GHS)"}</label>
                      <input
                        type="number"
                        name="price"
                        value={form.price}
                        onChange={handleForm}
                        className={detailErrors.price ? "epm-input--err" : ""}
                        placeholder="0.00"
                      />
                      {detailErrors.price && <span className="epm-err-text">{detailErrors.price}</span>}
                    </div>

                  </div>

                  {/* Amenities */}
                  <div className="epm-field epm-field--full">
                    <label>Amenities</label>
                    <div className="epm-amenities">
                      {form.amenities.map((item, i) => (
                        <div key={i} className="epm-amenity-row">
                          <input
                            value={item}
                            onChange={(e) => updateAmenity(i, e.target.value)}
                            placeholder={`Amenity ${i + 1}`}
                          />
                          <button className="epm-amenity-remove" onClick={() => removeAmenity(i)}>
                            <FaTimes />
                          </button>
                        </div>
                      ))}
                      <button className="epm-amenity-add" onClick={addAmenity}>
                        <FaPlus /> Add Amenity
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="epm-field epm-field--full">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleForm}
                      rows={4}
                      className={detailErrors.description ? "epm-input--err" : ""}
                      placeholder="Describe the property..."
                    />
                    {detailErrors.description && <span className="epm-err-text">{detailErrors.description}</span>}
                  </div>

                  <div className="epm-tab-nav">
                    <span />
                    <button className="epm-nav-btn epm-nav-btn--next" onClick={() => setTab("location")}>
                      Location <FaChevronRight />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ────────── LOCATION TAB ────────── */}
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
                        className={locErrors.region ? "epm-input--err" : ""}
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
                      {locErrors.region && <span className="epm-err-text">{locErrors.region}</span>}
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
                      {locErrors.city && <span className="epm-err-text">{locErrors.city}</span>}
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

                  {/* Map */}
                  <div className="epm-field epm-field--full">
                    <label>Pin Property Location on Map</label>
                    <p className="epm-map-hint">Click on the map to update the pin.</p>
                    <div className={`epm-map-wrap ${locErrors.map ? "epm-map-wrap--err" : ""}`}>
                      <MapContainer
                        key={`${loc.region}-${loc.lat}-${loc.lng}`}
                        center={mapCenter}
                        zoom={13}
                        style={{ height: "260px", width: "100%", borderRadius: "10px" }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationMarker />
                      </MapContainer>
                    </div>
                    {loc.lat && loc.lng && (
                      <p className="epm-map-coords">
                        ✓ Pinned: {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                      </p>
                    )}
                    {locErrors.map && <span className="epm-err-text">{locErrors.map}</span>}
                  </div>

                  <div className="epm-tab-nav">
                    <button className="epm-nav-btn epm-nav-btn--prev" onClick={() => setTab("details")}>
                      <FaChevronLeft /> Details
                    </button>
                    <button className="epm-nav-btn epm-nav-btn--next" onClick={() => setTab("images")}>
                      Images <FaChevronRight />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ────────── IMAGES TAB ────────── */}
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

                    {/* Existing images */}
                    {existingImages.map((img, i) => (
                      <div
                        key={`exist-${i}`}
                        className={`epm-img-card ${img.toDelete ? "epm-img-card--marked" : ""}`}
                      >
                        <img src={img.url} alt={`existing ${i + 1}`} />
                        <div className="epm-img-overlay">
                          <button
                            className={`epm-img-del-btn ${img.toDelete ? "epm-img-del-btn--undo" : ""}`}
                            onClick={() => toggleDeleteExisting(i)}
                          >
                            {img.toDelete ? "↩ Restore" : <><FaTrash /> Remove</>}
                          </button>
                        </div>
                        {img.toDelete && <div className="epm-img-delete-mask"><span>Will be removed</span></div>}
                      </div>
                    ))}

                    {/* New file previews */}
                    {newPreviews.map((url, i) => (
                      <div key={`new-${i}`} className="epm-img-card epm-img-card--new">
                        <img src={url} alt={`new ${i + 1}`} />
                        <div className="epm-img-overlay">
                          <button className="epm-img-del-btn" onClick={() => removeNewFile(i)}>
                            <FaTrash /> Remove
                          </button>
                        </div>
                        <div className="epm-img-new-badge">New</div>
                      </div>
                    ))}

                    {/* Empty slots */}
                    {totalImageCount === 0 && (
                      <div className="epm-img-empty">
                        <FaImages />
                        <p>No images yet. Add at least one.</p>
                      </div>
                    )}

                  </div>

                  <div className="epm-tab-nav">
                    <button className="epm-nav-btn epm-nav-btn--prev" onClick={() => setTab("location")}>
                      <FaChevronLeft /> Location
                    </button>
                    <span />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Footer ── */}
          <div className="epm-footer">
            <button className="epm-cancel-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="epm-save-btn" onClick={handleSave} disabled={saving}>
              {saving
                ? <><span className="epm-spinner" /> Saving...</>
                : <><FaSave /> Save Changes</>}
            </button>
          </div>

          {/* ── Toast ── */}
          <AnimatePresence>
            {toast && (
              <motion.div
                className={`epm-toast epm-toast--${toast.type}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                onAnimationComplete={() => {
                  if (toast.type === "error") setTimeout(() => setToast(null), 3000);
                }}
              >
                {toast.type === "success" ? <FaCheckCircle /> : <FaExclamationCircle />}
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