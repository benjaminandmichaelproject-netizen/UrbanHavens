import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyProperties, deleteProperty } from "../UploadDetails/api/api";
import NoPropertyUploaded from "../NoPropertyUploaded/NoPropertyUploaded";
import "./MyProperties.css";

const API_MEDIA_BASE = "http://127.0.0.1:8000";

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

  const totalProperties = useMemo(() => properties.length, [properties]);

  useEffect(() => {
    fetchMyProperties();
  }, []);

  const normalizeImageUrl = (img) => {
    if (!img) return "";
    if (img.startsWith("http://") || img.startsWith("https://")) return img;
    return `${API_MEDIA_BASE}${img}`;
  };

  const transformProperties = (data) => {
    if (!Array.isArray(data)) return [];

    return data.map((property) => ({
      ...property,
      status: property.status || "Active",
      images: Array.isArray(property.images)
        ? property.images.map((item) => normalizeImageUrl(item.image || item))
        : [],
    }));
  };

  const fetchMyProperties = async () => {
    try {
      setLoading(true);
      const data = await getMyProperties();
      setProperties(transformProperties(data));
    } catch (error) {
      console.error("Failed to fetch properties:", error);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const openViewer = (images, startIndex = 0) => {
    setViewerImages(images || []);
    setViewerIndex(startIndex);
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerImages([]);
    setViewerIndex(0);
  };

  const showPrevImage = () => {
    setViewerIndex((prev) =>
      prev === 0 ? viewerImages.length - 1 : prev - 1
    );
  };

  const showNextImage = () => {
    setViewerIndex((prev) =>
      prev === viewerImages.length - 1 ? 0 : prev + 1
    );
  };

  const handleEdit = (property) => {
    navigate(`/dashboard/owner/properties/edit/${property.id}`, {
      state: { property },
    });
  };

  const openDeleteModal = (propertyId) => {
    setSelectedPropertyId(propertyId);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalOpen(false);
    setSelectedPropertyId(null);
  };

  const confirmDelete = async () => {
    if (!selectedPropertyId) return;

    try {
      setDeleting(true);
      await deleteProperty(selectedPropertyId);
      setProperties((prev) =>
        prev.filter((item) => item.id !== selectedPropertyId)
      );
      closeDeleteModal();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete property.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="my-properties-page">
        <div className="empty-state">Loading properties...</div>
      </div>
    );
  }

  if (!loading && properties.length === 0) {
    return (
      <NoPropertyUploaded
        onAddProperty={() => navigate("/dashboard/owner/UploadDetails/uploadpage")}
      />
    );
  }

  return (
    <div className="my-properties-page">
      <div className="my-properties-header">
        <div>
          <h1>Recently Added Properties</h1>
          <p>Manage your uploaded properties, images, and listing actions.</p>
        </div>

        <div className="my-properties-summary">
          <span>{totalProperties}</span>
          <small>Total Listings</small>
        </div>
      </div>

      <div className="my-properties-table-wrapper">
        <table className="my-properties-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Image</th>
              <th>Property Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>City</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {properties.map((property) => (
              <tr key={property.id}>
                <td>#{property.id}</td>

                <td>
                  {property.images?.length > 0 ? (
                    <div
                      className="property-image-cell"
                      onClick={() => openViewer(property.images, 0)}
                    >
                      <img
                        src={property.images[0]}
                        alt={property.property_name}
                        className="property-thumb"
                      />
                      <div className="image-hover-overlay">
                        <span>View all images</span>
                      </div>
                    </div>
                  ) : (
                    <div className="property-image-cell no-image-cell">
                      <span>No Image</span>
                    </div>
                  )}
                </td>

                <td>{property.property_name}</td>
                <td>{property.category}</td>
                <td>GHS {Number(property.price).toFixed(2)}</td>
                <td>{property.city}</td>

                <td>
                  <span className={`status-badge ${property.status.toLowerCase()}`}>
                    {property.status}
                  </span>
                </td>

                <td>
                  <div className="action-buttons">
                    <button
                      className="edit-btn"
                      onClick={() => handleEdit(property)}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => openDeleteModal(property.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-property-list">
        {properties.map((property) => (
          <div className="mobile-property-card" key={property.id}>
            <div
              className="mobile-image-wrap"
              onClick={() =>
                property.images?.length > 0 && openViewer(property.images, 0)
              }
            >
              {property.images?.length > 0 ? (
                <>
                  <img
                    src={property.images[0]}
                    alt={property.property_name}
                    className="mobile-property-image"
                  />
                  <div className="image-hover-overlay mobile-overlay">
                    <span>View all images</span>
                  </div>
                </>
              ) : (
                <div className="mobile-no-image">No Image</div>
              )}
            </div>

            <div className="mobile-property-body">
              <div className="mobile-top-row">
                <h3>{property.property_name}</h3>
                <span className={`status-badge ${property.status.toLowerCase()}`}>
                  {property.status}
                </span>
              </div>

              <p><strong>ID:</strong> #{property.id}</p>
              <p><strong>Category:</strong> {property.category}</p>
              <p><strong>Price:</strong> GHS {Number(property.price).toFixed(2)}</p>
              <p><strong>City:</strong> {property.city}</p>

              <div className="action-buttons mobile-actions">
                <button
                  className="edit-btn"
                  onClick={() => handleEdit(property)}
                >
                  Edit
                </button>
                <button
                  className="delete-btn"
                  onClick={() => openDeleteModal(property.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewerOpen && (
        <div className="image-viewer-backdrop" onClick={closeViewer}>
          <div
            className="image-viewer-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-viewer-btn" onClick={closeViewer}>
              ✕
            </button>

            <div className="viewer-main">
              <button className="viewer-nav left" onClick={showPrevImage}>
                ‹
              </button>

              <img
                src={viewerImages[viewerIndex]}
                alt={`Property ${viewerIndex + 1}`}
                className="viewer-image"
              />

              <button className="viewer-nav right" onClick={showNextImage}>
                ›
              </button>
            </div>

            <div className="viewer-footer">
              <span>
                {viewerIndex + 1} / {viewerImages.length}
              </span>

              <div className="viewer-thumbnails">
                {viewerImages.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={`thumb ${index + 1}`}
                    className={`viewer-thumb ${
                      viewerIndex === index ? "active-thumb" : ""
                    }`}
                    onClick={() => setViewerIndex(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="delete-modal-backdrop" onClick={closeDeleteModal}>
          <div
            className="delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-icon">⚠</div>
            <h3>Delete Property</h3>
            <p>Are you sure you want to delete this property?</p>
            <p className="delete-modal-subtext">
              This action cannot be undone.
            </p>

            <div className="delete-modal-actions">
              <button
                className="cancel-delete-btn"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                className="confirm-delete-btn"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProperties;