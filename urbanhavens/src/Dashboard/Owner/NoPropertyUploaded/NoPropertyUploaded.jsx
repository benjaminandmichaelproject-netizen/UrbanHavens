import { motion } from "framer-motion";
import { FaHome, FaPlus, FaMapMarkerAlt, FaTag } from "react-icons/fa";
import "./NoPropertyUploaded.css";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const floatUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

const NoPropertyUploaded = ({ onAddProperty }) => (
  <div className="np-wrapper">

    {/* ── Illustration — stacked ghost cards ────────────────── */}
    <motion.div
      className="np-illustration"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Back card */}
      <motion.div className="np-card np-card--back" variants={floatUp}>
        <div className="np-card-icon"><FaHome /></div>
        <div className="np-card-lines">
          <span style={{ width: "70%" }} />
          <span style={{ width: "85%" }} />
          <span style={{ width: "55%" }} />
        </div>
      </motion.div>

      {/* Middle card */}
      <motion.div className="np-card np-card--mid" variants={floatUp}>
        <div className="np-card-icon np-card-icon--green"><FaMapMarkerAlt /></div>
        <div className="np-card-lines">
          <span style={{ width: "80%" }} />
          <span style={{ width: "60%" }} />
          <span style={{ width: "90%" }} />
        </div>
      </motion.div>

      {/* Front card */}
      <motion.div className="np-card np-card--front" variants={floatUp}>
        <div className="np-card-icon np-card-icon--accent"><FaTag /></div>
        <div className="np-card-lines">
          <span style={{ width: "75%" }} />
          <span style={{ width: "88%" }} />
          <span style={{ width: "50%" }} />
        </div>
      </motion.div>

      {/* Center icon badge */}
      <motion.div
        className="np-center-badge"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4, type: "spring" }}
      >
        <FaHome />
      </motion.div>
    </motion.div>

    {/* ── Text ──────────────────────────────────────────────── */}
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="np-text"
    >
      <h2>No Properties Yet</h2>
      <p>You haven't listed any properties. Add your first listing to start receiving tenant bookings.</p>
    </motion.div>

    {/* ── CTA ───────────────────────────────────────────────── */}
    <motion.button
      className="np-btn"
      onClick={onAddProperty}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.4 }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.97 }}
    >
      <FaPlus /> Add New Property
    </motion.button>

  </div>
);

export default NoPropertyUploaded;