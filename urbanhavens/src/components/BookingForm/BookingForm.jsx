import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Booking.css";
import { createBooking } from "../../Dashboard/Owner/UploadDetails/api/api";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaClock,
  FaPhoneAlt,
  FaUsers,
  FaHome,
  FaBed,
} from "react-icons/fa";

const formatMoney = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : value;
};

const BookingForm = ({ property }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [closingPopup, setClosingPopup] = useState(false);

  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [statusPopupType, setStatusPopupType] = useState("success");
  const [statusPopupMessage, setStatusPopupMessage] = useState("");

  const accessToken =
    localStorage.getItem("access") || localStorage.getItem("token");
  const storedPhone = localStorage.getItem("phone") || "";

  const isLoggedIn = Boolean(accessToken);
  const isHostel = property?.category === "hostel";

  const totalAvailableSpaces = useMemo(() => {
    if (!isHostel) return null;

    if (property?.total_available !== undefined && property?.total_available !== null) {
      return Number(property.total_available);
    }

    if (Array.isArray(property?.rooms)) {
      return property.rooms.reduce(
        (sum, room) => sum + (Number(room?.available_spaces) || 0),
        0
      );
    }

    return null;
  }, [isHostel, property]);

  const availableRoomsCount = useMemo(() => {
    if (!isHostel || !Array.isArray(property?.rooms)) return null;
    return property.rooms.filter(
      (room) => room?.is_available && Number(room?.available_spaces) > 0
    ).length;
  }, [isHostel, property]);

  const initialMessage = useMemo(() => {
    if (!property?.property_name) return "";

    if (isHostel) {
      return `Hello, I would like to schedule a viewing for ${property.property_name}. I am interested in checking the available hostel room spaces.`;
    }

    return `Hello, I would like to schedule a viewing for ${property.property_name}.`;
  }, [property, isHostel]);

  const [formData, setFormData] = useState({
    phone: storedPhone,
    preferred_date: "",
    preferred_time: "",
    message: initialMessage,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      message: initialMessage,
      phone: prev.phone || storedPhone || "",
    }));
  }, [initialMessage, storedPhone]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    setErrors((prev) => ({
      ...prev,
      [e.target.name]: "",
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (formData.phone.replace(/\s+/g, "").length < 10) {
      newErrors.phone = "Enter a valid phone number";
    }

    if (!formData.preferred_date) {
      newErrors.preferred_date = "Viewing date is required";
    }

    if (!formData.preferred_time) {
      newErrors.preferred_time = "Viewing time is required";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    }

    return newErrors;
  };

  const openLoginPopup = () => {
    setClosingPopup(false);
    setShowLoginPopup(true);
  };

  const closeLoginPopup = () => {
    setClosingPopup(true);
    setTimeout(() => {
      setShowLoginPopup(false);
      setClosingPopup(false);
    }, 300);
  };

  const openStatusPopup = (type, message) => {
    setStatusPopupType(type);
    setStatusPopupMessage(message);
    setShowStatusPopup(true);

    setTimeout(() => {
      setShowStatusPopup(false);
    }, 3000);
  };

  const closeStatusPopup = () => {
    setShowStatusPopup(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoggedIn) {
      openLoginPopup();
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const payload = {
        property: property.id,
        phone: formData.phone,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
        message: formData.message,
      };

      await createBooking(payload);

      openStatusPopup(
        "success",
        isHostel
          ? "Your hostel viewing request has been sent successfully."
          : "Your viewing request has been sent successfully."
      );

      setFormData({
        phone: storedPhone || "",
        preferred_date: "",
        preferred_time: "",
        message: initialMessage,
      });
      setErrors({});
    } catch (error) {
      console.error("Booking submission failed:", error);
      openStatusPopup(
        "error",
        error?.detail ||
          error?.response?.data?.detail ||
          "Failed to schedule viewing. Please try again."
      );
    }
  };

  const handleLoginRedirect = () => {
    navigate("/login", {
      state: {
        message: "Please log in to schedule a viewing.",
        from: location.pathname,
      },
    });
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  return (
    <div className="bookingForm">
      <div className="headings">
        <h2>{isHostel ? "Schedule a Hostel Viewing" : "Schedule a Viewing"}</h2>
        <p>
          {isHostel
            ? "Choose your preferred date and time to inspect this hostel and its available room spaces."
            : "Choose your preferred date and time to inspect this property."}
        </p>

        {property && (
          <div className="booking-property-summary">
            <div className="booking-summary-item">
              <FaHome className="booking-summary-icon" />
              <div>
                <strong>{property.property_name}</strong>
                <span>
                  {property.category === "hostel" ? "Hostel" : "House Rent"}
                </span>
              </div>
            </div>

            <div className="booking-summary-item">
              <FaBed className="booking-summary-icon" />
              <div>
                <strong>GHS {formatMoney(property.price)}</strong>
                <span>Starting monthly rent</span>
              </div>
            </div>

            {isHostel && (
              <div className="booking-summary-item">
                <FaUsers className="booking-summary-icon" />
                <div>
                  <strong>
                    {totalAvailableSpaces ?? 0} space
                    {Number(totalAvailableSpaces) === 1 ? "" : "s"} left
                  </strong>
                  <span>
                    {availableRoomsCount ?? 0} room
                    {Number(availableRoomsCount) === 1 ? "" : "s"} available
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>
                <FaPhoneAlt className="booking-field-icon" />
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                placeholder="+233 55 123 4567"
                value={formData.phone}
                onChange={handleChange}
              />
              {errors.phone && <small className="error">{errors.phone}</small>}
            </div>

            <div className="booking-row">
              <div className="input-group">
                <label>
                  <FaCalendarAlt className="booking-field-icon" />
                  Viewing Date
                </label>
                <input
                  type="date"
                  name="preferred_date"
                  min={getTodayDate()}
                  value={formData.preferred_date}
                  onChange={handleChange}
                />
                {errors.preferred_date && (
                  <small className="error">{errors.preferred_date}</small>
                )}
              </div>

              <div className="input-group">
                <label>
                  <FaClock className="booking-field-icon" />
                  Viewing Time
                </label>
                <input
                  type="time"
                  name="preferred_time"
                  value={formData.preferred_time}
                  onChange={handleChange}
                />
                {errors.preferred_time && (
                  <small className="error">{errors.preferred_time}</small>
                )}
              </div>
            </div>

            <div className="input-group">
              <label>Note</label>
              <textarea
                name="message"
                placeholder={
                  isHostel
                    ? "Add any note about the hostel room spaces you want to inspect"
                    : "Add any extra note for the landlord"
                }
                value={formData.message}
                onChange={handleChange}
              />
              {errors.message && (
                <small className="error">{errors.message}</small>
              )}
            </div>

            <div className="input-group">
              <button type="submit">
                {isHostel ? "Schedule Hostel Viewing" : "Schedule Viewing"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showLoginPopup && (
        <div
          className={`login-popup-overlay ${
            closingPopup ? "popup-overlay-close" : "popup-overlay-open"
          }`}
        >
          <div
            className={`login-popup ${
              closingPopup ? "popup-close" : "popup-open"
            }`}
          >
            <h3 className="log">Login Required</h3>
            <p>
              You need to log in or create an account before scheduling a
              property viewing.
            </p>

            <div className="login-popup-actions">
              <button className="popup-cancel-btn" onClick={closeLoginPopup}>
                Cancel
              </button>

              <button
                className="popup-login-btn"
                onClick={handleLoginRedirect}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusPopup && (
        <div className="status-popup-overlay" onClick={closeStatusPopup}>
          <div
            className={`status-popup ${statusPopupType}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="status-popup-icon">
              {statusPopupType === "success" ? (
                <FaCheckCircle />
              ) : (
                <FaTimesCircle />
              )}
            </div>

            <div className="status-popup-content">
              <h3>
                {statusPopupType === "success"
                  ? "Success"
                  : "Something went wrong"}
              </h3>
              <p>{statusPopupMessage}</p>
            </div>

            <button className="status-popup-close" onClick={closeStatusPopup}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingForm;