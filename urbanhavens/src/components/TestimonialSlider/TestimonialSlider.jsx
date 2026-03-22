import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./TestimonialSlider.css";

const testimonials = [
  {
    name:   "Abena Mensah",
    role:   "Student, University of Ghana",
    avatar: "AM",
    stars:  5,
    text:   "UrbanHavens made finding a hostel near campus so easy. I found a verified room in less than a week and the whole process was transparent.",
  },
  {
    name:   "Kwame Osei",
    role:   "Property Owner, Kumasi",
    avatar: "KO",
    stars:  5,
    text:   "As a landlord, this platform has helped me reach genuine tenants quickly. The lease management tools save me so much time every month.",
  },
  {
    name:   "Ama Darko",
    role:   "Working Professional, Accra",
    avatar: "AD",
    stars:  5,
    text:   "I relocated to Accra for work and UrbanHavens helped me find a great apartment in East Legon. The owner contact feature is really useful.",
  },
];

const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center:        { opacity: 1, x: 0, transition: { duration: 0.45, ease: "easeOut" } },
  exit:  (dir) => ({ opacity: 0, x: dir > 0 ? -60 : 60, transition: { duration: 0.3 } }),
};

const TestimonialSlider = () => {
  const [index, setIndex]     = useState(0);
  const [direction, setDir]   = useState(1);

  const go = (newIndex) => {
    setDir(newIndex > index ? 1 : -1);
    setIndex((newIndex + testimonials.length) % testimonials.length);
  };

  const t = testimonials[index];

  return (
    <section className="ts-section">
      <div className="ts-texture" />

      {/* Header */}
      <motion.div
        className="ts-header"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55 }}
      >
        <span className="ts-eyebrow">TESTIMONIALS</span>
        <h2 className="ts-title">
          What Our <span className="ts-accent">Users Say</span>
        </h2>
      </motion.div>

      {/* Card */}
      <div className="ts-card-wrap">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={index}
            className="ts-card"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {/* Quote mark */}
            <span className="ts-quote">"</span>

            {/* Stars */}
            <div className="ts-stars">
              {"★".repeat(t.stars)}{"☆".repeat(5 - t.stars)}
            </div>

            <p className="ts-text">{t.text}</p>

            {/* User */}
            <div className="ts-user">
              <div className="ts-avatar">{t.avatar}</div>
              <div>
                <p className="ts-name">{t.name}</p>
                <p className="ts-role">{t.role}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Prev / Next arrows */}
        <button className="ts-arrow ts-prev" onClick={() => go(index - 1)}>‹</button>
        <button className="ts-arrow ts-next" onClick={() => go(index + 1)}>›</button>
      </div>

      {/* Dots */}
      <div className="ts-dots">
        {testimonials.map((_, i) => (
          <button
            key={i}
            className={`ts-dot ${i === index ? "active" : ""}`}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </section>
  );
};

export default TestimonialSlider;