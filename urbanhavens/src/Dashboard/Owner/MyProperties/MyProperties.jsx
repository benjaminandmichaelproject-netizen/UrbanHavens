import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaEdit,
  FaTrash,
  FaImages,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
  FaHome,
  FaBuilding,
  FaMapMarkerAlt,
  FaTag,
  FaHashtag,
  FaPlus,
} from "react-icons/fa";

import {
  getMyProperties,
  deleteProperty,
  requestPropertyRecheck,
  createApartmentUnit,
  updateApartmentUnit,
  deleteApartmentUnit,
} from "../UploadDetails/api/api";

import NoPropertyUploaded from "../NoPropertyUploaded/NoPropertyUploaded";
import EditPropertyModal from "./EditPropertyModal";
import "./MyProperties.css";


const API_MEDIA_BASE = "http://127.0.0.1:8000";


const CATEGORY_LABELS = {
  hostel: "Hostel",
  house_rent: "House for Rent",
  apartment: "Apartment",
};


// Empty apartment-unit form used for both create and edit.
const EMPTY_UNIT_FORM = {
  unit_number: "",
  bedrooms: 1,
  bathrooms: 1,
  floor: "",
  price: "",
  is_furnished: false,
  amenities: "",
};


const MyProperties = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [editProperty, setEditProperty] = useState(null);

  // Tracks the property currently submitting a recheck request.
  const [recheckingPropertyId, setRecheckingPropertyId] = useState(null);

  // Tracks which multi-unit apartment is open in the unit manager.
  const [manageUnitsPropertyId, setManageUnitsPropertyId] = useState(null);

  // Stores the apartment-unit form values.
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);

  // Null means the form is creating a new unit.
  const [editingUnitId, setEditingUnitId] = useState(null);

  // Tracks create/update loading state.
  const [savingUnit, setSavingUnit] = useState(false);

  // Tracks the particular unit currently being deleted.
  const [deletingUnitId, setDeletingUnitId] = useState(null);

  // Displays backend validation errors inside the unit manager.
  const [unitError, setUnitError] = useState("");


  const totalProperties = useMemo(
    () => properties.length,
    [properties]
  );


  // Always derive the managed apartment from the latest property state.
  const managedApartment = useMemo(
    () =>
      properties.find(
        (property) => property.id === manageUnitsPropertyId
      ) || null,
    [properties, manageUnitsPropertyId]
  );


  useEffect(() => {
    fetchMyProperties();
  }, []);


  // Converts relative backend media paths into usable image URLs.
  const normalizeImageUrl = (img) => {
    if (!img) return "";

    if (
      img.startsWith("http://") ||
      img.startsWith("https://")
    ) {
      return img;
    }

    return `${API_MEDIA_BASE}${img}`;
  };


  // Normalizes property data before rendering it in the owner dashboard.
  const transformProperties = (data) => {
    if (!Array.isArray(data)) return [];

    return data.map((p) => ({
      ...p,
      status: p.status || "Active",

      images: Array.isArray(p.images)
        ? p.images.map((item) =>
            normalizeImageUrl(item.image || item)
          )
        : [],

      // Ensure apartment units are always safe to iterate over.
      apartment_units: Array.isArray(p.apartment_units)
        ? p.apartment_units
        : [],
    }));
  };


  // Loads every property belonging to the authenticated owner.
  const fetchMyProperties = async () => {
    try {
      setLoading(true);

      const data = await getMyProperties();

      const list = Array.isArray(data)
        ? data
        : data.results ?? [];

      setProperties(transformProperties(list));
    } catch (err) {
      console.error(
        "Failed to fetch properties:",
        err
      );

      setProperties([]);
    } finally {
      setLoading(false);
    }
  };


  // Opens the image viewer at the selected image index.
  const openViewer = (images, start = 0) => {
    setViewerImages(images || []);
    setViewerIndex(start);
    setViewerOpen(true);
  };


  // Closes and resets the image viewer.
  const closeViewer = () => {
    setViewerOpen(false);
    setViewerImages([]);
    setViewerIndex(0);
  };


  const showPrev = () => {
    setViewerIndex((previousIndex) =>
      previousIndex === 0
        ? viewerImages.length - 1
        : previousIndex - 1
    );
  };


  const showNext = () => {
    setViewerIndex((previousIndex) =>
      previousIndex === viewerImages.length - 1
        ? 0
        : previousIndex + 1
    );
  };


  // Opens the existing property edit modal.
  const handleEdit = (property) => {
    setEditProperty(property);
  };


  // Updates only the edited property in local state.
  const handleUpdated = (updatedProp) => {
    if (!updatedProp) return;

    const [normalised] = transformProperties([
      updatedProp,
    ]);

    setProperties((prev) =>
      prev.map((p) =>
        p.id === normalised.id
          ? normalised
          : p
      )
    );
  };


  // Opens the existing delete confirmation modal.
  const openDeleteModal = (id) => {
    setSelectedPropertyId(id);
    setDeleteModalOpen(true);
  };


  // Closes the delete modal when deletion is not in progress.
  const closeDeleteModal = () => {
    if (deleting) return;

    setDeleteModalOpen(false);
    setSelectedPropertyId(null);
  };


  // Deletes the selected property and removes it from local state.
  const confirmDelete = async () => {
    if (!selectedPropertyId) return;

    try {
      setDeleting(true);

      await deleteProperty(
        selectedPropertyId
      );

      setProperties((prev) =>
        prev.filter(
          (p) =>
            p.id !== selectedPropertyId
        )
      );

      setDeleteModalOpen(false);
      setSelectedPropertyId(null);
    } catch (err) {
      console.error(
        "Delete failed:",
        err
      );

      alert(
        "Failed to delete property."
      );
    } finally {
      setDeleting(false);
    }
  };


  // Sends a flagged or hidden property to the admin for rechecking.
  const handleRequestRecheck = async (property) => {
    if (
      !property?.id ||
      recheckingPropertyId !== null
    ) {
      return;
    }

    try {
      setRecheckingPropertyId(
        property.id
      );

      const result =
        await requestPropertyRecheck(
          property.id
        );

      // Change the local moderation status immediately after success.
      setProperties((prev) =>
        prev.map((p) =>
          p.id === property.id
            ? {
                ...p,
                report_flag_status:
                  "reviewing",
              }
            : p
        )
      );

      alert(
        result?.message ||
          "Recheck request submitted successfully."
      );
    } catch (err) {
      console.error(
        "Recheck request failed:",
        err
      );

      alert(
        err?.detail ||
          err?.message ||
          "Failed to submit the recheck request."
      );
    } finally {
      setRecheckingPropertyId(null);
    }
  };


  // Converts backend moderation statuses into owner-friendly labels.
  const getReportStatusLabel = (reportStatus) => {
    switch ((reportStatus || "active").toLowerCase()) {
      case "flagged":
        return "Flagged";

      case "hidden":
        return "Hidden from Public";

      case "reviewing":
        return "Under Review";

      case "resolved":
        return "Resolved";

      default:
        return "Active";
    }
  };


  // Confirms whether a property supports separately managed apartment units.
  const isMultiUnitApartment = (property) => {
    return (
      property?.category === "apartment" &&
      property?.apartment_listing_type === "multi_unit"
    );
  };


  // Opens the apartment-unit manager only for valid multi-unit apartments.
  const openManageUnits = (property) => {
    if (!isMultiUnitApartment(property)) {
      return;
    }

    setManageUnitsPropertyId(property.id);
    setEditingUnitId(null);
    setUnitForm(EMPTY_UNIT_FORM);
    setUnitError("");
  };


  // Closes the apartment-unit manager when no mutation is running.
  const closeManageUnits = () => {
    if (savingUnit || deletingUnitId !== null) {
      return;
    }

    setManageUnitsPropertyId(null);
    setEditingUnitId(null);
    setUnitForm(EMPTY_UNIT_FORM);
    setUnitError("");
  };


  // Keeps all apartment-unit form fields in a single state object.
  const handleUnitFormChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setUnitForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };


  // Converts backend validation objects into a readable error message.
  const getUnitErrorMessage = (
    error,
    fallbackMessage
  ) => {
    if (!error) {
      return fallbackMessage;
    }

    if (typeof error === "string") {
      return error;
    }

    if (error.detail) {
      return Array.isArray(error.detail)
        ? error.detail.join(" ")
        : String(error.detail);
    }

    if (error.message) {
      return String(error.message);
    }

    const firstField = Object.keys(error)[0];

    if (firstField) {
      const fieldError = error[firstField];

      if (Array.isArray(fieldError)) {
        return fieldError.join(" ");
      }

      if (typeof fieldError === "string") {
        return fieldError;
      }

      if (
        fieldError &&
        typeof fieldError === "object"
      ) {
        const nestedValue =
          Object.values(fieldError)[0];

        if (Array.isArray(nestedValue)) {
          return nestedValue.join(" ");
        }

        if (nestedValue) {
          return String(nestedValue);
        }
      }
    }

    return fallbackMessage;
  };


  // Opens an existing unit in edit mode.
  const startEditingUnit = (unit) => {
    setEditingUnitId(unit.id);
    setUnitError("");

    setUnitForm({
      unit_number: unit.unit_number ?? "",
      bedrooms: unit.bedrooms ?? 1,
      bathrooms: unit.bathrooms ?? 1,
      floor: unit.floor ?? "",
      price: unit.price ?? "",
      is_furnished: Boolean(unit.is_furnished),

      // Present list data in a simple comma-separated text field.
      amenities: Array.isArray(unit.amenities)
        ? unit.amenities.join(", ")
        : unit.amenities || "",
    });
  };


  // Returns the unit form to create mode.
  const cancelUnitEdit = () => {
    if (savingUnit) {
      return;
    }

    setEditingUnitId(null);
    setUnitForm(EMPTY_UNIT_FORM);
    setUnitError("");
  };


  // Creates the backend payload expected by ApartmentUnitSerializer.
  const buildUnitPayload = () => {
    const amenities = String(
      unitForm.amenities || ""
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      unit_number: String(
        unitForm.unit_number || ""
      ).trim(),

      bedrooms: Number(
        unitForm.bedrooms
      ),

      bathrooms: Number(
        unitForm.bathrooms
      ),

      floor: String(
        unitForm.floor || ""
      ).trim(),

      price: String(
        unitForm.price || ""
      ).trim(),

      is_furnished: Boolean(
        unitForm.is_furnished
      ),

      amenities,
    };
  };


  // Creates a new unit or saves changes to an existing unit.
  const handleUnitSubmit = async (event) => {
    event.preventDefault();

    if (!managedApartment) {
      return;
    }

    const payload =
      buildUnitPayload();

    if (!payload.unit_number) {
      setUnitError(
        "Unit number or name is required."
      );

      return;
    }

    if (
      !payload.price ||
      Number(payload.price) <= 0
    ) {
      setUnitError(
        "Apartment unit price must be greater than zero."
      );

      return;
    }

    if (
      Number.isNaN(payload.bedrooms) ||
      payload.bedrooms < 0
    ) {
      setUnitError(
        "Bedrooms must be zero or greater."
      );

      return;
    }

    if (
      Number.isNaN(payload.bathrooms) ||
      payload.bathrooms < 0
    ) {
      setUnitError(
        "Bathrooms must be zero or greater."
      );

      return;
    }

    try {
      setSavingUnit(true);
      setUnitError("");

      if (editingUnitId) {
        // Update only owner-editable unit fields.
        await updateApartmentUnit(
          editingUnitId,
          payload
        );
      } else {
        // Create the new unit under the selected apartment property.
        await createApartmentUnit(
          managedApartment.id,
          payload
        );
      }

      // Refresh the full property so nested units and parent
      // availability reflect the backend's latest state.
      await fetchMyProperties();

      setEditingUnitId(null);
      setUnitForm(EMPTY_UNIT_FORM);
    } catch (error) {
      console.error(
        "Apartment unit save failed:",
        error
      );

      setUnitError(
        getUnitErrorMessage(
          error,
          "Failed to save apartment unit."
        )
      );
    } finally {
      setSavingUnit(false);
    }
  };


  // Deletes an available unit and refreshes the parent property.
  const handleDeleteUnit = async (unit) => {
    if (!unit?.id) {
      return;
    }

    // Reserved and occupied units should not be removed from the UI.
    if (unit.status !== "available") {
      setUnitError(
        "Reserved or occupied apartment units cannot be deleted."
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete apartment unit "${unit.unit_number}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingUnitId(unit.id);
      setUnitError("");

      await deleteApartmentUnit(
        unit.id
      );

      // Refresh so the parent's availability is synchronized.
      await fetchMyProperties();

      if (editingUnitId === unit.id) {
        setEditingUnitId(null);
        setUnitForm(EMPTY_UNIT_FORM);
      }
    } catch (error) {
      console.error(
        "Apartment unit delete failed:",
        error
      );

      setUnitError(
        getUnitErrorMessage(
          error,
          "Failed to delete apartment unit."
        )
      );
    } finally {
      setDeletingUnitId(null);
    }
  };


  if (loading) {
    return (
      <div className="mp-page">
        <div className="mp-loading">
          <div className="mp-spinner" />
          <p>Loading properties...</p>
        </div>
      </div>
    );
  }


  if (
    !loading &&
    properties.length === 0
  ) {
    return (
      <NoPropertyUploaded
        onAddProperty={() =>
          navigate(
            "/dashboard/owner/UploadDetails/uploadpage"
          )
        }
      />
    );
  }


  return (
    <div className="mp-page">

      {/* Header */}
      <div className="mp-header">
        <div>
          <h1 className="mp-title">
            My Properties
          </h1>

          <p className="mp-sub">
            Manage your uploaded properties,
            images, units, and listing actions.
          </p>
        </div>

        <div className="mp-count-badge">
          <span>
            {totalProperties}
          </span>

          <small>
            Total Listings
          </small>
        </div>
      </div>


      {/* Desktop property table */}
      <div className="mp-table-wrap">
        <table className="mp-table">
          <thead>
            <tr>
              <th>
                <FaHashtag /> ID
              </th>

              <th>
                <FaImages /> Image
              </th>

              <th>
                <FaHome /> Property Name
              </th>

              <th>
                <FaBuilding /> Category
              </th>

              <th>
                <FaTag /> Price
              </th>

              <th>
                <FaMapMarkerAlt /> City
              </th>

              <th>
                Status
              </th>

              <th>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {properties.map(
              (p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: i * 0.04,
                    duration: 0.3,
                  }}
                >
                  <td className="mp-td-id">
                    #{p.id}
                  </td>

                  <td>
                    {p.images?.length > 0 ? (
                      <div
                        className="mp-thumb-cell"
                        onClick={() =>
                          openViewer(
                            p.images,
                            0
                          )
                        }
                      >
                        <img
                          src={
                            p.images[0]
                          }
                          alt={
                            p.property_name
                          }
                          className="mp-thumb"
                        />

                        <div className="mp-thumb-overlay">
                          <FaImages />

                          <span>
                            View
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mp-thumb-cell mp-thumb-empty">
                        <FaHome />
                      </div>
                    )}
                  </td>

                  <td className="mp-td-name">
                    {p.property_name}

                    {/* Show unit count only for multi-unit apartment listings. */}
                    {isMultiUnitApartment(p) && (
                      <div className="mp-unit-count-text">
                        {p.apartment_units?.length ?? 0}{" "}
                        apartment unit
                        {(p.apartment_units?.length ?? 0) === 1
                          ? ""
                          : "s"}
                      </div>
                    )}
                  </td>

                  <td>
                    <span className="mp-cat-badge">
                      {CATEGORY_LABELS[
                        p.category
                      ] ||
                        p.category}
                    </span>
                  </td>

                  <td className="mp-td-price">
                    GHS{" "}
                    {Number(
                      p.price
                    ).toLocaleString()}
                  </td>

                  <td>
                    {p.city}
                  </td>

                  <td>
                    {/* Preserve the existing property/listing status. */}
                    <span
                      className={`mp-status mp-status--${(
                        p.status ??
                        "active"
                      ).toLowerCase()}`}
                    >
                      {p.status ??
                        "Active"}
                    </span>

                    {/* Show moderation information whenever the property is not report-active. */}
                    {(p.report_flag_status || "active") !== "active" && (
                      <div
                        className={`mp-report-info mp-report-info--${
                          p.report_flag_status || "active"
                        }`}
                      >
                        <strong>
                          {getReportStatusLabel(
                            p.report_flag_status
                          )}
                        </strong>

                        <span>
                          Reports:{" "}
                          {p.reported_count ?? 0}
                        </span>

                        <span>
                          Main reasons:{" "}
                          {p.report_flag_reason_summary ||
                            "Not available"}
                        </span>
                      </div>
                    )}
                  </td>

                  <td>
                    <div className="mp-actions">

                      <button
                        className="mp-btn mp-btn--edit"
                        onClick={() =>
                          handleEdit(p)
                        }
                      >
                        <FaEdit />
                        Edit
                      </button>


                      {/* Multi-unit apartments receive their own unit manager. */}
                      {isMultiUnitApartment(p) && (
                        <button
                          className="mp-btn mp-btn--units"
                          onClick={() =>
                            openManageUnits(p)
                          }
                        >
                          <FaBuilding />
                          Manage Units
                        </button>
                      )}


                      {/* Flagged and hidden properties can request admin recheck. */}
                      {[
                        "flagged",
                        "hidden",
                      ].includes(
                        p.report_flag_status
                      ) && (
                        <button
                          className="mp-btn"
                          onClick={() =>
                            handleRequestRecheck(
                              p
                            )
                          }
                          disabled={
                            recheckingPropertyId ===
                            p.id
                          }
                        >
                          {recheckingPropertyId ===
                          p.id
                            ? "Requesting..."
                            : "Request Recheck"}
                        </button>
                      )}


                      {/* Reviewing properties cannot submit duplicate requests. */}
                      {p.report_flag_status ===
                        "reviewing" && (
                        <button
                          className="mp-btn"
                          disabled
                        >
                          Under Review
                        </button>
                      )}


                      <button
                        className="mp-btn mp-btn--delete"
                        onClick={() =>
                          openDeleteModal(
                            p.id
                          )
                        }
                      >
                        <FaTrash />
                        Delete
                      </button>

                    </div>
                  </td>
                </motion.tr>
              )
            )}
          </tbody>
        </table>
      </div>


      {/* Mobile property cards */}
      <div className="mp-mobile-list">
        {properties.map((p) => (
          <div
            className="mp-mobile-card"
            key={p.id}
          >
            <div
              className="mp-mobile-img-wrap"
              onClick={() =>
                p.images?.length > 0 &&
                openViewer(
                  p.images,
                  0
                )
              }
            >
              {p.images?.length > 0 ? (
                <>
                  <img
                    src={
                      p.images[0]
                    }
                    alt={
                      p.property_name
                    }
                    className="mp-mobile-img"
                  />

                  <div className="mp-mobile-img-overlay">
                    <FaImages />

                    <span>
                      View all images
                    </span>
                  </div>
                </>
              ) : (
                <div className="mp-mobile-no-img">
                  <FaHome />
                </div>
              )}

              <span
                className={`mp-status mp-status--${(
                  p.status ??
                  "active"
                ).toLowerCase()} mp-status--float`}
              >
                {p.status ??
                  "Active"}
              </span>
            </div>


            <div className="mp-mobile-body">
              <h3>
                {p.property_name}
              </h3>

              <div className="mp-mobile-meta">
                <span>
                  <FaHashtag />
                  #{p.id}
                </span>

                <span>
                  <FaBuilding />
                  {CATEGORY_LABELS[
                    p.category
                  ] ||
                    p.category}
                </span>

                <span>
                  <FaTag />
                  GHS{" "}
                  {Number(
                    p.price
                  ).toLocaleString()}
                </span>

                <span>
                  <FaMapMarkerAlt />
                  {p.city}
                </span>

                {/* Show unit count on multi-unit apartment cards. */}
                {isMultiUnitApartment(p) && (
                  <span>
                    <FaBuilding />
                    {p.apartment_units?.length ?? 0}{" "}
                    unit
                    {(p.apartment_units?.length ?? 0) === 1
                      ? ""
                      : "s"}
                  </span>
                )}
              </div>


              {/* Show report moderation details to the property owner. */}
              {(p.report_flag_status || "active") !== "active" && (
                <div
                  className={`mp-report-info mp-report-info--${
                    p.report_flag_status || "active"
                  }`}
                >
                  <strong>
                    {getReportStatusLabel(
                      p.report_flag_status
                    )}
                  </strong>

                  <span>
                    Reports:{" "}
                    {p.reported_count ?? 0}
                  </span>

                  <span>
                    Main reasons:{" "}
                    {p.report_flag_reason_summary ||
                      "Not available"}
                  </span>
                </div>
              )}


              <div className="mp-actions mp-actions--mobile">

                <button
                  className="mp-btn mp-btn--edit"
                  onClick={() =>
                    handleEdit(p)
                  }
                >
                  <FaEdit />
                  Edit
                </button>


                {/* Manage units appears only for multi-unit apartments. */}
                {isMultiUnitApartment(p) && (
                  <button
                    className="mp-btn mp-btn--units"
                    onClick={() =>
                      openManageUnits(p)
                    }
                  >
                    <FaBuilding />
                    Manage Units
                  </button>
                )}


                {/* Flagged and hidden properties can request admin recheck. */}
                {[
                  "flagged",
                  "hidden",
                ].includes(
                  p.report_flag_status
                ) && (
                  <button
                    className="mp-btn"
                    onClick={() =>
                      handleRequestRecheck(
                        p
                      )
                    }
                    disabled={
                      recheckingPropertyId ===
                      p.id
                    }
                  >
                    {recheckingPropertyId ===
                    p.id
                      ? "Requesting..."
                      : "Request Recheck"}
                  </button>
                )}


                {/* Reviewing properties remain visible but cannot request again. */}
                {p.report_flag_status ===
                  "reviewing" && (
                  <button
                    className="mp-btn"
                    disabled
                  >
                    Under Review
                  </button>
                )}


                <button
                  className="mp-btn mp-btn--delete"
                  onClick={() =>
                    openDeleteModal(
                      p.id
                    )
                  }
                >
                  <FaTrash />
                  Delete
                </button>

              </div>
            </div>
          </div>
        ))}
      </div>


      {/* Apartment-unit management modal */}
      <AnimatePresence>
        {managedApartment && (
          <motion.div
            className="mp-delete-backdrop"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={
              closeManageUnits
            }
          >
            <motion.div
              className="mp-delete-modal mp-unit-modal"
              initial={{
                scale: 0.94,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.94,
                opacity: 0,
              }}
              transition={{
                duration: 0.22,
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className="mp-viewer-close"
                onClick={
                  closeManageUnits
                }
                disabled={
                  savingUnit ||
                  deletingUnitId !== null
                }
              >
                <FaTimes />
              </button>


              <div className="mp-unit-modal-header">
                <div>
                  <h3>
                    Manage Apartment Units
                  </h3>

                  <p>
                    {managedApartment.property_name}
                  </p>
                </div>

                <span className="mp-unit-total-badge">
                  {managedApartment.apartment_units?.length ??
                    0}{" "}
                  Units
                </span>
              </div>


              {/* Existing apartment units */}
              <div className="mp-unit-list">
                {managedApartment.apartment_units?.length >
                0 ? (
                  managedApartment.apartment_units.map(
                    (unit) => (
                      <div
                        className="mp-unit-card"
                        key={unit.id}
                      >
                        <div className="mp-unit-card-main">
                          <div>
                            <strong>
                              {unit.unit_number}
                            </strong>

                            <span>
                              {unit.floor ||
                                "Floor not specified"}
                            </span>
                          </div>

                          <span
                            className={`mp-unit-status mp-unit-status--${unit.status}`}
                          >
                            {unit.status}
                          </span>
                        </div>


                        <div className="mp-unit-details">
                          <span>
                            Bedrooms:{" "}
                            {unit.bedrooms}
                          </span>

                          <span>
                            Bathrooms:{" "}
                            {unit.bathrooms}
                          </span>

                          <span>
                            GHS{" "}
                            {Number(
                              unit.price
                            ).toLocaleString()}
                          </span>

                          <span>
                            {unit.is_furnished
                              ? "Furnished"
                              : "Not Furnished"}
                          </span>
                        </div>


                        {Array.isArray(
                          unit.amenities
                        ) &&
                          unit.amenities.length >
                            0 && (
                            <div className="mp-unit-amenities">
                              {unit.amenities.join(
                                ", "
                              )}
                            </div>
                          )}


                        <div className="mp-actions">
                          <button
                            type="button"
                            className="mp-btn mp-btn--edit"
                            onClick={() =>
                              startEditingUnit(
                                unit
                              )
                            }
                            disabled={
                              savingUnit ||
                              deletingUnitId !== null
                            }
                          >
                            <FaEdit />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="mp-btn mp-btn--delete"
                            onClick={() =>
                              handleDeleteUnit(
                                unit
                              )
                            }
                            disabled={
                              deletingUnitId ===
                                unit.id ||
                              savingUnit ||
                              unit.status !==
                                "available"
                            }
                            title={
                              unit.status !==
                              "available"
                                ? "Reserved or occupied units cannot be deleted."
                                : "Delete apartment unit"
                            }
                          >
                            <FaTrash />

                            {deletingUnitId ===
                            unit.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="mp-unit-empty">
                    <FaBuilding />

                    <strong>
                      No apartment units yet
                    </strong>

                    <p>
                      Add the individual apartments
                      available inside this property.
                    </p>
                  </div>
                )}
              </div>


              {/* Create/edit apartment-unit form */}
              <form
                className="mp-unit-form"
                onSubmit={
                  handleUnitSubmit
                }
              >
                <div className="mp-unit-form-title">
                  <div>
                    <h4>
                      {editingUnitId
                        ? "Edit Unit"
                        : "Add New Unit"}
                    </h4>

                    <p>
                      {editingUnitId
                        ? "Update the selected apartment unit."
                        : "Add a separately rentable apartment unit."}
                    </p>
                  </div>

                  {!editingUnitId && (
                    <FaPlus />
                  )}
                </div>


                {unitError && (
                  <div className="mp-unit-error">
                    {unitError}
                  </div>
                )}


                <div className="mp-unit-form-grid">

                  <div className="mp-unit-field">
                    <label htmlFor="unit_number">
                      Unit Number / Name
                    </label>

                    <input
                      id="unit_number"
                      name="unit_number"
                      type="text"
                      value={
                        unitForm.unit_number
                      }
                      onChange={
                        handleUnitFormChange
                      }
                      placeholder="e.g. A1, Flat 3"
                      maxLength={50}
                      required
                    />
                  </div>


                  <div className="mp-unit-field">
                    <label htmlFor="unit_price">
                      Monthly Price (GHS)
                    </label>

                    <input
                      id="unit_price"
                      name="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        unitForm.price
                      }
                      onChange={
                        handleUnitFormChange
                      }
                      required
                    />
                  </div>


                  <div className="mp-unit-field">
                    <label htmlFor="unit_bedrooms">
                      Bedrooms
                    </label>

                    <input
                      id="unit_bedrooms"
                      name="bedrooms"
                      type="number"
                      min="0"
                      step="1"
                      value={
                        unitForm.bedrooms
                      }
                      onChange={
                        handleUnitFormChange
                      }
                      required
                    />
                  </div>


                  <div className="mp-unit-field">
                    <label htmlFor="unit_bathrooms">
                      Bathrooms
                    </label>

                    <input
                      id="unit_bathrooms"
                      name="bathrooms"
                      type="number"
                      min="0"
                      step="1"
                      value={
                        unitForm.bathrooms
                      }
                      onChange={
                        handleUnitFormChange
                      }
                      required
                    />
                  </div>


                  <div className="mp-unit-field">
                    <label htmlFor="unit_floor">
                      Floor
                    </label>

                    <input
                      id="unit_floor"
                      name="floor"
                      type="text"
                      value={
                        unitForm.floor
                      }
                      onChange={
                        handleUnitFormChange
                      }
                      placeholder="e.g. Ground Floor"
                      maxLength={50}
                    />
                  </div>


                  <div className="mp-unit-field mp-unit-field--checkbox">
                    <label htmlFor="unit_is_furnished">
                      <input
                        id="unit_is_furnished"
                        name="is_furnished"
                        type="checkbox"
                        checked={
                          unitForm.is_furnished
                        }
                        onChange={
                          handleUnitFormChange
                        }
                      />

                      Furnished
                    </label>
                  </div>


                  <div className="mp-unit-field mp-unit-field--full">
                    <label htmlFor="unit_amenities">
                      Amenities
                    </label>

                    <input
                      id="unit_amenities"
                      name="amenities"
                      type="text"
                      value={
                        unitForm.amenities
                      }
                      onChange={
                        handleUnitFormChange
                      }
                      placeholder="e.g. Balcony, Air conditioning, Water heater"
                    />

                    <small>
                      Separate amenities with commas.
                    </small>
                  </div>

                </div>


                <div className="mp-unit-form-actions">
                  {editingUnitId && (
                    <button
                      type="button"
                      className="mp-btn mp-btn--cancel"
                      onClick={
                        cancelUnitEdit
                      }
                      disabled={
                        savingUnit
                      }
                    >
                      Cancel Edit
                    </button>
                  )}

                  <button
                    type="submit"
                    className="mp-btn mp-btn--edit"
                    disabled={
                      savingUnit ||
                      deletingUnitId !== null
                    }
                  >
                    {savingUnit
                      ? "Saving..."
                      : editingUnitId
                      ? "Save Changes"
                      : "Add Unit"}
                  </button>
                </div>
              </form>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Image viewer */}
      <AnimatePresence>
        {viewerOpen && (
          <motion.div
            className="mp-viewer-backdrop"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={
              closeViewer
            }
          >
            <motion.div
              className="mp-viewer-modal"
              initial={{
                scale: 0.92,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.92,
                opacity: 0,
              }}
              transition={{
                duration: 0.25,
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <button
                className="mp-viewer-close"
                onClick={
                  closeViewer
                }
              >
                <FaTimes />
              </button>


              <div className="mp-viewer-main">
                <button
                  className="mp-viewer-nav mp-viewer-nav--prev"
                  onClick={
                    showPrev
                  }
                >
                  <FaChevronLeft />
                </button>

                <img
                  src={
                    viewerImages[
                      viewerIndex
                    ]
                  }
                  alt={`Property ${
                    viewerIndex + 1
                  }`}
                  className="mp-viewer-img"
                />

                <button
                  className="mp-viewer-nav mp-viewer-nav--next"
                  onClick={
                    showNext
                  }
                >
                  <FaChevronRight />
                </button>
              </div>


              <div className="mp-viewer-footer">
                <span>
                  {viewerIndex + 1} /{" "}
                  {viewerImages.length}
                </span>

                <div className="mp-viewer-thumbs">
                  {viewerImages.map(
                    (img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`thumb ${
                          i + 1
                        }`}
                        className={`mp-viewer-thumb ${
                          viewerIndex ===
                          i
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setViewerIndex(
                            i
                          )
                        }
                      />
                    )
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div
            className="mp-delete-backdrop"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={
              closeDeleteModal
            }
          >
            <motion.div
              className="mp-delete-modal"
              initial={{
                scale: 0.9,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.9,
                opacity: 0,
              }}
              transition={{
                duration: 0.22,
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="mp-delete-icon">
                <FaExclamationTriangle />
              </div>

              <h3>
                Delete Property
              </h3>

              <p>
                Are you sure you want to delete this property?
              </p>

              <p className="mp-delete-subtext">
                This action cannot be undone.
              </p>

              <div className="mp-delete-actions">
                <button
                  className="mp-btn mp-btn--cancel"
                  onClick={
                    closeDeleteModal
                  }
                  disabled={
                    deleting
                  }
                >
                  Cancel
                </button>

                <button
                  className="mp-btn mp-btn--confirm-delete"
                  onClick={
                    confirmDelete
                  }
                  disabled={
                    deleting
                  }
                >
                  {deleting
                    ? "Deleting..."
                    : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Existing property edit modal */}
      {editProperty && (
        <EditPropertyModal
          property={
            editProperty
          }
          onClose={() =>
            setEditProperty(
              null
            )
          }
          onUpdated={
            handleUpdated
          }
        />
      )}

    </div>
  );
};


export default MyProperties;