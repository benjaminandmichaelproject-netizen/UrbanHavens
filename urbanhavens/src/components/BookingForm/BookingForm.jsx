import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Booking.css";
import { createBooking } from "../../Dashboard/Owner/UploadDetails/api/api";
import { FaPhoneAlt } from "react-icons/fa";
const BookingForm = ({ property }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [closingPopup, setClosingPopup] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [errors, setErrors] = useState({});

  const token = localStorage.getItem("token");

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

  // 🔥 VALIDATION
  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Enter a valid email";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (formData.phone.length < 10) {
      newErrors.phone = "Enter a valid phone number";
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

  const handleSubmit = async (e) => {
  e.preventDefault();

  const validationErrors = validate();
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }

  if (!token) {
    openLoginPopup();
    return;
  }

  try {
    const payload = {
      property: property.id,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      message: formData.message,
    };

    await createBooking(payload);

    alert("Your booking request has been sent successfully.");

    setFormData({
      name: "",
      email: "",
      phone: "",
      message: "",
    });
  } catch (error) {
    console.error("Booking submission failed:", error);
    alert("Failed to send booking request.");
  }
};
  const handleLoginRedirect = () => {
    navigate("/login", {
      state: {
        message: "Please log in to continue with your booking.",
        from: location.pathname,
      },
    });
  };

  const landlordPhone = property?.owner_phone || property?.phone;

  return (
    <div className="bookingForm">
      <div className="headings">
        <h2>Interested in this property?</h2>
        <p>Get in touch with the landlord</p>

        <div className="form-container">
          <form onSubmit={handleSubmit}>
            {/* NAME */}
            <div className="input-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                placeholder="Benjamin"
                value={formData.name}
                onChange={handleChange}
              />
              {errors.name && <small className="error">{errors.name}</small>}
            </div>

            {/* EMAIL */}
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="benjamin@gmail.com"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && <small className="error">{errors.email}</small>}
            </div>

            {/* PHONE */}
            <div className="input-group">
              <label>Phone Number</label>
              <input
                type="text"
                name="phone"
                placeholder="+233 55 123 4567"
                value={formData.phone}
                onChange={handleChange}
              />
              {errors.phone && <small className="error">{errors.phone}</small>}
            </div>

            {/* MESSAGE */}
            <div className="input-group">
              <label>Message</label>
              <textarea
                name="message"
                placeholder={
                  property?.property_name
                    ? `Hello, I am interested in ${property.property_name}.`
                    : "Enter your message here"
                }
                value={formData.message}
                onChange={handleChange}
              />
              {errors.message && (
                <small className="error">{errors.message}</small>
              )}
            </div>

            <div className="input-group">
              <button type="submit">Book Now</button>
            </div>
          </form>
        </div>

      {/* 📞 LANDLORD CONTACT */}
{landlordPhone && (
  <div className="landlord-contact">
    <p>Or call landlord directly:</p>

    <a href={`tel:${landlordPhone}`} className="call-btn">
      <FaPhoneAlt className="call-icon" />
      {landlordPhone}
    </a>
  </div>
)}
      </div>

      {/* LOGIN POPUP */}
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
            <h3>Login Required</h3>
            <p>
              You need to log in or create an account before booking this
              property.
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
    </div>
  );
};

export default BookingForm;