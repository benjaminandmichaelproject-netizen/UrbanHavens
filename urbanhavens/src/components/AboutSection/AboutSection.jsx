import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import "./AboutSection.css";

// ── Animated counter ──────────────────────────────────────────────────────────
const Counter = ({ target, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const increment = target / (1600 / 16);
    const tick = () => {
      start += increment;
      if (start < target) { setCount(Math.ceil(start)); requestAnimationFrame(tick); }
      else { setCount(target); }
    };
    tick();
  }, [inView, target]);

  return <span ref={ref} className="ab-counter">{count.toLocaleString()}{suffix}</span>;
};

// ── Variants ──────────────────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } } };
const fadeLeft = { hidden: { opacity: 0, x: -40 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } } };
const fadeRight = { hidden: { opacity: 0, x: 40 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.15 } } };
const statVar = { hidden: { opacity: 0, y: 24, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } } };

// ── Component ─────────────────────────────────────────────────────────────────
const AboutSection = () => (
  <section className="ab">

    {/* dot texture */}
    <div className="ab-texture" />

    {/* ── Header ──────────────────────────────────────────── */}
    <motion.div
      className="ab-header"
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      <motion.p className="ab-eyebrow" variants={fadeUp}>WHO WE ARE</motion.p>
      <motion.h1 className="ab-title" variants={fadeUp}>
        About <span className="ab-accent">UrbanHavens</span>
      </motion.h1>
      <motion.p className="ab-desc" variants={fadeUp}>
        UrbanHavens is a modern digital housing platform built to make finding
        and listing rental properties simple, transparent, and secure. We
        connect tenants directly with verified landlords across Accra and
        Kumasi — cutting out the middleman and reducing the risk of fraud for
        students, families, and professionals.
      </motion.p>
    </motion.div>

    {/* ── Vision & Mission ────────────────────────────────── */}
    <div className="ab-cards">

      <motion.div
        className="ab-card"
        variants={fadeLeft}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        whileHover={{ y: -6, transition: { duration: 0.22 } }}
      >
        <div className="ab-card-top">
          <span className="ab-card-icon">◎</span>
          <span className="ab-card-tag">Vision</span>
        </div>
        <h4 className="ab-card-title">Vision Statement</h4>
        <p>
          To become Ghana's most trusted and innovative digital housing
          marketplace — where tenants find safe, affordable homes and landlords
          connect with reliable renters through a transparent, secure platform.
        </p>
      </motion.div>

      <motion.div
        className="ab-card"
        variants={fadeRight}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        whileHover={{ y: -6, transition: { duration: 0.22 } }}
      >
        <div className="ab-card-top">
          <span className="ab-card-icon">◈</span>
          <span className="ab-card-tag">Mission</span>
        </div>
        <h4 className="ab-card-title">Mission Statement</h4>
        <p>
          To simplify the rental process by providing a secure, user-friendly
          platform that connects tenants and landlords, promotes verified
          listings, reduces rental fraud, and improves access to housing
          through technology.
        </p>
      </motion.div>

    </div>

    {/* ── Stats strip ─────────────────────────────────────── */}
    <motion.div
      className="ab-stats"
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {[
        { target: 1200, suffix: "+", label: "Verified Landlords" },
        { target: 5000, suffix: "+", label: "Active Listings" },
        { target: 8000, suffix: "+", label: "Tenants Connected" },
        { target: 95, suffix: "%", label: "User Satisfaction Rate" },
      ].map((s, i) => (
        <motion.div className="ab-stat" key={i} variants={statVar}>
          <Counter target={s.target} suffix={s.suffix} />
          <p>{s.label}</p>
        </motion.div>
      ))}
    </motion.div>

  </section>
);

export default AboutSection;
