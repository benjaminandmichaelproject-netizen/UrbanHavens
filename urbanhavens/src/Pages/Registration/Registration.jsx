import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaHome, FaBuilding, FaCheckCircle, FaArrowRight } from "react-icons/fa";
import "./Registration.css";

const fadeUp  = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };

const TYPES = [
  {
    key: "tenant",
    icon: <FaHome />,
    title: "I'm a Tenant",
    sub: "Looking to rent a property",
    features: [
      "Browse verified listings",
      "Book inspection meetings",
      "Sign digital leases",
      "24/7 support access",
    ],
  },
  {
    key: "landlord",
    icon: <FaBuilding />,
    title: "I'm a Property Owner",
    sub: "I own and manage properties",
    features: [
      "List unlimited properties",
      "Manage tenant bookings",
      "Track lease agreements",
      "Access owner dashboard",
    ],
  },
];

const Registration = () => {
  const [selected, setSelected] = useState("");
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!selected) return;
    navigate("/register-form", { state: { accountType: selected } });
  };

  return (
    <div className="rg-page">

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="rg-hero">
        <div className="rg-hero-texture" />
        <div className="rg-hero-glow" />

        <motion.div
          className="rg-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.span className="rg-eyebrow" variants={fadeUp}>JOIN URBANHAVENS</motion.span>
          <motion.h1 className="rg-hero-title" variants={fadeUp}>
            Create Your <span className="rg-accent">Account</span>
          </motion.h1>
          <motion.p className="rg-hero-sub" variants={fadeUp}>
            Choose the role that best describes you and start your journey
            with Ghana's most trusted rental platform.
          </motion.p>
        </motion.div>
      </section>

      {/* ── Account type selection ───────────────────────────── */}
      <div className="rg-body">

        <motion.div
          className="rg-section-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="rg-section-title">Choose Your <span className="rg-accent-dark">Account Type</span></h2>
          <p className="rg-section-sub">Select the account type that matches your role in the rental ecosystem</p>
        </motion.div>

        {/* Cards */}
        <motion.div
          className="rg-cards"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          {TYPES.map((t) => (
            <motion.div
              key={t.key}
              className={`rg-card ${selected === t.key ? "selected" : ""}`}
              variants={fadeUp}
              onClick={() => setSelected(t.key)}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              {/* Selected indicator */}
              {selected === t.key && (
                <span className="rg-card-check"><FaCheckCircle /></span>
              )}

              <div className="rg-card-icon-wrap">
                {t.icon}
              </div>

              <h3 className="rg-card-title">{t.title}</h3>
              <p className="rg-card-sub">{t.sub}</p>

              <ul className="rg-card-features">
                {t.features.map((f, i) => (
                  <li key={i}>
                    <FaCheckCircle className="rg-feat-check" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className={`rg-card-select-row ${selected === t.key ? "active" : ""}`}>
                {selected === t.key ? "Selected" : "Select"}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Note */}
        <motion.div
          className="rg-note"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <span className="rg-note-icon">ℹ</span>
          <p>
            Property owners should register as <strong>Property Owner</strong> to access
            all property management features including the owner dashboard.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.button
          className={`rg-continue-btn ${!selected ? "disabled" : ""}`}
          onClick={handleContinue}
          disabled={!selected}
          whileHover={selected ? { scale: 1.02 } : {}}
          whileTap={selected ? { scale: 0.98 } : {}}
        >
          Continue Registration <FaArrowRight />
        </motion.button>

      </div>
    </div>
  );
};

export default Registration;