// ConfirmResetCode.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FaArrowRight } from "react-icons/fa";
import "./Login.css";
import { confirmResetCode } from "../../Dashboard/Owner/UploadDetails/api/api";

const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

const ConfirmResetCode = () => {
  const navigate      = useNavigate();
  const location      = useLocation();
  const email         = location.state?.email;
  const [code, setCode]     = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await confirmResetCode(email, code);
      setError("");
      navigate("/reset-password", { state: { email, code } });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <section className="lg-hero">
        <div className="lg-hero-texture" />
        <div className="lg-hero-glow" />
        <motion.div className="lg-hero-inner" variants={stagger} initial="hidden" animate="show">
          <motion.span className="lg-eyebrow" variants={fadeUp}>URBANHAVENS</motion.span>
          <motion.h1 className="lg-hero-title" variants={fadeUp}>
            Check your <span className="lg-accent">Email</span>
          </motion.h1>
          <motion.p className="lg-hero-sub" variants={fadeUp}>
            We sent a reset code to {email || "your inbox"}.
          </motion.p>
        </motion.div>
      </section>

      <div className="lg-body">
        <motion.div className="lg-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}>
          {error && <div className="lg-error">{error}</div>}

          <form onSubmit={handleSubmit} className="lg-form">
            <div className="lg-field">
              <label>Reset Code</label>
              <div className="lg-input-wrap">
                <input
                  type="text"
                  placeholder="Enter code sent to your email"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  style={{ paddingLeft: "14px" }}
                />
              </div>
            </div>

            <button type="submit" className="lg-submit-btn" disabled={loading}>
              {loading ? "Verifying..." : "Confirm Code"}
              {!loading && <FaArrowRight />}
            </button>
          </form>

          <p className="lg-register-link">
            Wrong email? <span onClick={() => navigate("/forgot-password")}>Go back</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ConfirmResetCode;