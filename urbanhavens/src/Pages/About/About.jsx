import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faShieldAlt, faBolt, faBullseye } from "@fortawesome/free-solid-svg-icons";
import "./About.css";
import Footer from "../../components/Footer/Footer";
// ── Animated counter ──────────────────────────────────────────────────────────
const Counter = ({ target, suffix = "", prefix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const animated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !animated.current) {
        animated.current = true;
        let start = 0;
        const inc = target / (1500 / 16);
        const tick = () => {
          start += inc;
          if (start < target) { setCount(Math.ceil(start)); requestAnimationFrame(tick); }
          else setCount(target);
        };
        tick();
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref} className="ab2-counter">{prefix}{count.toLocaleString()}{suffix}</span>;
};

// ── Variants ──────────────────────────────────────────────────────────────────
const fadeUp    = { hidden: { opacity: 0, y: 40 },  show: { opacity: 1, y: 0,  transition: { duration: 0.6, ease: "easeOut" } } };
const fadeLeft  = { hidden: { opacity: 0, x: -50 }, show: { opacity: 1, x: 0,  transition: { duration: 0.65, ease: "easeOut" } } };
const fadeRight = { hidden: { opacity: 0, x: 50 },  show: { opacity: 1, x: 0,  transition: { duration: 0.65, ease: "easeOut" } } };
const stagger   = { hidden: {}, show: { transition: { staggerChildren: 0.14 } } };
const cardAnim  = { hidden: { opacity: 0, y: 32, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } } };

const values = [
  { icon: faHeart,     color: "#e63560", bg: "rgba(230,53,96,0.12)",   title: "Customer First",  desc: "Every decision we make is centered around providing exceptional customer experience." },
  { icon: faShieldAlt, color: "#2d8ef5", bg: "rgba(45,142,245,0.12)",  title: "Trust & Safety",  desc: "Your safety and security are our top priorities with comprehensive verification." },
  { icon: faBolt,      color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  title: "Innovation",      desc: "Constantly evolving with cutting-edge technology to enhance your rental experience." },
  { icon: faBullseye,  color: "#2dde72", bg: "rgba(45,222,114,0.12)",  title: "Excellence",      desc: "Striving for excellence in every aspect of our service and platform maintenance." },
];

const miniStats = [
  { label: "Verified", sub: "Landlord Listings" },
  { label: "24/7",     sub: "Platform Access"   },
  { label: "Secure",   sub: "User Verification" },
  { label: "Fraud",    sub: "Prevention System" },
];

// ── Component ─────────────────────────────────────────────────────────────────
const About = () => (
  <div className="ab2-wrapper">

    {/* ══ 1. HERO ═══════════════════════════════════════════════════════ */}
    <section className="ab2-hero">
      <div className="ab2-hero-overlay" />
      <div className="ab2-texture" />

      <div className="ab2-hero-inner">

        {/* Left */}
        <motion.div
          className="ab2-hero-left"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.span className="ab2-eyebrow" variants={fadeUp}>WHO WE ARE</motion.span>
          <motion.h1 className="ab2-hero-title" variants={fadeUp}>
            About <span className="ab2-accent">UrbanHavens</span>
          </motion.h1>
          <motion.p className="ab2-hero-desc" variants={fadeUp}>
            A modern digital housing platform designed to make finding and listing
            rental properties simple, transparent, and secure across Ghana.
          </motion.p>
        </motion.div>

        {/* Right — stats card */}
        <motion.div
          className="ab2-stats-card"
          initial={{ opacity: 0, x: 60, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
        >
          <div className="ab2-stats-grid">
            {[
              { target: 1200, suffix: "+", label: "Verified Landlords"  },
              { target: 5000, suffix: "+", label: "Active Listings"     },
              { target: 8000, suffix: "+", label: "Tenants Connected"   },
              { target: 95,   suffix: "%", label: "Satisfaction Rate"   },
            ].map((s, i) => (
              <div className="ab2-stat-item" key={i}>
                <Counter target={s.target} suffix={s.suffix} />
                <p>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="ab2-stats-footer">
            <p><strong>Customer-first platform</strong></p>
            <p>Verified rentals and secure connections across Accra & Kumasi.</p>
          </div>
        </motion.div>

      </div>
    </section>

    {/* ══ 2. STORY ══════════════════════════════════════════════════════ */}
    <section className="ab2-story">
      <div className="ab2-story-texture" />

      {/* Header */}
      <motion.div
        className="ab2-section-header"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        <motion.span className="ab2-eyebrow" variants={fadeUp}>COMPANY JOURNEY</motion.span>
        <motion.h2 className="ab2-section-title" variants={fadeUp}>
          Our <span className="ab2-accent">Story</span>
        </motion.h2>
        <motion.p className="ab2-section-sub" variants={fadeUp}>
          From a simple idea to a revolutionary housing platform changing how people find homes.
        </motion.p>
      </motion.div>

      <div className="ab2-story-body">

        {/* Text side */}
        <motion.div
          className="ab2-story-text"
          variants={fadeLeft}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <h3 className="ab2-story-h3">Built in Ghana for Seamless Housing</h3>
          <p>
            UrbanHavens was born with a commitment to make housing accessible,
            transparent, and hassle-free for everyone. Today we coordinate
            verified listings and secure connections between landlords and tenants.
          </p>
          <p>
            Every listing on our platform is vetted to ensure safety and
            reliability — keeping users informed while we keep the housing
            journey secure across Ghana.
          </p>

          <motion.div
            className="ab2-mini-stats"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {miniStats.map((m, i) => (
              <motion.div className="ab2-mini-stat" key={i} variants={cardAnim}>
                <h4>{m.label}</h4>
                <p>{m.sub}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Visual side */}
        <motion.div
          className="ab2-story-visual"
          variants={fadeRight}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <div className="ab2-video-box">
            <div className="ab2-play-btn">▶</div>
            <div className="ab2-floating-badge">
              <Counter target={15} suffix="+" />
              <p>Years of Excellence</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>

    {/* ══ 3. VALUES ═════════════════════════════════════════════════════ */}
    <section className="ab2-values">
      <div className="ab2-values-texture" />

      <motion.div
        className="ab2-section-header"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        <motion.span className="ab2-eyebrow ab2-eyebrow-dark" variants={fadeUp}>GUIDING PRINCIPLES</motion.span>
        <motion.h2 className="ab2-section-title" variants={fadeUp}>
          Our <span className="ab2-accent">Values</span>
        </motion.h2>
        <motion.p className="ab2-section-sub ab2-sub-dark" variants={fadeUp}>
          The principles that guide everything we do and every decision we make.
        </motion.p>
      </motion.div>

      <motion.div
        className="ab2-values-grid"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
      >
        {values.map((v, i) => (
          <motion.div
            key={i}
            className="ab2-value-card"
            variants={cardAnim}
            whileHover={{ y: -6, transition: { duration: 0.22 } }}
          >
            <div className="ab2-value-icon" style={{ background: v.bg, color: v.color }}>
              <FontAwesomeIcon icon={v.icon} />
            </div>
            <h4 className="ab2-value-title">{v.title}</h4>
            <p className="ab2-value-desc">{v.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  <Footer />
  </div>

);

export default About;