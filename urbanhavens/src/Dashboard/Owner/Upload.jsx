import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaHome, FaArrowRight, FaClipboardList,
  FaCheckCircle, FaChartLine,
} from "react-icons/fa";
import "./owner.css";

const perks = [
  { icon: <FaClipboardList />, text: "List properties in minutes" },
  { icon: <FaCheckCircle />,   text: "Get verified tenant bookings" },
  { icon: <FaChartLine />,     text: "Track revenue & occupancy" },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const fadeUp  = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } } };

const Upload = () => (
  <div className="upl-page">

    {/* ── Header ──────────────────────────────────────────── */}
    <motion.div
      className="upl-header"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.span className="upl-eyebrow" variants={fadeUp}>PROPERTY MANAGEMENT</motion.span>
      <motion.h1 className="upl-title" variants={fadeUp}>Your Properties</motion.h1>
      <motion.p className="upl-sub" variants={fadeUp}>
        View details of your listed properties or submit a new one
      </motion.p>
    </motion.div>

    {/* ── Submit card ─────────────────────────────────────── */}
    <motion.div
      className="upl-card-wrap"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
    >
      <Link
        to="/dashboard/owner/UploadDetails/uploadpage"
        className="upl-card"
      >
        {/* Icon */}
        <div className="upl-card-icon">
          <FaHome />
        </div>

        {/* Text */}
        <div className="upl-card-body">
          <h3>Submit a Property</h3>
          <p>List a new property and start receiving tenant bookings today</p>
        </div>

        {/* Arrow */}
        <div className="upl-card-arrow">
          <FaArrowRight />
        </div>
      </Link>

      {/* Perks strip */}
      <div className="upl-perks">
        {perks.map((p, i) => (
          <motion.div
            key={i}
            className="upl-perk"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
          >
            <span className="upl-perk-icon">{p.icon}</span>
            <span>{p.text}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>

  </div>
);

export default Upload;