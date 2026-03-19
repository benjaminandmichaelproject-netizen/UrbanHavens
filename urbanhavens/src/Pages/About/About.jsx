import React, { useEffect, useRef, useState } from 'react';
import "./About.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faHeart, 
  faShieldAlt, 
  faBolt, 
  faBullseye 
} from "@fortawesome/free-solid-svg-icons";
const Counter = ({ target, prefix = "", suffix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          let start = 0;
          const duration = 1500;
          const increment = target / (duration / 16);
          const update = () => {
            start += increment;
            if (start < target) {
              setCount(Math.ceil(start));
              requestAnimationFrame(update);
            } else {
              setCount(target);
            }
          };
          update();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <h3 ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </h3>
  );
};

const About = () => {
  return (
    <div className="about-wrapper">
      <section className="hero-banner1">
        <div className="hero-overlay1">
          <div className="about-hero-container">
            <div className="hero-left">
              <span className="small-title">WHO WE ARE</span>
              <h1>About <span>Us</span></h1>
              <p>
                UrbanHavens is a modern digital housing platform designed to make
                finding and listing rental properties simple, transparent, and secure.
              </p>
            </div>

            <div className="hero-right">
              <div className="stats-card">
                <div className="stats-grid">
                  <div className="stat-item">
                    <Counter target={1200} suffix="+" />
                    <p>Verified Landlords</p>
                  </div>
                  <div className="stat-item">
                    <Counter target={5000} suffix="+" />
                    <p>Active Listings</p>
                  </div>
                  <div className="stat-item">
                    <Counter target={8000} suffix="+" />
                    <p>Tenants Connected</p>
                  </div>
                  <div className="stat-item">
                    <Counter target={95} suffix="%" />
                    <p>Satisfaction Rate</p>
                  </div>
                </div>
                <div className="stats-footer">
                  <p><strong>Customer-first since 2009</strong></p>
                  <p>Dedicated travel desk delivering rentals, flights, and stays nationwide.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="story-section">
        <div className="story-header">
          <span className="small-title centered">COMPANY JOURNEY</span>
          <h2>Our <span>Story</span></h2>
          <p className="story-subtitle">
            From a simple idea to a revolutionary housing platform that's changing how people find homes.
          </p>
        </div>

        <div className="story-content-container">
          <div className="story-text-side">
            <h3>Built in Ghana for Seamless Housing</h3>
            <p>
              UrbanHavens was born with a commitment to make housing accessible,
              transparent, and hassle-free for everyone. Today we coordinate 
              verified listings and secure connections between landlords and tenants.
            </p>
            <p>
              Every listing on our platform is vetted to ensure safety and 
              reliability, keeping our users informed while we keep the housing 
              journey secure across Ghana.
            </p>
<div className="story-mini-stats">
  <div className="mini-stat">
    <h4>Verified</h4>
    <p>Landlord Listings</p>
  </div>

  <div className="mini-stat">
    <h4>24/7</h4>
    <p>Platform Access</p>
  </div>

  <div className="mini-stat">
    <h4>Secure</h4>
    <p>User Verification</p>
  </div>

  <div className="mini-stat">
    <h4>Fraud</h4>
    <p>Prevention System</p>
  </div>
</div>
          </div>

          <div className="story-visual-side">
            <div className="video-placeholder">
              <div className="play-button">▶</div>
              <div className="floating-years-card">
                <Counter target={15} suffix="+" />
                <p>Years of Excellence</p>
              </div>
            </div>
            
          </div>
        </div>
      </section>
{/* 3. GUIDING PRINCIPLES SECTION */}
<section className="values-section">
  <div className="values-header">
    <span className="small-title centered">GUIDING PRINCIPLES</span>
    <h2>Our <span>Values</span></h2>
    <p className="values-subtitle">
      The principles that guide everything we do and every decision we make.
    </p>
  </div>

  <div className="values-grid">
    {/* Value 1: Customer First */}
    <div className="value-card">
      <div className="value-icon heart">
        <FontAwesomeIcon icon={faHeart} />
      </div>
      <h4>Customer First</h4>
      <p>
        Every decision we make is centered around providing exceptional customer experience.
      </p>
    </div>

    {/* Value 2: Trust & Safety */}
    <div className="value-card">
      <div className="value-icon shield">
        <FontAwesomeIcon icon={faShieldAlt} />
      </div>
      <h4>Trust & Safety</h4>
      <p>
        Your safety and security are our top priorities with comprehensive insurance coverage.
      </p>
    </div>

    {/* Value 3: Innovation */}
    <div className="value-card">
      <div className="value-icon lightning">
        <FontAwesomeIcon icon={faBolt} />
      </div>
      <h4>Innovation</h4>
      <p>
        Constantly evolving with cutting-edge technology to enhance your rental experience.
      </p>
    </div>

    {/* Value 4: Excellence */}
    <div className="value-card">
      <div className="value-icon target">
        <FontAwesomeIcon icon={faBullseye} />
      </div>
      <h4>Excellence</h4>
      <p>
        Striving for excellence in every aspect of our service and vehicle maintenance.
      </p>
    </div>
  </div>
</section>

    </div>
  );
};

export default About;