import { useState } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faHeadset,
  faMagnifyingGlass,
  faHouse,
  faCalendarCheck,
  faCreditCard,
  faFileContract,
  faShieldHalved,
  faUser,
  faEnvelope,
  faPaperPlane,
  faPhone,
  faClock,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";

import "./HelpCenter.css";


const supportEmail = "benjaminandmichaelproject@gmail.com";

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 35,
  },

  show: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

const stagger = {
  hidden: {},

  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const supportTopics = [
  {
    icon: faHouse,
    title: "Properties",
    text: "Get help with property listings, apartment units, hostel rooms, availability, and property information.",
  },

  {
    icon: faCalendarCheck,
    title: "Bookings & Inspections",
    text: "Need help with a booking request, scheduled inspection, cancellation, or tenant decision?",
  },

  {
    icon: faCreditCard,
    title: "Payments",
    text: "Get assistance with Paystack payments, direct payments, receipts, and transaction issues.",
  },

  {
    icon: faFileContract,
    title: "Leases & Renewals",
    text: "Find support for lease creation, tenancy agreements, lease information, and renewals.",
  },

  {
    icon: faShieldHalved,
    title: "Safety & Verification",
    text: "Report suspicious listings or get help with landlord verification, property verification, and account security.",
  },

  {
    icon: faUser,
    title: "Account Support",
    text: "Get assistance with registration, login, profile details, account access, or other account-related issues.",
  },
];

const HelpCenter = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: "",
    message: "",
  });

  const [sent, setSent] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const emailSubject =
      formData.subject || "UrbanHavens Support Request";

    const body = `
UrbanHavens Support Request

Name: ${formData.name}
Email: ${formData.email}
Category: ${formData.category || "General Support"}

Message:
${formData.message}
    `.trim();

    const mailtoLink =
      `mailto:${supportEmail}` +
      `?subject=${encodeURIComponent(emailSubject)}` +
      `&body=${encodeURIComponent(body)}`;

    setSent(true);

    window.location.href = mailtoLink;
  };

  return (
    <div className="hc-wrapper">

      {/* HERO */}
      <section className="hc-hero">
        <div className="hc-hero-overlay" />

        <motion.div
          className="hc-hero-content"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div
            className="hc-hero-icon"
            variants={fadeUp}
          >
            <FontAwesomeIcon icon={faHeadset} />
          </motion.div>

          <motion.span
            className="hc-eyebrow"
            variants={fadeUp}
          >
            URBANHAVENS SUPPORT
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="hc-title"
          >
            How can we <span>help?</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="hc-description"
          >
            Get assistance with your account, properties,
            bookings, inspections, payments, leases,
            renewals, verification, and other UrbanHavens
            services.
          </motion.p>

          <motion.div
            className="hc-search"
            variants={fadeUp}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />

            <input
              type="text"
              placeholder="What do you need help with?"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* SUPPORT CATEGORIES */}
      <section className="hc-topics">
        <motion.div
          className="hc-section-heading"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <motion.span
            className="hc-light-eyebrow"
            variants={fadeUp}
          >
            HELP TOPICS
          </motion.span>

          <motion.h2 variants={fadeUp}>
            What can we help you <span>with?</span>
          </motion.h2>

          <motion.p variants={fadeUp}>
            Select the area related to your issue or send
            our support team a message below.
          </motion.p>
        </motion.div>

        <motion.div
          className="hc-topic-grid"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{
            once: true,
            margin: "-50px",
          }}
        >
          {supportTopics.map((topic, index) => (
            <motion.div
              className="hc-topic-card"
              key={index}
              variants={fadeUp}
              whileHover={{
                y: -6,
                transition: {
                  duration: 0.2,
                },
              }}
            >
              <div className="hc-topic-icon">
                <FontAwesomeIcon icon={topic.icon} />
              </div>

              <h3>{topic.title}</h3>

              <p>{topic.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CONTACT AREA */}
      <section className="hc-contact-section">

        <div className="hc-contact-layout">

          {/* LEFT */}
          <motion.div
            className="hc-contact-info"
            initial={{
              opacity: 0,
              x: -40,
            }}
            whileInView={{
              opacity: 1,
              x: 0,
            }}
            viewport={{ once: true }}
            transition={{
              duration: 0.6,
            }}
          >
            <span className="hc-light-eyebrow">
              CONTACT SUPPORT
            </span>

            <h2>
              Still need <span>assistance?</span>
            </h2>

            <p className="hc-contact-description">
              Send us a message and provide as much
              information as possible about the issue you're
              experiencing.
            </p>

            <div className="hc-info-list">

              <div className="hc-info-item">
                <div className="hc-info-icon">
                  <FontAwesomeIcon icon={faEnvelope} />
                </div>

                <div>
                  <span>Email Support</span>

                  <a href={`mailto:${supportEmail}`}>
                    {supportEmail}
                  </a>
                </div>
              </div>

              <div className="hc-info-item">
                <div className="hc-info-icon">
                  <FontAwesomeIcon icon={faClock} />
                </div>

                <div>
                  <span>Support Availability</span>

                  <p>
                    Send us a message anytime
                  </p>
                </div>
              </div>

              <div className="hc-info-item">
                <div className="hc-info-icon">
                  <FontAwesomeIcon icon={faShieldHalved} />
                </div>

                <div>
                  <span>Security Issues</span>

                  <p>
                    Report suspicious accounts or listings
                    immediately.
                  </p>
                </div>
              </div>

            </div>

            <div className="hc-tip">
              <FontAwesomeIcon icon={faCircleCheck} />

              <div>
                <strong>Help us resolve your issue faster</strong>

                <p>
                  Include relevant booking, payment,
                  property, or account information in your
                  message where applicable.
                </p>
              </div>
            </div>
          </motion.div>

          {/* FORM */}
          <motion.div
            className="hc-form-card"
            initial={{
              opacity: 0,
              x: 40,
            }}
            whileInView={{
              opacity: 1,
              x: 0,
            }}
            viewport={{ once: true }}
            transition={{
              duration: 0.6,
            }}
          >
            <div className="hc-form-header">
              <div className="hc-form-icon">
                <FontAwesomeIcon icon={faEnvelope} />
              </div>

              <div>
                <span>SEND US A MESSAGE</span>

                <h3>Contact UrbanHavens Support</h3>
              </div>
            </div>

            <form onSubmit={handleSubmit}>

              <div className="hc-form-row">

                <div className="hc-form-group">
                  <label>Your Name</label>

                  <input
                    type="text"
                    name="name"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="hc-form-group">
                  <label>Email Address</label>

                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

              </div>

              <div className="hc-form-group">
                <label>Support Category</label>

                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">
                    Select a support category
                  </option>

                  <option value="Account Support">
                    Account Support
                  </option>

                  <option value="Property Support">
                    Property Support
                  </option>

                  <option value="Booking & Inspection">
                    Booking & Inspection
                  </option>

                  <option value="Payment Support">
                    Payment Support
                  </option>

                  <option value="Lease & Renewal">
                    Lease & Renewal
                  </option>

                  <option value="Security & Fraud Report">
                    Security & Fraud Report
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              <div className="hc-form-group">
                <label>Subject</label>

                <input
                  type="text"
                  name="subject"
                  placeholder="Briefly describe your issue"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="hc-form-group">
                <label>Message</label>

                <textarea
                  name="message"
                  rows="6"
                  placeholder="Tell us what happened and how we can help..."
                  value={formData.message}
                  onChange={handleChange}
                  required
                />
              </div>

              <button
                type="submit"
                className="hc-submit-btn"
              >
                <FontAwesomeIcon icon={faPaperPlane} />

                Send Message
              </button>

              {sent && (
                <p className="hc-send-note">
                  Your email application is being opened so
                  you can send the support request.
                </p>
              )}

            </form>
          </motion.div>

        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="hc-bottom">

        <motion.div
          className="hc-bottom-card"
          initial={{
            opacity: 0,
            y: 35,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{ once: true }}
          transition={{
            duration: 0.6,
          }}
        >
          <div className="hc-bottom-icon">
            <FontAwesomeIcon icon={faHeadset} />
          </div>

          <div>
            <span>WE'RE HERE TO HELP</span>

            <h2>
              Your UrbanHavens experience matters to us.
            </h2>

            <p>
              Whether you're a tenant or landlord, our
              support team is here to help you navigate the
              rental process.
            </p>
          </div>

        </motion.div>

      </section>

   

    </div>
  );
};

export default HelpCenter;