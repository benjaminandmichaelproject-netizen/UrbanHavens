import { useEffect, useState } from "react";
import "./Hero.css";

import city1 from "../../assets/images/city.jpg";
import city2 from "../../assets/images/city2.jpg";
// import city3 from "../../assets/images/city3.jpg";

const images = [city1, city2];

const Hero = () => {
  const [current, setCurrent] = useState(0);

  // Auto Slide
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % images.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="hero">

      {images.map((img, index) => (
        <img
          key={index}
          src={img}
          alt="Modern City"
          className={`hero-img ${index === current ? "active" : ""}`}
        />
      ))}

      <div className="hero-overlay"></div>

      <div className="hero-content">
        <h1>MODERN HOME FOR SALE</h1>
        <p>Discover premium properties designed for modern living.</p>
        <h3>Find Your Dream Home Today</h3>
        <button className="hero-btn">Explore Properties</button>
      </div>

    </section>
  );
};

export default Hero;