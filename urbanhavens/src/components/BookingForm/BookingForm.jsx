import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Booking.css";
import {
  createBooking,
  createReport,
} from "../../Dashboard/Owner/UploadDetails/api/api";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarAlt,
  FaClock,
  FaPhoneAlt,
  FaUsers,
  FaHome,
  FaBed,
  FaExclamationTriangle,
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
  const [bookingError, setBookingError] = useState("");
  const [bookingRequestKey, setBookingRequestKey] = useState("");
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [statusPopupType, setStatusPopupType] = useState("success");
  const [statusPopupMessage, setStatusPopupMessage] = useState("");
  const [showReportBox, setShowReportBox] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");
  const accessToken =
    localStorage.getItem("access") || localStorage.getItem("token");
  const storedPhone = localStorage.getItem("phone") || "";

  const isLoggedIn = Boolean(accessToken);
  const isHostel = property?.category === "hostel";

  const totalAvailableSpaces = useMemo(() => {
    if (!isHostel) return null;

    if (
      property?.total_available !== undefined &&
      property?.total_available !== null
    ) {
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
    }, 3500);
  };

  const closeStatusPopup = () => {
    setShowStatusPopup(false);
  };

  const toggleReportBox = () => {
    setShowReportBox((prev) => !prev);
    setReportSuccess("");
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setReportSuccess("");

    if (!isLoggedIn) {
      openLoginPopup();
      return;
    }

    if (!reportReason.trim()) {
      setReportSuccess("Please select a reason.");
      return;
    }

    if (!reportDetails.trim()) {
      setReportSuccess("Please provide extra details.");
      return;
    }

    if (reportDetails.trim().length < 20) {
      setReportSuccess("Description must be at least 20 characters.");
      return;
    }

    try {
      const payload = {
        category: reportReason,
        subject: `Property report: ${property?.property_name || "Listing"}`,
        description: reportDetails.trim(),
        contact_email: localStorage.getItem("email") || "",
        reported_property: property?.id,
      };

      await createReport(payload);

      setReportReason("");
      setReportDetails("");
      setShowReportBox(false);
      setReportSuccess("");

      openStatusPopup("success", "Your report has been submitted successfully.");
    } catch (error) {
      console.error("Report submission failed:", error);

      const backendError =
        error?.response?.data?.detail ||
        error?.response?.data?.description?.[0] ||
        error?.response?.data?.category?.[0] ||
        error?.response?.data?.subject?.[0] ||
        error?.response?.data?.reported_property?.[0] ||
        error?.response?.data?.contact_email?.[0] ||
        "Failed to submit report. Please try again.";

      setReportSuccess(backendError);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setBookingError("");

    if (!isLoggedIn) {
      openLoginPopup();
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const requestKey = bookingRequestKey || crypto.randomUUID();
    setBookingRequestKey(requestKey);

    try {
      const payload = {
        property: property.id,
        phone: formData.phone,
        preferred_date: formData.preferred_date,
        preferred_time: formData.preferred_time,
        message: formData.message,
      };

      await createBooking(payload, requestKey);

      openStatusPopup(
        "success",
        isHostel
          ? "Your hostel viewing request has been sent successfully. Don’t pay before viewing the property physically."
          : "Your viewing request has been sent successfully. Don’t pay before viewing the property physically."
      );

      setFormData({
        phone: storedPhone || "",
        preferred_date: "",
        preferred_time: "",
        message: initialMessage,
      });
      setErrors({});
      setBookingRequestKey("");
    } catch (error) {
      console.error("Booking submission failed:", error);

      const backendError =
        error?.response?.data?.detail ||
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.property?.[0] ||
        error?.response?.data?.message ||
        "Failed to schedule viewing. Please try again.";

      openStatusPopup("error", backendError);
      setBookingError(backendError);
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
        <div className="booking-inline-safety">
          Please inspect the property first. Do not make any payment before viewing.
        </div>

          {showReportBox && (
          <div className="booking-report-box">
            <h4>Report Property</h4>
            <p>Tell us what seems wrong with this listing.</p>

            <div className="input-group">
              <label>Reason</label>
              <div className="custom-select-wrapper">
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="custom-select"
                >
                  <option value="">Select a reason</option>
                  <option value="fraudulent_listing">Fake listing</option>
                  <option value="misleading_info">Wrong information</option>
                  <option value="inappropriate_content">
                    Inappropriate content or photos
                  </option>
                  <option value="scam">Suspected scam or fraud</option>
                  <option value="wrong_price">Incorrect pricing</option>
                  <option value="already_rented">Property already rented</option>
                  <option value="harassment">Harassment or abuse</option>
                  <option value="other">Other</option>
                </select>

                <span className="custom-select-arrow">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 5L7 9L11 5"
                      stroke="#1a7a40"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>

            <div className="input-group">
              <label>Extra Details</label>
              <textarea
                placeholder="Write your complaint here..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
              />
            </div>

            {reportSuccess && (
              <p className="booking-report-feedback">{reportSuccess}</p>
            )}

            <div className="booking-report-actions">
              <button
                type="button"
                className="booking-report-cancel-btn"
                onClick={toggleReportBox}
              >
                Cancel
              </button>

              <button
                type="button"
                className="booking-report-submit-btn"
                onClick={handleReportSubmit}
              >
                Submit Report
              </button>
            </div>
          </div>
        )}
 <div className="booking-report-wrap">
              {!showReportBox && (
                <button
                  type="button"
                  className="booking-report-btn"
                  onClick={toggleReportBox}
                >
                  Report Property
                </button>
              )}
            </div>
     
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

            {bookingError && (
              <p className="booking-error-message">{bookingError}</p>
            )}



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
          className={`login-popup-overlay ${closingPopup ? "popup-overlay-close" : "popup-overlay-open"
            }`}
        >
          <div
            className={`login-popup ${closingPopup ? "popup-close" : "popup-open"
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