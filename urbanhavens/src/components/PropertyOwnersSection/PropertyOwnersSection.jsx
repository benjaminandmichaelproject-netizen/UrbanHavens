import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faChartLine, faCheck } from "@fortawesome/free-solid-svg-icons";
import "./PropertyOwnersSection.css";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.15 } },
};

const cardAnim = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,
             transition: { duration: 0.55, ease: "easeOut" } },
};

const listItem = {
  hidden: { opacity: 0, x: -16 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const cards = [
  {
    icon: faBuilding,
    tag:  "List & Manage",
    title: "List Your Properties",
    desc:  "Reach thousands of verified tenants by listing your properties on our premium platform.",
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
    tag:  "Grow Revenue",
    title: "Maximize Your Property's Value",
    desc:  "Our platform helps you showcase your properties in the best light, attracting more tenants and increasing your rental income.",
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

  return (
    <section className="po-section">
      <div className="po-texture" />

      {/* ── Header ──────────────────────────────────────── */}
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

      {/* ── Cards ───────────────────────────────────────── */}
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
            {/* Tag */}
            <span className="po-card-tag">{card.tag}</span>

            {/* Icon + title */}
            <div className="po-card-head">
              <div className="po-card-icon-wrap">
                <FontAwesomeIcon icon={card.icon} className="po-card-icon" />
              </div>
              <h3 className="po-card-title">{card.title}</h3>
            </div>

            <p className="po-card-desc">{card.desc}</p>

            {/* Feature list */}
            <motion.ul
              className="po-card-list"
              variants={stagger}
            >
              {card.items.map((item, j) => (
                <motion.li key={j} variants={listItem}>
                  <span className="po-check">
                    <FontAwesomeIcon icon={faCheck} />
                  </span>
                  {item}
                </motion.li>
              ))}
            </motion.ul>

            {/* CTA */}
            {card.cta && (
              <button
                className="po-card-btn"
                onClick={() => navigate("/dashboard/owner/UploadDetails/uploadpage")}
              >
                {card.cta} →
              </button>
            )}
          </motion.div>
        ))}
      </motion.div>

    </section>
  );
};

export default PropertyOwnersSection;
