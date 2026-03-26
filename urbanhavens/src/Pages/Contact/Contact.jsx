import React from "react";
import {
  FaPhoneAlt,
  FaEnvelope,
  FaWhatsapp,
  FaMapMarkerAlt,
  FaHeadset,
  FaClock,
} from "react-icons/fa";
import "./Contact.css";
import Footer from "../../components/Footer/Footer";
const Contact = () => {
  return (
    <div className="contact-page">
      <section className="contact-hero">
        <div className="contact-hero-overlay"></div>

        <div className="contact-hero-content">
          <p className="contact-hero-tag">UrbanHavens Support</p>
          <h1>Contact Us</h1>
        </div>
      </section>

      <section className="contact-main">
        <div className="contact-intro">
          <span className="contact-badge">We’re here for you</span>
          <h2>Let’s help you find the right place faster</h2>
          <p>
            Whether you are searching for a hostel, a house for rent, or need
            help with a listing, our team is ready to assist you. Reach us
            directly through phone, WhatsApp, or email and get quick support
            from UrbanHavens.
          </p>
        </div>

        <div className="contact-grid">
          <div className="contact-card contact-card-primary">
            <div className="contact-card-icon">
              <FaWhatsapp />
            </div>

            <h3>Chat on WhatsApp</h3>

            <p>
              Need a quick response? Message us directly on WhatsApp for fast
              assistance.
            </p>

            <div className="contact-card-actions">
              <a
                href="https://wa.me/233550000000"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-action-btn whatsapp-btn"
              >
                <FaWhatsapp />
                Chat Now
              </a>

              <a
                href="https://wa.me/233550000000"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-link"
              >
                +233 55 000 0000
              </a>
            </div>
          </div>

          <div className="contact-card">
            <div className="contact-card-icon">
              <FaPhoneAlt />
            </div>

            <h3>Call Us</h3>

            <p>
              Speak with us directly for property enquiries, support, or general
              information.
            </p>

            <a href="tel:+233550000000" className="contact-link">
              +233 55 000 0000
            </a>
          </div>

          <div className="contact-card">
            <div className="contact-card-icon">
              <FaEnvelope />
            </div>

            <h3>Email Support</h3>

            <p>
              Send us your questions, partnership requests, or customer support
              concerns anytime.
            </p>

            <a href="mailto:support@urbanhavens.com" className="contact-link">
              support@urbanhavens.com
            </a>
          </div>

          <div className="contact-card">
            <div className="contact-card-icon">
              <FaMapMarkerAlt />
            </div>

            <h3>Our Location</h3>

            <p>
              UrbanHavens helps renters and property seekers across Ghana find
              verified homes with confidence.
            </p>

            <span className="contact-text">Accra, Ghana</span>
          </div>
        </div>
      </section>

      <section className="contact-extra">
        <div className="contact-extra-card">
          <div className="contact-extra-icon">
            <FaHeadset />
          </div>
          <div>
            <h4>Dedicated Support</h4>
            <p>
              We make property search easier, clearer, and more trustworthy for
              students, workers, and families.
            </p>
          </div>
        </div>

        <div className="contact-extra-card">
          <div className="contact-extra-icon">
            <FaClock />
          </div>
          <div>
            <h4>Available Hours</h4>
            <p>Monday to Saturday, 8:00 AM - 6:00 PM</p>
          </div>
        </div>
      </section>
      <Footer/>
    </div>
  );
};

export default Contact;