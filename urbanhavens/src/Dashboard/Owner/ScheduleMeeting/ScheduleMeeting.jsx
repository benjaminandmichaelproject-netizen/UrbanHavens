import React, { useState } from "react";
import "./ScheduleMeeting.css";
import { api } from "../UploadDetails/api/api";

const ScheduleMeeting = ({ booking, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    location: "",
    note: "",
  });

  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    setServerError("");
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.time) newErrors.time = "Time is required";
    if (!formData.location.trim()) newErrors.location = "Meeting location is required";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setSubmitting(true);
      setServerError("");

      // If a meeting already exists for this booking, update it (PATCH)
      // Otherwise create a new one (POST)
      const existingMeetingId = booking?.meeting?.id;

      if (existingMeetingId) {
        await api.patch(`/meetings/${existingMeetingId}/`, {
          date:     formData.date,
          time:     formData.time,
          location: formData.location,
          note:     formData.note,
        });
      } else {
        await api.post("/meetings/", {
          booking:  booking.id,
          date:     formData.date,
          time:     formData.time,
          location: formData.location,
          note:     formData.note,
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Schedule meeting error:", err);
      const data = err.response?.data;
      if (data && typeof data === "object") {
        // Field-level errors from DRF
        const fieldErrors = {};
        Object.entries(data).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val;
        });
        setErrors(fieldErrors);
      } else {
        setServerError("Failed to schedule meeting. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="schedule-overlay" onClick={onClose}>
      <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>

        <div className="schedule-modal-header">
          <h2>{booking?.meeting ? "Update Meeting" : "Schedule Meeting"}</h2>
          <button className="schedule-close-btn" onClick={onClose}>✕</button>
        </div>

        <p className="schedule-subtext">
          Schedule a meeting with <strong>{booking?.tenant_name}</strong> for{" "}
          <strong>{booking?.property_name}</strong>
        </p>

        {serverError && (
          <p className="schedule-server-error">{serverError}</p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="schedule-form-group">
            <label>Meeting Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              min={new Date().toISOString().split("T")[0]}
            />
            {errors.date && <small className="schedule-error">{errors.date}</small>}
          </div>

          <div className="schedule-form-group">
            <label>Meeting Time</label>
            <input
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
            />
            {errors.time && <small className="schedule-error">{errors.time}</small>}
          </div>

          <div className="schedule-form-group">
            <label>Meeting Location</label>
            <input
              type="text"
              name="location"
              placeholder="Enter meeting location"
              value={formData.location}
              onChange={handleChange}
            />
            {errors.location && (
              <small className="schedule-error">{errors.location}</small>
            )}
          </div>

          <div className="schedule-form-group">
            <label>Additional Note <span className="schedule-optional">(optional)</span></label>
            <textarea
              name="note"
              placeholder="Add meeting instructions or extra details"
              value={formData.note}
              onChange={handleChange}
            />
          </div>

          <div className="schedule-actions">
            <button
              type="button"
              className="schedule-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="schedule-confirm-btn"
              disabled={submitting}
            >
              {submitting
                ? "Saving..."
                : booking?.meeting
                ? "Update Meeting"
                : "Save Meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleMeeting;
