import React, { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaCheck,
  FaTimes,
  FaTrash,
  FaEye,
  FaHome,
  FaMapMarkerAlt,
  FaStar,
} from "react-icons/fa";
import PropertyModal from "../../../components/Modals/PropertyModal";
import ConfirmModal from "../../../components/Modals/ConfirmModal";
import "./Allproperties.css";

const Allproperties = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const formatCategory = (category) => {
    if (category === "house_rent") return "House for Rent";
    if (category === "hostel") return "Hostel";
    return category || "N/A";
  };

  const getImageList = (property) => {
    if (!Array.isArray(property?.images)) return [];
    return property.images
      .map((img) => img?.image)
      .filter(Boolean);
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

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/properties/admin-list/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("You are not authorized to view admin properties.");
        }
        throw new Error("Failed to fetch properties.");
      }

      const data = await res.json();
      const results = Array.isArray(data) ? data : data.results || [];
      setProperties(results);
    } catch (err) {
      console.error("Error fetching admin properties:", err);
      setProperties([]);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      const title = (p.property_name || "").toLowerCase();
      const location = `${p.city || ""} ${p.region || ""}`.toLowerCase();
      const owner = (p.owner_name || "").toLowerCase();
      const query = search.toLowerCase();

      const matchSearch =
        title.includes(query) ||
        location.includes(query) ||
        owner.includes(query);

      const matchFilter =
        filter === "all" ? true : p.approval_status === filter;

      return matchSearch && matchFilter;
    });
  }, [properties, search, filter]);

  const sendPropertyAction = async (propertyId, endpoint, method = "POST") => {
    const res = await fetch(`/api/properties/${propertyId}/${endpoint}/`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      let message = "Action failed.";
      try {
        const data = await res.json();
        message = data.detail || message;
      } catch {
        // ignore bad json
      }
      throw new Error(message);
    }

    if (method !== "DELETE") {
      return res.json();
    }

    return null;
  };

  const handleApprove = async (property) => {
    await sendPropertyAction(property.id, "approve");
  };

  const handleReject = async (property) => {
    await sendPropertyAction(property.id, "reject");
  };

  const handleFeature = async (property) => {
    await sendPropertyAction(
      property.id,
      property.is_featured ? "unfeature" : "feature"
    );
  };

  const handleDelete = async (property) => {
    const res = await fetch(`/api/properties/${property.id}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      let message = "Delete failed.";
      try {
        const data = await res.json();
        message = data.detail || message;
      } catch {
        // ignore bad json
      }
      throw new Error(message);
    }
  };

  const getConfirmMessage = () => {
    if (!confirmAction) return "";

    const title = confirmAction.property.property_name || "this property";

    if (confirmAction.type === "approve") {
      return `Are you sure you want to approve "${title}"?`;
    }

    if (confirmAction.type === "reject") {
      return `Are you sure you want to reject "${title}"?`;
    }

    if (confirmAction.type === "delete") {
      return `Are you sure you want to delete "${title}"? This action cannot be undone.`;
    }

    if (confirmAction.type === "feature") {
      return confirmAction.property.is_featured
        ? `Remove "${title}" from featured properties?`
        : `Add "${title}" to featured properties?`;
    }

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
      } else if (confirmAction.type === "feature") {
        await handleFeature(confirmAction.property);
      }

      setConfirmAction(null);
      setSelectedProperty(null);
      await fetchProperties();
    } catch (err) {
      console.error("Property action failed:", err);
      setError(err.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const totalCount = properties.length;
  const pendingCount = properties.filter(
    (p) => p.approval_status === "pending"
  ).length;
  const approvedCount = properties.filter(
    (p) => p.approval_status === "approved"
  ).length;
  const featuredCount = properties.filter((p) => p.is_featured).length;

  return (
    <div className="properties-page">
      <div className="properties-header">
        <div>
          <h2>All Properties</h2>
          <p>Manage and control all property listings on the platform.</p>
        </div>

        <div className="properties-stats">
          <div className="stat-card">
            <span>Total</span>
            <h3>{totalCount}</h3>
          </div>
          <div className="stat-card">
            <span>Pending</span>
            <h3>{pendingCount}</h3>
          </div>
          <div className="stat-card">
            <span>Approved</span>
            <h3>{approvedCount}</h3>
          </div>
          <div className="stat-card">
            <span>Featured</span>
            <h3>{featuredCount}</h3>
          </div>
        </div>
      </div>

      <div className="properties-toolbar">
        <div className="search-box">
          <FaSearch />
          <input
            type="text"
            placeholder="Search property, owner, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <button
            onClick={() => setFilter("all")}
            className={filter === "all" ? "active" : ""}
          >
            All
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={filter === "pending" ? "active" : ""}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={filter === "approved" ? "active" : ""}
          >
            Approved
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={filter === "rejected" ? "active" : ""}
          >
            Rejected
          </button>
        </div>
      </div>

      {loading && <p className="info-message">Loading properties...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && (
        <div className="properties-table-wrapper">
          <table className="properties-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Featured</th>
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

                    <td>
                      <span
                        className={`featured-badge ${
                          p.is_featured ? "on" : "off"
                        }`}
                      >
                        {p.is_featured ? "Yes" : "No"}
                      </span>
                    </td>

                    <td>GHS {p.price}</td>

                    <td>
                      <div className="actions">
                        <button
                          className="view"
                          onClick={() => setSelectedProperty(mapPropertyForModal(p))}
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
                          className={`feature ${p.is_featured ? "active" : ""}`}
                          onClick={() =>
                            setConfirmAction({ type: "feature", property: p })
                          }
                          title={p.is_featured ? "Unfeature" : "Feature"}
                          disabled={actionLoading || p.approval_status !== "approved"}
                        >
                          <FaStar />
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
                  <td colSpan="6" className="empty">
                    No properties found.
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

export default Allproperties;