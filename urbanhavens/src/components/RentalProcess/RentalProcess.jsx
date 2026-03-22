import { motion } from "framer-motion";
import "./RentalProcess.css";
import TestimonialSlider from "../TestimonialSlider/TestimonialSlider";
import CallToAction from "../CallToAction/CallToAction";
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.18 } },
};

const cardAnim = {
  hidden: { opacity: 0, y: 36, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1,
             transition: { duration: 0.55, ease: "easeOut" } },
};

const steps = [
  {
    number: "01",
    title:  "Search For A Room",
    desc:   "Browse available houses, hostels, and rooms to find the one that fits your needs and budget.",
    icon:   "🔍",
  },
  {
    number: "02",
    title:  "Contact The Owner",
    desc:   "Send a message or call the landlord to ask questions and confirm availability.",
    icon:   "💬",
  },
  {
    number: "03",
    title:  "Move In",
    desc:   "Complete the booking, receive confirmation, sign your lease and move into your new home.",
    icon:   "🏠",
  },
];

const RentalProcess = () => (
  <section className="rp-section">
    <div className="rp-texture" />

    {/* Header */}
    <motion.div
      className="rp-header"
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      <motion.span className="rp-eyebrow" variants={fadeUp}>HOW IT WORKS</motion.span>
      <motion.h2 className="rp-title" variants={fadeUp}>
        House Rental <span className="rp-accent">Process</span>
      </motion.h2>
      <motion.p className="rp-sub" variants={fadeUp}>
        Three simple steps to find and move into your perfect rental
      </motion.p>
    </motion.div>

    {/* Step cards */}
    <motion.div
      className="rp-cards"
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
    >
      {steps.map((step, i) => (
        <motion.div
          key={i}
          className="rp-card"
          variants={cardAnim}
          whileHover={{ y: -6, transition: { duration: 0.22 } }}
        >
          {/* Step number top-right */}
          <span className="rp-card-num">{step.number}</span>

          {/* Icon */}
          <div className="rp-card-icon">{step.icon}</div>

          <h3 className="rp-card-title">{step.title}</h3>
          <p className="rp-card-desc">{step.desc}</p>

          {/* Connector line (hidden on last card) */}
          {i < steps.length - 1 && <div className="rp-connector" />}
        </motion.div>
      ))}
    </motion.div>
    <CallToAction/>
    <TestimonialSlider/>
  </section>
);

export default RentalProcess;