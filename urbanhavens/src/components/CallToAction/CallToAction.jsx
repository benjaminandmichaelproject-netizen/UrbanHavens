import React from "react";
import { Link } from "react-router-dom";
import './CallToAction.css'
const CallToAction = () => {
  return (
    <section className="cta-section">
      <div className="cta-container">

        <h2 className="cta-title">
          Ready to Find Your New Home?
        </h2>

        <p className="cta-subtitle">
          Join thousands of satisfied tenants and property owners who trust our platform
        </p>

        <div className="cta-buttons">
       <Link to="/registration">
  <button className="btn-primary">Get Started Today</button>
</Link>
          <button className="btn-secondary">Browse Listings</button>
        </div>

      </div>
    </section>
  );
};

export default CallToAction;