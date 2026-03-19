import { useEffect, useRef, useState } from "react";
import "./AboutSection.css";

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
    <h2 ref={ref} className="counter">
      {prefix}{count}{suffix}
    </h2>
  );
};
const AboutSection = () => {
  return (
    <section className="about-section">

      {/* ABOUT HEADER */}
      <div className="about-header">
        <span className="subtitle">WHO WE ARE</span>
        <h1>About <span>UrbanHavens</span></h1>

        <p>
          UrbanHavens is a modern digital housing platform designed to make
          finding and listing rental properties simple, transparent, and
          secure. We connect tenants directly with verified landlords,
          eliminating unnecessary middlemen and reducing the risk of fraud.
          
          Our platform helps students, families, and professionals easily
          discover available houses, apartments, and hostels while giving
          landlords a trusted space to showcase their properties and reach
          genuine tenants.
        </p>
      </div>

      {/* VISION & MISSION */}
      <div className="about-cards">

        <div className="about-card">
          <h4>VISION STATEMENT</h4>
          <p>
            To become Ghana’s most trusted and innovative digital housing
            marketplace, where tenants can easily find safe and affordable
            homes while landlords connect directly with reliable renters
            through a transparent and secure platform.
          </p>
        </div>

        <div className="about-card">
          <h4>MISSION STATEMENT</h4>
          <p>
            Our mission is to simplify the rental process by providing a
            secure, user-friendly platform that connects tenants and landlords,
            promotes verified listings, reduces rental fraud, and improves
            access to housing through technology.
          </p>
        </div>

      </div>

      {/* STATS */}
      <div className="stats-section">

        <div className="stats-container">

          <div className="stat">
            <Counter target={1200} suffix="+" />
            <p>Verified Landlords</p>
          </div>

          <div className="stat">
            <Counter target={5000} suffix="+" />
            <p>Active Property Listings</p>
          </div>

          <div className="stat">
            <Counter target={8000} suffix="+" />
            <p>Tenants Connected</p>
          </div>

          <div className="stat">
            <Counter target={95} suffix="%" />
            <p>User Satisfaction Rate</p>
          </div>

        </div>

      </div>

    </section>
  );
};

export default AboutSection;