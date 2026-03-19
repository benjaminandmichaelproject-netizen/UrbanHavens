import React, { useState } from "react";
import "./ScheduleMeeting.css";

const ScheduleMeeting = ({ booking, onClose }) => {
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    location: "",
    note: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setErrors((prev) => ({
      ...prev,
      [e.target.name]: "",
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.time) newErrors.time = "Time is required";
    if (!formData.location.trim()) newErrors.location = "Meeting location is required";

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    console.log("Meeting scheduled:", {
      booking,
      formData,
    });

    alert("Meeting scheduled successfully!");
    onClose();
  };

  return (
    <div className="schedule-overlay" onClick={onClose}>
      <div
        className="schedule-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="schedule-modal-header">
          <h2>Schedule Meeting</h2>
          <button className="schedule-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="schedule-subtext">
          Schedule a meeting with <strong>{booking?.tenant_name}</strong> for{" "}
          <strong>{booking?.property_name}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="schedule-form-group">
            <label>Meeting Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
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
            <label>Additional Note</label>
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
            >
              Cancel
            </button>

            <button type="submit" className="schedule-confirm-btn">
              Save Meeting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleMeeting;