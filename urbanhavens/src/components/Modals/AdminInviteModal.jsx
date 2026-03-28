import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTimes,
  FaUserShield,
  FaPaperPlane,
  FaClock,
  FaClipboardList,
} from "react-icons/fa";
import "./AdminInviteModal.css";

const overlayAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

const modalAnim = {
  hidden: { opacity: 0, scale: 0.96, y: 14 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: { duration: 0.18, ease: "easeInOut" },
  },
};

const DEFAULT_REASON = "Help me post a property";

const AdminInviteModal = ({
  open,
  onClose,
  onSendInvite,
  admins = [],
  loading = false,
}) => {
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [reason, setReason] = useState(DEFAULT_REASON);

  const selectedAdmin = useMemo(
    () => admins.find((admin) => String(admin.id) === String(selectedAdminId)) || null,
    [admins, selectedAdminId]
  );

  const handleSubmit = () => {
    if (!selectedAdmin) return;

    onSendInvite?.({
      admin: selectedAdmin,
      reason: reason.trim() || DEFAULT_REASON,
    });

    setSelectedAdminId("");
    setReason(DEFAULT_REASON);
  };

  const handleClose = () => {
    if (loading) return;
    setSelectedAdminId("");
    setReason(DEFAULT_REASON);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="aim-overlay"
          variants={overlayAnim}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={handleClose}
        >
          <motion.div
            className="aim-modal"
            variants={modalAnim}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aim-head">
              <div className="aim-title-wrap">
                <div className="aim-icon">
                  <FaUserShield />
                </div>
                <div>
                  <h3 className="aim-title">Invite Admin Assistance</h3>
                  <p className="aim-subtitle">
                    Grant a temporary 30-minute support session to an active admin.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="aim-close"
                onClick={handleClose}
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>

            <div className="aim-body">
              <div className="aim-field">
                <label className="aim-label">Select active admin</label>
                <select
                  className="aim-select"
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                >
                  <option value="">Choose an admin</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name} — {admin.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="aim-field">
                <label className="aim-label">Reason</label>
                <div className="aim-input-wrap">
                  <FaClipboardList className="aim-input-icon" />
                  <input
                    type="text"
                    className="aim-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why are you inviting the admin?"
                    maxLength={120}
                  />
                </div>
              </div>

              <div className="aim-note">
                <div className="aim-note-item">
                  <FaClock />
                  <span>Session lasts 30 minutes</span>
                </div>
                <div className="aim-note-item">
                  <FaUserShield />
                  <span>Only active admins should be invited</span>
                </div>
              </div>

              {selectedAdmin && (
                <div className="aim-preview">
                  <p className="aim-preview-label">Selected admin</p>
                  <p className="aim-preview-name">{selectedAdmin.name}</p>
                  <p className="aim-preview-email">{selectedAdmin.email}</p>
                </div>
              )}
            </div>

            <div className="aim-actions">
              <button
                type="button"
                className="aim-btn aim-btn--ghost"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="aim-btn aim-btn--primary"
                onClick={handleSubmit}
                disabled={!selectedAdmin || loading}
              >
                <FaPaperPlane />
                {loading ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdminInviteModal;