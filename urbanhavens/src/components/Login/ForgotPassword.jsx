// ForgotPassword.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaEnvelope, FaArrowRight } from "react-icons/fa";
import "./Login.css";
import { forgotPassword } from "../../Dashboard/Owner/UploadDetails/api/api";

const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

const ForgotPassword = () => {
  const [email, setEmail]     = useState("");
  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await forgotPassword(email);
      setMessage(res.message || res.detail || "Reset code sent successfully.");
      setError("");
      navigate("/confirm-reset-code", { state: { email } });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || "Something went wrong");
      setMessage("");
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
            Forgot <span className="lg-accent">Password?</span>
          </motion.h1>
          <motion.p className="lg-hero-sub" variants={fadeUp}>
            Enter your email and we'll send you a reset code instantly.
          </motion.p>
        </motion.div>
      </section>

      <div className="lg-body">
        <motion.div className="lg-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}>
          {message && <div className="lg-success">{message}</div>}
          {error   && <div className="lg-error">{error}</div>}

          <form onSubmit={handleSubmit} className="lg-form">
            <div className="lg-field">
              <label>Email Address</label>
              <div className="lg-input-wrap">
                <FaEnvelope className="lg-input-icon" />
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="lg-submit-btn" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Code"}
              {!loading && <FaArrowRight />}
            </button>
          </form>

          <p className="lg-register-link">
            Remembered it? <span onClick={() => navigate("/login")}>Back to login</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;