import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaCheck,
  FaTimes,
  FaTrash,
  FaEye,
  FaHome,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { api } from "../../Owner/UploadDetails/api/api";
import PropertyModal from "../../../components/Modals/PropertyModal";
import ConfirmModal from "../../../components/Modals/ConfirmModal";
import "../Allproperties/Allproperties.css";

const Pending = () => {
  const [search, setSearch] = useState("");
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const formatCategory = (category) => {
    if (category === "house_rent") return "House for Rent";
    if (category === "hostel") return "Hostel";
    return category || "N/A";
  };

  const getImageList = (property) => {
    if (!Array.isArray(property?.images)) return [];
    return property.images.map((img) => img?.image).filter(Boolean);
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

  const mapPropertyForModal = (property) => ({
    ...property,
    title: property.property_name,
    location: [property.city, property.region].filter(Boolean).join(", "),
    owner: property.owner_name || "No Owner",
    status: property.approval_status,
    propertyType: property.property_type || "N/A",
    category: formatCategory(property.category),
    available: property.is_available,
    images: getImageList(property),
    amenities: parseAmenities(property.amenities),
    featured: property.is_featured,
  });

  const fetchPendingProperties = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/properties/admin-list/");
      const data = res.data;
      const results = Array.isArray(data) ? data : data.results || [];
      const onlyPending = results.filter(
        (property) => property.approval_status === "pending"
      );

      setProperties(onlyPending);
    } catch (err) {
      console.error("Error fetching pending properties:", err);
      setProperties([]);

      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setError("You are not authorized to view pending properties.");
      } else {
        setError(err.response?.data?.detail || err.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingProperties();
  }, []);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      const title = (p.property_name || "").toLowerCase();
      const location = `${p.city || ""} ${p.region || ""}`.toLowerCase();
      const owner = (p.owner_name || "").toLowerCase();
      const query = search.toLowerCase();

      return (
        title.includes(query) ||
        location.includes(query) ||
        owner.includes(query)
      );
    });
  }, [properties, search]);

  const sendPropertyAction = async (propertyId, endpoint) => {
    try {
      const res = await api.post(`/properties/${propertyId}/${endpoint}/`);
      return res.data;
    } catch (err) {
      const message =
        err.response?.data?.detail || err.message || "Action failed.";
      throw new Error(message);
    }
  };

  const handleApprove = async (property) => {
    await sendPropertyAction(property.id, "approve");
  };

  const handleReject = async (property) => {
    await sendPropertyAction(property.id, "reject");
  };

  const handleDelete = async (property) => {
    try {
      await api.delete(`/properties/${property.id}/`);
    } catch (err) {
      const message =
        err.response?.data?.detail || err.message || "Delete failed.";
      throw new Error(message);
    }
  };

  const getConfirmMessage = () => {
    if (!confirmAction) return "";
    const title = confirmAction.property.property_name || "this property";

    if (confirmAction.type === "approve")
      return `Are you sure you want to approve "${title}"?`;
    if (confirmAction.type === "reject")
      return `Are you sure you want to reject "${title}"?`;
    if (confirmAction.type === "delete")
      return `Are you sure you want to delete "${title}"? This action cannot be undone.`;

    return "";
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      setActionLoading(true);
      setError("");

      if (confirmAction.type === "approve") {
        await handleApprove(confirmAction.property);
      } else if (confirmAction.type === "reject") {
        await handleReject(confirmAction.property);
      } else if (confirmAction.type === "delete") {
        await handleDelete(confirmAction.property);
      }

      setConfirmAction(null);
      setSelectedProperty(null);
      await fetchPendingProperties();
    } catch (err) {
      console.error("Pending action failed:", err);
      setError(err.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="properties-page">
      <div className="properties-header">
        <div>
          <h2>Pending Properties</h2>
          <p>Review and moderate properties waiting for approval.</p>
        </div>

        <div className="properties-stats">
          <div className="stat-card">
            <span>Pending</span>
            <h3>{properties.length}</h3>
          </div>
        </div>
      </div>

      <div className="properties-toolbar">
        <div className="search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Search pending property..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && <p className="info-message">Loading pending properties...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && (
        <div className="properties-table-wrapper">
          <table className="properties-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length > 0 ? (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="property-info">
                        <FaHome className="property-icon" />
                        <div>
                          <h4>{p.property_name}</h4>
                          <p>
                            <FaMapMarkerAlt />{" "}
                            {[p.city, p.region].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td>{p.owner_name || "No Owner"}</td>

                    <td>
                      <span className={`status ${p.approval_status}`}>
                        {p.approval_status}
                      </span>
                    </td>

                    <td>GHS {p.price}</td>

                    <td>
                      <div className="actions">
                        <button
                          className="view"
                          onClick={() =>
                            setSelectedProperty(mapPropertyForModal(p))
                          }
                          title="View"
                        >
                          <FaEye />
                        </button>

                        <button
                          className="approve"
                          onClick={() =>
                            setConfirmAction({ type: "approve", property: p })
                          }
                          title="Approve"
                          disabled={actionLoading}
                        >
                          <FaCheck />
                        </button>

                        <button
                          className="reject"
                          onClick={() =>
                            setConfirmAction({ type: "reject", property: p })
                          }
                          title="Reject"
                          disabled={actionLoading}
                        >
                          <FaTimes />
                        </button>

                        <button
                          className="delete"
                          onClick={() =>
                            setConfirmAction({ type: "delete", property: p })
                          }
                          title="Delete"
                          disabled={actionLoading}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty">
                    No pending properties found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <PropertyModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onApprove={(property) =>
          setConfirmAction({ type: "approve", property })
        }
        onReject={(property) =>
          setConfirmAction({ type: "reject", property })
        }
        onDelete={(property) =>
          setConfirmAction({ type: "delete", property })
        }
      />

      {confirmAction && (
        <ConfirmModal
          title={`Confirm ${confirmAction.type}`}
          message={getConfirmMessage()}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

export default Pending;
