import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import "./Hero.css";
import city1 from "../../assets/images/city.jpg";
import city2 from "../../assets/images/city2.jpg";

const images = [city1, city2];

const features = [
  { icon: "🏠", title: "Verified Listings",  sub: "Admin approved only"     },
  { icon: "📍", title: "Accra & Kumasi",     sub: "Greater Accra · Ashanti" },
  { icon: "⚡", title: "Instant Booking",    sub: "Request in seconds"      },
  { icon: "🔑", title: "Hostel & Houses",    sub: "All property types"      },
];

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const titleLine = {
  hidden: { opacity: 0, x: -40 },
  show:   { opacity: 1, x: 0,   transition: { duration: 0.55, ease: "easeOut" } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1,
             transition: { duration: 0.45, ease: "easeOut" } },
};

const imageCard = {
  hidden: { opacity: 0, x: 60, scale: 0.95 },
  show:   { opacity: 1, x: 0,  scale: 1,
             transition: { duration: 0.7, ease: "easeOut", delay: 0.3 } },
};

// ── Component ─────────────────────────────────────────────────────────────────

const Hero = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCurrent(p => (p + 1) % images.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="h3">
      <div className="h3-bg-texture" />

      <div className="h3-layout">

        {/* ── LEFT ──────────────────────────────────────────── */}
        <motion.div
          className="h3-left"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {/* Headline — each line slides in from left */}
          <motion.h1 className="h3-title"           variants={titleLine}>Find Your</motion.h1>
          <motion.h1 className="h3-title h3-accent"  variants={titleLine}>Dream Home</motion.h1>
          <motion.h1 className="h3-title"           variants={titleLine}>In Ghana</motion.h1>

          {/* Tagline fades up */}
          <motion.div className="h3-tagline-row" variants={fadeUp}>
            <span className="h3-line" />
            <p>AFFORDABLE RENTALS AT YOUR FINGERTIPS</p>
            <span className="h3-line" />
          </motion.div>

          {/* Feature cards — staggered pop-in */}
          <motion.div
            className="h3-grid"
            variants={staggerContainer}
          >
            {features.map((f, i) => (
              <motion.div
                className="h3-feat"
                key={i}
                variants={cardVariant}
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
              >
                <span className="h3-feat-icon">{f.icon}</span>
                <strong className="h3-feat-title">{f.title}</strong>
                <span className="h3-feat-sub">{f.sub}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── RIGHT — image slider slides in from right ─────── */}
        <motion.div
          className="h3-right"
          variants={imageCard}
          initial="hidden"
          animate="show"
        >
          {images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt="Featured property"
              className={`h3-propimg ${i === current ? "active" : ""}`}
            />
          ))}
          <div className="h3-img-fade" />

          {/* Badge fades in with a slight delay */}
          <motion.div
            className="h3-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.4, ease: "easeOut" }}
          >
            <strong>500+</strong>
            <span>Properties</span>
          </motion.div>

          <div className="h3-dots">
            {images.map((_, i) => (
              <button
                key={i}
                className={`h3-dot ${i === current ? "active" : ""}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default Hero;
