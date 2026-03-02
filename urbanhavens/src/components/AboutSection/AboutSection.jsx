import { useEffect, useRef, useState } from "react";
import "./AboutSection.css";

const Counter = ({ target, suffix }) => {
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
    <p ref={ref} className="counter">
      {count}{suffix}
    </p>
  );
};

const AboutSection = () => {
  return (
    <section className="about-container">

      <div className="about">
        <h3>WHO WE ARE</h3>
        <h2>About Us</h2>
        <p>
          Welcome to UrbanHavens — your reliable partner for rentals,
          flights, and stays crafted for business, leisure, and family travel.
        </p>
      </div>

      <div className="statements">
        <div className="col">
          <h3>Our Vision</h3>
          <p>
            To become a trusted and innovative digital platform that simplifies
            property rental and accommodation search.
          </p>
        </div>

        <div className="col">
          <h3>Our Mission</h3>
          <p>
            To provide a seamless and transparent platform connecting tenants
            and landlords efficiently.
          </p>
        </div>
      </div>

      <div className="readmore-counter">
        <div className="readmore">
          <button>Read More</button>
        </div>

       <div className="counter-container">
        <div className="count">
          <Counter target={20} suffix="+" />
          <p>Properties</p>
        </div>

        <div className="count">
          <Counter target={150} suffix="+" />
          <p>Tenants</p>
        </div>
      </div> 
</div>
    </section>
  );
};

export default AboutSection;