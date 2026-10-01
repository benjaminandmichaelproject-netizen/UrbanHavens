import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHalved,
  faUserLock,
  faDatabase,
  faCreditCard,
  faLocationDot,
  faBell,
  faCookieBite,
  faUserCheck,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

import "./Privacy.css";
import Footer from "../../components/Footer/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 35 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const cardAnim = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const privacySections = [
  {
    icon: faDatabase,
    title: "Information We Collect",
    text:
      "UrbanHavens may collect information you provide when creating an account, uploading a property, making a booking, scheduling an inspection, making a payment, submitting a report, or communicating through the platform.",
  },
  {
    icon: faUserLock,
    title: "How We Use Your Information",
    text:
      "We use your information to operate UrbanHavens, manage user accounts, process property bookings, support inspections and payments, create and manage leases, send notifications, improve platform security, and provide customer support.",
  },
  {
    icon: faCreditCard,
    title: "Payment Information",
    text:
      "Payments processed through UrbanHavens may be handled by trusted payment providers such as Paystack. UrbanHavens does not store complete bank card details on its own servers.",
  },
  {
    icon: faLocationDot,
    title: "Location Information",
    text:
      "When you choose to use nearby-property features, UrbanHavens may process location information to help identify rental properties within your selected area or search radius.",
  },
  {
    icon: faBell,
    title: "Notifications",
    text:
      "UrbanHavens may send important account, booking, inspection, payment, lease, renewal, security, email, SMS, and in-platform notifications where required for the operation of the service.",
  },
  {
    icon: faCookieBite,
    title: "Cookies & Local Storage",
    text:
      "UrbanHavens may use cookies, browser storage, and similar technologies to maintain sessions, remember preferences, improve performance, and provide a more consistent user experience.",
  },
];

const Privacy = () => {
  return (
    <div className="prv-wrapper">

      {/* HERO */}
      <section className="prv-hero">
        <div className="prv-hero-overlay" />

        <motion.div
          className="prv-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div className="prv-hero-icon" variants={fadeUp}>
            <FontAwesomeIcon icon={faShieldHalved} />
          </motion.div>

          <motion.span className="prv-eyebrow" variants={fadeUp}>
            YOUR PRIVACY MATTERS
          </motion.span>

          <motion.h1 className="prv-hero-title" variants={fadeUp}>
            Privacy <span>Policy</span>
          </motion.h1>

          <motion.p className="prv-hero-desc" variants={fadeUp}>
            At UrbanHavens, we are committed to protecting your personal
            information and maintaining transparency about how your data is
            collected, used, and protected.
          </motion.p>

          <motion.div className="prv-updated" variants={fadeUp}>
            Last updated: October 2026
          </motion.div>
        </motion.div>
      </section>

      {/* INTRO */}
      <section className="prv-intro">
        <motion.div
          className="prv-intro-card"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
        >
          <div className="prv-intro-icon">
            <FontAwesomeIcon icon={faUserCheck} />
          </div>

          <div>
            <span className="prv-section-label">OUR COMMITMENT</span>

            <h2>
              Protecting your information while you find and manage your home
            </h2>

            <p>
              This Privacy Policy explains how UrbanHavens collects, uses,
              stores, and protects information when tenants, landlords,
              administrators, and visitors use our Rental and Hostel Management
              System.
            </p>

            <p>
              By using UrbanHavens, you acknowledge the practices described in
              this Privacy Policy.
            </p>
          </div>
        </motion.div>
      </section>

      {/* PRIVACY CARDS */}
      <section className="prv-main">
        <motion.div
          className="prv-heading"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <motion.span className="prv-eyebrow prv-eyebrow-light" variants={fadeUp}>
            HOW YOUR DATA IS HANDLED
          </motion.span>

          <motion.h2 variants={fadeUp}>
            Your Information. Your <span>Trust.</span>
          </motion.h2>

          <motion.p variants={fadeUp}>
            We only use personal information where it is necessary to operate,
            protect, and improve the UrbanHavens platform.
          </motion.p>
        </motion.div>

        <motion.div
          className="prv-grid"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          {privacySections.map((section, index) => (
            <motion.div
              className="prv-card"
              variants={cardAnim}
              key={index}
              whileHover={{
                y: -6,
                transition: { duration: 0.2 },
              }}
            >
              <div className="prv-card-icon">
                <FontAwesomeIcon icon={section.icon} />
              </div>

              <h3>{section.title}</h3>
              <p>{section.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* DETAILED POLICY */}
      <section className="prv-policy">
        <motion.div
          className="prv-policy-inner"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-70px" }}
          variants={stagger}
        >
          <motion.div className="prv-policy-block" variants={fadeUp}>
            <span>01</span>
            <div>
              <h3>Personal Information</h3>
              <p>
                Depending on how you use UrbanHavens, we may collect your name,
                email address, phone number, account role, profile information,
                property information, booking information, inspection details,
                payment references, lease information, and other information
                that you voluntarily provide.
              </p>
            </div>
          </motion.div>

          <motion.div className="prv-policy-block" variants={fadeUp}>
            <span>02</span>
            <div>
              <h3>Property & Rental Information</h3>
              <p>
                Landlords may provide property descriptions, photographs,
                pricing, location details, apartment-unit information, hostel
                room information, and verification-related information.
                Tenants may provide booking, inspection, payment, and rental
                information necessary to complete the rental process.
              </p>
            </div>
          </motion.div>

          <motion.div className="prv-policy-block" variants={fadeUp}>
            <span>03</span>
            <div>
              <h3>Security & Fraud Prevention</h3>
              <p>
                Information may be processed to verify users and properties,
                investigate suspicious activity, review fraud reports,
                identify possible duplicate listings, protect user accounts,
                and maintain the integrity of the UrbanHavens platform.
              </p>
            </div>
          </motion.div>

          <motion.div className="prv-policy-block" variants={fadeUp}>
            <span>04</span>
            <div>
              <h3>Third-Party Services</h3>
              <p>
                UrbanHavens may use trusted third-party services for payment
                processing, email delivery, SMS notifications, cloud storage,
                artificial-intelligence support, hosting, and related platform
                services. These providers may process limited information only
                where required to provide their services.
              </p>
            </div>
          </motion.div>

          <motion.div className="prv-policy-block" variants={fadeUp}>
            <span>05</span>
            <div>
              <h3>Data Retention</h3>
              <p>
                We retain information only for as long as reasonably necessary
                to provide UrbanHavens services, maintain rental and transaction
                records, resolve disputes, improve security, and comply with
                applicable obligations.
              </p>
            </div>
          </motion.div>

          <motion.div className="prv-policy-block" variants={fadeUp}>
            <span>06</span>
            <div>
              <h3>Your Responsibilities</h3>
              <p>
                Users are responsible for providing accurate information,
                protecting their account credentials, and notifying UrbanHavens
                if they suspect unauthorized access or misuse of their account.
              </p>
            </div>
          </motion.div>

          <motion.div className="prv-policy-block" variants={fadeUp}>
            <span>07</span>
            <div>
              <h3>Changes to This Privacy Policy</h3>
              <p>
                UrbanHavens may update this Privacy Policy when platform
                features, technologies, legal requirements, or privacy
                practices change. The latest version will remain available on
                this page.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* CONTACT */}
      <section className="prv-contact">
        <motion.div
          className="prv-contact-card"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="prv-contact-icon">
            <FontAwesomeIcon icon={faEnvelope} />
          </div>

          <div>
            <span>PRIVACY QUESTIONS</span>

            <h2>Need help understanding our Privacy Policy?</h2>

            <p>
              If you have questions about your personal information or how
              UrbanHavens handles your data, contact our support team.
            </p>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default Privacy;