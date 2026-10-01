import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleQuestion,
  faSearch,
  faHouse,
  faCalendarCheck,
  faCreditCard,
  faFileContract,
  faShieldHalved,
  faBed,
  faRotate,
  faChevronDown,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

import "./Faq.css";
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
      staggerChildren: 0.1,
    },
  },
};

const faqs = [
  {
    category: "Getting Started",
    icon: faCircleQuestion,
    question: "What is UrbanHavens?",
    answer:
      "UrbanHavens is a Rental and Hostel Management System designed to connect tenants with landlords and support the rental process from property search and booking through inspection, payment, lease creation, and renewal.",
  },
  {
    category: "Properties",
    icon: faHouse,
    question: "How do I find a property on UrbanHavens?",
    answer:
      "Tenants can browse available houses, apartments, and hostels, use search and filtering tools, save favorite properties, and discover nearby accommodation using location-based search where available.",
  },
  {
    category: "Bookings",
    icon: faCalendarCheck,
    question: "How does the booking process work?",
    answer:
      "A tenant selects an available property and submits a booking request. The landlord reviews the request and can confirm or reject it. Once confirmed, the rental process continues to property inspection.",
  },
  {
    category: "Inspections",
    icon: faCalendarCheck,
    question: "Do I inspect the property before making payment?",
    answer:
      "Yes. UrbanHavens supports a structured inspection process so tenants can attend a scheduled property inspection before deciding whether to continue with the rental.",
  },
  {
    category: "Payments",
    icon: faCreditCard,
    question: "What payment methods are supported?",
    answer:
      "UrbanHavens supports online rental payments through Paystack as well as supported direct or on-site payment workflows that require landlord confirmation.",
  },
  {
    category: "Payments",
    icon: faCreditCard,
    question: "What happens after I make a successful payment?",
    answer:
      "After a successful Paystack payment or confirmed direct payment, the selected accommodation is reserved. The landlord can then create the tenant's lease.",
  },
  {
    category: "Apartments",
    icon: faHouse,
    question: "How are multi-unit apartments handled?",
    answer:
      "For a multi-unit apartment, the tenant selects the exact available apartment unit during the payment stage. After successful payment, only that selected unit is reserved.",
  },
  {
    category: "Hostels",
    icon: faBed,
    question: "Can UrbanHavens manage hostel rooms?",
    answer:
      "Yes. Landlords can create and manage hostel rooms, room capacity, availability, occupancy, bookings, payments, and leases for hostel accommodation.",
  },
  {
    category: "Leases",
    icon: faFileContract,
    question: "When is my lease created?",
    answer:
      "Lease creation takes place after the required rental payment has been successfully completed. The landlord creates the lease separately from the payment confirmation process.",
  },
  {
    category: "Leases",
    icon: faFileContract,
    question: "Can tenants view their lease agreement?",
    answer:
      "Yes. Once the landlord creates the lease, the tenant can access the lease and tenancy agreement information through UrbanHavens.",
  },
  {
    category: "Renewals",
    icon: faRotate,
    question: "Can I renew my lease through UrbanHavens?",
    answer:
      "Eligible tenants can request lease renewal through the platform. The landlord can review the request, approve or reject it, and the tenant can complete the required renewal payment when approved.",
  },
  {
    category: "Security",
    icon: faShieldHalved,
    question: "How does UrbanHavens help prevent fraudulent listings?",
    answer:
      "UrbanHavens includes landlord and property verification, fraud reporting, property moderation, and possible duplicate-listing detection to improve security and transparency.",
  },
  {
    category: "Security",
    icon: faShieldHalved,
    question: "What should I do if I see a suspicious property?",
    answer:
      "Tenants can report suspicious or potentially fraudulent property listings through the platform. Administrators can then review the report and take appropriate action.",
  },
];

const Faq = () => {
  const [openIndex, setOpenIndex] = useState(0);
  const [search, setSearch] = useState("");

  const filteredFaqs = faqs.filter((item) => {
    const query = search.toLowerCase();

    return (
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-wrapper">

      {/* HERO */}
      <section className="faq-hero">
        <div className="faq-hero-overlay" />

        <motion.div
          className="faq-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div className="faq-hero-icon" variants={fadeUp}>
            <FontAwesomeIcon icon={faCircleQuestion} />
          </motion.div>

          <motion.span className="faq-eyebrow" variants={fadeUp}>
            HELP CENTER
          </motion.span>

          <motion.h1 className="faq-hero-title" variants={fadeUp}>
            Frequently Asked <span>Questions</span>
          </motion.h1>

          <motion.p className="faq-hero-desc" variants={fadeUp}>
            Find answers to common questions about properties, bookings,
            inspections, payments, leases, renewals, hostels, and security on
            UrbanHavens.
          </motion.p>

          <motion.div className="faq-search" variants={fadeUp}>
            <FontAwesomeIcon icon={faSearch} />

            <input
              type="text"
              placeholder="Search for a question..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpenIndex(null);
              }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* FAQ SECTION */}
      <section className="faq-main">
        <motion.div
          className="faq-heading"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
        >
          <motion.span className="faq-eyebrow faq-eyebrow-light" variants={fadeUp}>
            COMMON QUESTIONS
          </motion.span>

          <motion.h2 variants={fadeUp}>
            Everything you need to <span>know.</span>
          </motion.h2>

          <motion.p variants={fadeUp}>
            Quick answers to help tenants and landlords understand how the
            UrbanHavens rental process works.
          </motion.p>
        </motion.div>

        <div className="faq-content">

          {/* LEFT SIDE */}
          <motion.div
            className="faq-side-card"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="faq-side-icon">
              <FontAwesomeIcon icon={faCircleQuestion} />
            </div>

            <h3>Need some help?</h3>

            <p>
              Browse the frequently asked questions or search for a topic using
              the search box above.
            </p>

            <div className="faq-side-items">
              <div>
                <FontAwesomeIcon icon={faHouse} />
                <span>Property & Booking</span>
              </div>

              <div>
                <FontAwesomeIcon icon={faCreditCard} />
                <span>Payments</span>
              </div>

              <div>
                <FontAwesomeIcon icon={faFileContract} />
                <span>Leases & Renewals</span>
              </div>

              <div>
                <FontAwesomeIcon icon={faShieldHalved} />
                <span>Safety & Security</span>
              </div>
            </div>
          </motion.div>

          {/* FAQ LIST */}
          <motion.div
            className="faq-list"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
          >
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, index) => {
                const isOpen = openIndex === index;

                return (
                  <motion.div
                    className={`faq-item ${isOpen ? "active" : ""}`}
                    key={`${faq.question}-${index}`}
                    variants={fadeUp}
                  >
                    <button
                      type="button"
                      className="faq-question"
                      onClick={() => toggleFaq(index)}
                    >
                      <div className="faq-question-left">
                        <div className="faq-item-icon">
                          <FontAwesomeIcon icon={faq.icon} />
                        </div>

                        <div>
                          <span className="faq-category">
                            {faq.category}
                          </span>

                          <h3>{faq.question}</h3>
                        </div>
                      </div>

                      <FontAwesomeIcon
                        className="faq-chevron"
                        icon={faChevronDown}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          className="faq-answer-wrapper"
                          initial={{
                            height: 0,
                            opacity: 0,
                          }}
                          animate={{
                            height: "auto",
                            opacity: 1,
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                          }}
                          transition={{
                            duration: 0.3,
                            ease: "easeInOut",
                          }}
                        >
                          <div className="faq-answer">
                            <p>{faq.answer}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            ) : (
              <div className="faq-no-results">
                <FontAwesomeIcon icon={faSearch} />

                <h3>No questions found</h3>

                <p>
                  Try searching with another word such as payment, booking,
                  lease, hostel, or verification.
                </p>
              </div>
            )}
          </motion.div>

        </div>
      </section>

      {/* CONTACT */}
      <section className="faq-contact">
        <motion.div
          className="faq-contact-card"
          initial={{
            opacity: 0,
            y: 40,
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
          <div className="faq-contact-icon">
            <FontAwesomeIcon icon={faEnvelope} />
          </div>

          <div className="faq-contact-text">
            <span>STILL NEED HELP?</span>

            <h2>Can't find the answer you're looking for?</h2>

            <p>
              Contact the UrbanHavens support team for assistance with your
              account, booking, payment, property, or lease.
            </p>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default Faq;