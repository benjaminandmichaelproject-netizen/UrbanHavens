import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faChartLine,
  faCheck,
  faTimes,
  faUserShield,
} from "@fortawesome/free-solid-svg-icons";
import "./PropertyOwnersSection.css";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

const cardAnim = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: "easeOut" },
  },
};

const listItem = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const popupOverlay = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const popupCard = {
  hidden: { opacity: 0, y: 30, scale: 0.92 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: { duration: 0.2, ease: "easeInOut" },
  },
};

const cards = [
  {
    icon: faBuilding,
    tag: "List & Manage",
    title: "List Your Properties",
    desc: "Reach thousands of verified tenants by listing your properties on our premium platform.",
    items: [
      "Professional listing presentation",
      "Advanced tenant screening tools",
      "Automated lease management",
    ],
    cta: "List Your Property",
    highlight: true,
  },
  {
    icon: faChartLine,
    tag: "Grow Revenue",
    title: "Maximize Your Property's Value",
    desc: "Our platform helps you showcase your properties in the best light, attracting more tenants and increasing your rental income.",
    items: [
      "High-quality property photos",
      "Detailed property descriptions",
      "24/7 customer support",
    ],
    cta: null,
    highlight: false,
  },
];

const PropertyOwnersSection = () => {
  const navigate = useNavigate();
  const [showRolePopup, setShowRolePopup] = useState(false);

  const handleOwnerAction = () => {
    const role = localStorage.getItem("role")?.toLowerCase();

    if (role === "admin") {
      navigate("/dashboard/admin");
      return;
    }

    if (role === "owner") {
      navigate("/dashboard/owner");
      return;
    }

    setShowRolePopup(true);
  };

  return (
    <>
      <section className="po-section">
        <div className="po-texture" />

        <motion.div
          className="po-header"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <motion.span className="po-eyebrow" variants={fadeUp}>
            FOR PROPERTY OWNERS
          </motion.span>
          <motion.h2 className="po-title" variants={fadeUp}>
            List & Manage Your <span className="po-accent">Properties</span>
          </motion.h2>
          <motion.p className="po-sub" variants={fadeUp}>
            Comprehensive tools to list, manage, and grow your rental business
          </motion.p>
        </motion.div>

        <motion.div
          className="po-grid"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
        >
          {cards.map((card, i) => (
            <motion.div
              key={i}
              className={`po-card ${card.highlight ? "po-card-highlight" : ""}`}
              variants={cardAnim}
              whileHover={{ y: -6, transition: { duration: 0.22 } }}
            >
              <span className="po-card-tag">{card.tag}</span>

              <div className="po-card-head">
                <div className="po-card-icon-wrap">
                  <FontAwesomeIcon icon={card.icon} className="po-card-icon" />
                </div>
                <h3 className="po-card-title">{card.title}</h3>
              </div>

              <p className="po-card-desc">{card.desc}</p>

              <motion.ul className="po-card-list" variants={stagger}>
                {card.items.map((item, j) => (
                  <motion.li key={j} variants={listItem}>
                    <span className="po-check">
                      <FontAwesomeIcon icon={faCheck} />
                    </span>
                    {item}
                  </motion.li>
                ))}
              </motion.ul>

              {card.cta && (
                <button className="po-card-btn" onClick={handleOwnerAction}>
                  {card.cta} →
                </button>
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      <AnimatePresence>
        {showRolePopup && (
          <motion.div
            className="po-popup-overlay"
            variants={popupOverlay}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={() => setShowRolePopup(false)}
          >
            <motion.div
              className="po-popup"
              variants={popupCard}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="po-popup-close"
                onClick={() => setShowRolePopup(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <div className="po-popup-icon-wrap">
                <FontAwesomeIcon icon={faUserShield} className="po-popup-icon" />
              </div>

              <h3 className="po-popup-title">Landlord Access Required</h3>
              <p className="po-popup-text">
                To use this feature, you need to register as a landlord or property owner on UrbanHavens.
              </p>

              <div className="po-popup-actions">
                <button
                  className="po-popup-btn secondary"
                  onClick={() => setShowRolePopup(false)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PropertyOwnersSection;