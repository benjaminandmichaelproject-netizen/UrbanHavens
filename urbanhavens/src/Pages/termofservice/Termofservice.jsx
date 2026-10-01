import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileContract,
  faUserShield,
  faHouse,
  faMoneyBillWave,
  faCalendarCheck,
  faBan,
  faScaleBalanced,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

import "./Termofservice.css";
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

const terms = [
  {
    icon: faUserShield,
    title: "Account Responsibility",
    text:
      "Users are responsible for providing accurate account information, protecting their login credentials, and ensuring that their UrbanHavens account is not used by unauthorized persons.",
  },
  {
    icon: faHouse,
    title: "Property Listings",
    text:
      "Landlords must provide accurate property information, pricing, images, availability, and location details. Misleading, fraudulent, duplicate, or unauthorized listings may be reviewed or removed.",
  },
  {
    icon: faCalendarCheck,
    title: "Bookings & Inspections",
    text:
      "Booking requests and inspection schedules must be used responsibly. Tenants and landlords are expected to provide accurate information and communicate honestly throughout the rental process.",
  },
  {
    icon: faMoneyBillWave,
    title: "Payments",
    text:
      "UrbanHavens supports approved payment workflows including Paystack and direct or on-site payment processes. Users must ensure that payment information and transaction details are accurate.",
  },
  {
    icon: faBan,
    title: "Prohibited Activities",
    text:
      "Users must not engage in fraud, impersonation, harassment, misuse of another user's account, false property advertising, unauthorized access, or any activity intended to compromise the platform.",
  },
  {
    icon: faScaleBalanced,
    title: "Platform Rules",
    text:
      "UrbanHavens may review accounts, listings, reports, payments, and other activities where necessary to maintain platform security, enforce these Terms, and protect users.",
  },
];

const Termofservice = () => {
  return (
    <div className="tos-wrapper">

      {/* HERO */}
      <section className="tos-hero">
        <div className="tos-hero-overlay" />

        <motion.div
          className="tos-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div className="tos-hero-icon" variants={fadeUp}>
            <FontAwesomeIcon icon={faFileContract} />
          </motion.div>

          <motion.span className="tos-eyebrow" variants={fadeUp}>
            PLATFORM TERMS
          </motion.span>

          <motion.h1 className="tos-hero-title" variants={fadeUp}>
            Terms of <span>Service</span>
          </motion.h1>

          <motion.p className="tos-hero-desc" variants={fadeUp}>
            These Terms of Service explain the rules, responsibilities, and
            conditions that apply when using the UrbanHavens Rental and Hostel
            Management System.
          </motion.p>

          <motion.div className="tos-updated" variants={fadeUp}>
            Last updated: October 2026
          </motion.div>
        </motion.div>
      </section>

      {/* INTRO */}
      <section className="tos-intro">
        <motion.div
          className="tos-intro-card"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
        >
          <div className="tos-intro-icon">
            <FontAwesomeIcon icon={faScaleBalanced} />
          </div>

          <div>
            <span className="tos-section-label">AGREEMENT TO OUR TERMS</span>

            <h2>Using UrbanHavens responsibly</h2>

            <p>
              By accessing or using UrbanHavens, you agree to follow these Terms
              of Service together with all applicable platform rules and
              policies.
            </p>

            <p>
              These terms apply to tenants, landlords, administrators, and
              other users who access or interact with the UrbanHavens platform.
            </p>
          </div>
        </motion.div>
      </section>

      {/* KEY TERMS */}
      <section className="tos-main">
        <motion.div
          className="tos-heading"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <motion.span className="tos-eyebrow tos-eyebrow-light" variants={fadeUp}>
            KEY RESPONSIBILITIES
          </motion.span>

          <motion.h2 variants={fadeUp}>
            Clear rules for a <span>trusted platform.</span>
          </motion.h2>

          <motion.p variants={fadeUp}>
            UrbanHavens is designed to support a transparent and secure rental
            process for both tenants and landlords.
          </motion.p>
        </motion.div>

        <motion.div
          className="tos-grid"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          {terms.map((term, index) => (
            <motion.div
              className="tos-card"
              variants={cardAnim}
              key={index}
              whileHover={{
                y: -6,
                transition: { duration: 0.2 },
              }}
            >
              <div className="tos-card-icon">
                <FontAwesomeIcon icon={term.icon} />
              </div>

              <h3>{term.title}</h3>
              <p>{term.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* DETAILED TERMS */}
      <section className="tos-policy">
        <motion.div
          className="tos-policy-inner"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-70px" }}
        >

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>01</span>
            <div>
              <h3>Eligibility and Registration</h3>
              <p>
                Users must provide accurate registration information and use
                the correct account role when creating an UrbanHavens account.
                Users are responsible for keeping their account details current.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>02</span>
            <div>
              <h3>Tenant Responsibilities</h3>
              <p>
                Tenants must use property listings, bookings, inspections,
                payment features, lease services, and reporting tools honestly.
                Tenants must not submit false information or misuse another
                person's account or identity.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>03</span>
            <div>
              <h3>Landlord Responsibilities</h3>
              <p>
                Landlords are responsible for the accuracy of property
                information submitted to UrbanHavens, including ownership,
                pricing, availability, property images, apartment units, hostel
                rooms, and other rental information.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>04</span>
            <div>
              <h3>Bookings and Property Inspections</h3>
              <p>
                UrbanHavens provides tools for tenants and landlords to manage
                booking requests and property inspections. Users are expected
                to attend scheduled inspections where applicable and update
                booking information honestly.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>05</span>
            <div>
              <h3>Payments and Transactions</h3>
              <p>
                Rental payments may be processed using supported online or
                direct payment methods. A successful payment does not replace
                the lease-creation process. Where required, the landlord must
                create the lease after the payment has been successfully
                completed.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>06</span>
            <div>
              <h3>Lease and Renewal Services</h3>
              <p>
                Lease information and renewal services are provided through the
                platform where applicable. Users must ensure that information
                supplied during lease creation and renewal is accurate.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>07</span>
            <div>
              <h3>Fraud and Platform Security</h3>
              <p>
                UrbanHavens may investigate suspicious listings, user reports,
                possible duplicate properties, payment activity, and other
                behavior that may affect the safety or integrity of the
                platform.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>08</span>
            <div>
              <h3>Account Restriction or Suspension</h3>
              <p>
                UrbanHavens may restrict access to accounts, listings, or
                platform features where there is evidence of misuse, fraud,
                unauthorized activity, serious policy violations, or risks to
                other users.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>09</span>
            <div>
              <h3>Third-Party Services</h3>
              <p>
                Some UrbanHavens functions may rely on external service
                providers for payments, email, SMS, storage, hosting, and other
                platform services. Use of these services may also be subject to
                the provider's own terms and policies.
              </p>
            </div>
          </motion.div>

          <motion.div className="tos-policy-block" variants={fadeUp}>
            <span>10</span>
            <div>
              <h3>Changes to These Terms</h3>
              <p>
                UrbanHavens may update these Terms of Service when platform
                features, security requirements, operational processes, or
                applicable obligations change. The latest version will be made
                available on this page.
              </p>
            </div>
          </motion.div>

        </motion.div>
      </section>

      {/* CONTACT */}
      <section className="tos-contact">
        <motion.div
          className="tos-contact-card"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="tos-contact-icon">
            <FontAwesomeIcon icon={faEnvelope} />
          </div>

          <div>
            <span>QUESTIONS ABOUT THESE TERMS</span>

            <h2>Need clarification?</h2>

            <p>
              Contact UrbanHavens support if you have questions about these
              Terms of Service or your responsibilities while using the
              platform.
            </p>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default Termofservice;