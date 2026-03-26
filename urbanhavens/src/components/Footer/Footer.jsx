import React from "react";
import { Link } from "react-router-dom";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaArrowUp,
} from "react-icons/fa";
import "./Footer.css";

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <footer className="uh-footer">
      <div className="uh-footer-container">
        <div className="uh-footer-top">
          <div className="uh-footer-brand">
            <div className="uh-footer-logo-wrap">
              <div className="uh-footer-logo">UH</div>
              <div>
                <h2 className="uh-footer-title">UrbanHavens</h2>
                <p className="uh-footer-tag">Find trusted homes with ease</p>
              </div>
            </div>

            <p className="uh-footer-description">
              UrbanHavens helps tenants discover verified hostels, apartments,
              and rental homes across Ghana with confidence, transparency, and
              convenience.
            </p>

            <div className="uh-footer-contact">
              <div className="uh-footer-contact-item">
                <FaMapMarkerAlt className="uh-footer-icon" />
                <span>Accra, Ghana</span>
              </div>

              <div className="uh-footer-contact-item">
                <FaPhoneAlt className="uh-footer-icon" />
                <span>+233 55 000 0000</span>
              </div>

              <div className="uh-footer-contact-item">
                <FaEnvelope className="uh-footer-icon" />
                <span>support@urbanhavens.com</span>
              </div>
            </div>

            <div className="uh-footer-socials">
              <a href="/" className="uh-social-link" aria-label="Facebook">
                <FaFacebookF />
              </a>
              <a href="/" className="uh-social-link" aria-label="Instagram">
                <FaInstagram />
              </a>
              <a href="/" className="uh-social-link" aria-label="LinkedIn">
                <FaLinkedinIn />
              </a>
            </div>
          </div>

          <div className="uh-footer-links-grid">
            <div className="uh-footer-column">
              <h3>Explore</h3>
              <Link to="/">Home</Link>
              <Link to="/hostel">Hostels</Link>
              <Link to="/houseforrent">Houses</Link>
              <Link to="/propertylisting">All Properties</Link>
            </div>

            <div className="uh-footer-column">
              <h3>Company</h3>
              <Link to="/about">About Us</Link>
              <Link to="/contact">Contact</Link>
              <Link to="/register">List Property</Link>
              <Link to="/login">Login</Link>
            </div>

            <div className="uh-footer-column">
              <h3>Support</h3>
              <Link to="/faq">FAQ</Link>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/help">Help Center</Link>
            </div>
          </div>
        </div>

        <div className="uh-footer-divider"></div>

        <div className="uh-footer-bottom">
          <p>© 2026 UrbanHavens. All rights reserved.</p>

          <div className="uh-footer-bottom-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/contact">Support</Link>
          </div>
        </div>
      </div>

      <button
        className="uh-scroll-top"
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        <FaArrowUp />
      </button>
    </footer>
  );
};

export default Footer;