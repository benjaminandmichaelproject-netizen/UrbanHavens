import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import "./CallToAction.css";

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const CallToAction = () => (
  <motion.section
    className="cta-section"
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.6, ease: "easeOut" }}
  >
    <div className="cta-texture" />

    <motion.div
      className="cta-inner"
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
    >
      <motion.span className="cta-eyebrow" variants={fadeUp}>
        JOIN URBANHAVENS
      </motion.span>

      <motion.h2 className="cta-title" variants={fadeUp}>
        Ready to Find Your <span className="cta-accent">New Home?</span>
      </motion.h2>

      <motion.p className="cta-sub" variants={fadeUp}>
        Join thousands of satisfied tenants and property owners who trust our platform
      </motion.p>

      <motion.div className="cta-btns" variants={fadeUp}>
        <Link to="/registration">
          <button className="cta-btn-primary">Get Started Today →</button>
        </Link>
        <Link to="/propertylisting">
          <button className="cta-btn-ghost">Browse Listings</button>
        </Link>
      </motion.div>
    </motion.div>
  </motion.section>
);

export default CallToAction;