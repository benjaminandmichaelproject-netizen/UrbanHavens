import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaEdit, FaTrash, FaImages, FaTimes, FaChevronLeft,
  FaChevronRight, FaExclamationTriangle, FaHome, FaBuilding,
  FaMapMarkerAlt, FaTag, FaHashtag,
} from "react-icons/fa";
import { getMyProperties, deleteProperty } from "../UploadDetails/api/api";
import NoPropertyUploaded from "../NoPropertyUploaded/NoPropertyUploaded";
import EditPropertyModal from "./EditPropertyModal";
import "./MyProperties.css";

const API_MEDIA_BASE = "http://127.0.0.1:8000";

const CATEGORY_LABELS = {
  hostel:     "Hostel",
  house_rent: "House for Rent",
};

const MyProperties = () => {
  const navigate = useNavigate();

  const [properties, setProperties]           = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [viewerOpen, setViewerOpen]           = useState(false);
  const [viewerImages, setViewerImages]       = useState([]);
  const [viewerIndex, setViewerIndex]         = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [deleting, setDeleting]               = useState(false);
  const [editProperty, setEditProperty]       = useState(null); // ← NEW

  const totalProperties = useMemo(() => properties.length, [properties]);

  useEffect(() => { fetchMyProperties(); }, []);

  const normalizeImageUrl = (img) => {
    if (!img) return "";
    if (img.startsWith("http://") || img.startsWith("https://")) return img;
    return `${API_MEDIA_BASE}${img}`;
  };

  const transformProperties = (data) => {
    if (!Array.isArray(data)) return [];
    return data.map((p) => ({
      ...p,
      status: p.status || "Active",
      images: Array.isArray(p.images)
        ? p.images.map((item) => normalizeImageUrl(item.image || item))
        : [],
    }));
  };

  const fetchMyProperties = async () => {
    try {
      setLoading(true);
      const data = await getMyProperties();
      const list = Array.isArray(data) ? data : data.results ?? [];
      setProperties(transformProperties(list));
    } catch (err) {
      console.error("Failed to fetch properties:", err);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const openViewer  = (images, start = 0) => { setViewerImages(images || []); setViewerIndex(start); setViewerOpen(true); };
  const closeViewer = () => { setViewerOpen(false); setViewerImages([]); setViewerIndex(0); };
  const showPrev    = () => setViewerIndex(p => p === 0 ? viewerImages.length - 1 : p - 1);
  const showNext    = () => setViewerIndex(p => p === viewerImages.length - 1 ? 0 : p + 1);

  // ── UPDATED: open modal instead of navigating ──────────────
  const handleEdit = (property) => setEditProperty(property);

  const handleUpdated = (updatedProp) => {
    if (!updatedProp) return;
    const [normalised] = transformProperties([updatedProp]);
    setProperties((prev) =>
      prev.map((p) => (p.id === normalised.id ? normalised : p))
    );
  };

  const openDeleteModal  = (id) => { setSelectedPropertyId(id); setDeleteModalOpen(true); };
  const closeDeleteModal = () => { if (deleting) return; setDeleteModalOpen(false); setSelectedPropertyId(null); };

  const confirmDelete = async () => {
    if (!selectedPropertyId) return;
    try {
      setDeleting(true);
      await deleteProperty(selectedPropertyId);
      setProperties(prev => prev.filter(p => p.id !== selectedPropertyId));
      closeDeleteModal();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete property.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="mp-page">
      <div className="mp-loading">
        <div className="mp-spinner" />
        <p>Loading properties...</p>
      </div>
    </div>
  );

  if (!loading && properties.length === 0) {
    return (
      <NoPropertyUploaded
        onAddProperty={() => navigate("/dashboard/owner/UploadDetails/uploadpage")}
      />
    );
  }

  return (
    <div className="mp-page">

      {/* ── Header ── */}
      <div className="mp-header">
        <div>
          <h1 className="mp-title">My Properties</h1>
          <p className="mp-sub">Manage your uploaded properties, images, and listing actions.</p>
        </div>
        <div className="mp-count-badge">
          <span>{totalProperties}</span>
          <small>Total Listings</small>
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="mp-table-wrap">
        <table className="mp-table">
          <thead>
            <tr>
              <th><FaHashtag /> ID</th>
              <th><FaImages /> Image</th>
              <th><FaHome /> Property Name</th>
              <th><FaBuilding /> Category</th>
              <th><FaTag /> Price</th>
              <th><FaMapMarkerAlt /> City</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p, i) => (
              <motion.tr
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <td className="mp-td-id">#{p.id}</td>
                <td>
                  {p.images?.length > 0 ? (
                    <div className="mp-thumb-cell" onClick={() => openViewer(p.images, 0)}>
                      <img src={p.images[0]} alt={p.property_name} className="mp-thumb" />
                      <div className="mp-thumb-overlay"><FaImages /><span>View</span></div>
                    </div>
                  ) : (
                    <div className="mp-thumb-cell mp-thumb-empty"><FaHome /></div>
                  )}
                </td>
                <td className="mp-td-name">{p.property_name}</td>
                <td>
                  <span className="mp-cat-badge">
                    {CATEGORY_LABELS[p.category] || p.category}
                  </span>
                </td>
                <td className="mp-td-price">GHS {Number(p.price).toLocaleString()}</td>
                <td>{p.city}</td>
                <td>
                  <span className={`mp-status mp-status--${(p.status ?? "active").toLowerCase()}`}>
                    {p.status ?? "Active"}
                  </span>
                </td>
                <td>
                  <div className="mp-actions">
                    <button className="mp-btn mp-btn--edit" onClick={() => handleEdit(p)}>
                      <FaEdit /> Edit
                    </button>
                    <button className="mp-btn mp-btn--delete" onClick={() => openDeleteModal(p.id)}>
                      <FaTrash /> Delete
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ── */}
      <div className="mp-mobile-list">
        {properties.map((p) => (
          <div className="mp-mobile-card" key={p.id}>
            <div className="mp-mobile-img-wrap" onClick={() => p.images?.length > 0 && openViewer(p.images, 0)}>
              {p.images?.length > 0 ? (
                <>
                  <img src={p.images[0]} alt={p.property_name} className="mp-mobile-img" />
                  <div className="mp-mobile-img-overlay"><FaImages /><span>View all images</span></div>
                </>
              ) : (
                <div className="mp-mobile-no-img"><FaHome /></div>
              )}
              <span className={`mp-status mp-status--${(p.status ?? "active").toLowerCase()} mp-status--float`}>{p.status ?? "Active"}</span>
            </div>
            <div className="mp-mobile-body">
              <h3>{p.property_name}</h3>
              <div className="mp-mobile-meta">
                <span><FaHashtag /> #{p.id}</span>
                <span><FaBuilding /> {CATEGORY_LABELS[p.category] || p.category}</span>
                <span><FaTag /> GHS {Number(p.price).toLocaleString()}</span>
                <span><FaMapMarkerAlt /> {p.city}</span>
              </div>
              <div className="mp-actions mp-actions--mobile">
                <button className="mp-btn mp-btn--edit" onClick={() => handleEdit(p)}>
                  <FaEdit /> Edit
                </button>
                <button className="mp-btn mp-btn--delete" onClick={() => openDeleteModal(p.id)}>
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Image Viewer ── */}
      <AnimatePresence>
        {viewerOpen && (
          <motion.div
            className="mp-viewer-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeViewer}
          >
            <motion.div
              className="mp-viewer-modal"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={e => e.stopPropagation()}
            >
              <button className="mp-viewer-close" onClick={closeViewer}><FaTimes /></button>
              <div className="mp-viewer-main">
                <button className="mp-viewer-nav mp-viewer-nav--prev" onClick={showPrev}><FaChevronLeft /></button>
                <img src={viewerImages[viewerIndex]} alt={`Property ${viewerIndex + 1}`} className="mp-viewer-img" />
                <button className="mp-viewer-nav mp-viewer-nav--next" onClick={showNext}><FaChevronRight /></button>
              </div>
              <div className="mp-viewer-footer">
                <span>{viewerIndex + 1} / {viewerImages.length}</span>
                <div className="mp-viewer-thumbs">
                  {viewerImages.map((img, i) => (
                    <img key={i} src={img} alt={`thumb ${i + 1}`}
                      className={`mp-viewer-thumb ${viewerIndex === i ? "active" : ""}`}
                      onClick={() => setViewerIndex(i)} />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete modal ── */}
      <AnimatePresence>
        {deleteModalOpen && (
          <motion.div
            className="mp-delete-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeDeleteModal}
          >
            <motion.div
              className="mp-delete-modal"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="mp-delete-icon"><FaExclamationTriangle /></div>
              <h3>Delete Property</h3>
              <p>Are you sure you want to delete this property?</p>
              <p className="mp-delete-subtext">This action cannot be undone.</p>
              <div className="mp-delete-actions">
                <button className="mp-btn mp-btn--cancel" onClick={closeDeleteModal} disabled={deleting}>Cancel</button>
                <button className="mp-btn mp-btn--confirm-delete" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Property Modal ── ← NEW */}
      {editProperty && (
        <EditPropertyModal
          property={editProperty}
          onClose={() => setEditProperty(null)}
          onUpdated={handleUpdated}
        />
      )}

    </div>
  );
};

export default MyProperties;