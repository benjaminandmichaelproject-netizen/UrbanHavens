// ResetPassword.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FaLock, FaArrowRight } from "react-icons/fa";
import "./Login.css";
import { resetPassword } from "../../Dashboard/Owner/UploadDetails/api/api";

const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

const ResetPassword = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const email     = location.state?.email;
  const code      = location.state?.code;

  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]                     = useState("");
  const [message, setMessage]                 = useState("");
  const [loading, setLoading]                 = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !code) { setError("Reset session expired. Please request a new reset code."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    try {
      setLoading(true);
      const res = await resetPassword(email, code, password, confirmPassword);
      setMessage(res.message || res.detail || "Password reset successful!");
      setError("");
      navigate("/login");
    } catch (err) {
      setError(
        err.response?.data?.new_password?.[0] ||
        err.response?.data?.confirm_password?.[0] ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to reset password"
      );
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
            New <span className="lg-accent">Password</span>
          </motion.h1>
          <motion.p className="lg-hero-sub" variants={fadeUp}>
            Choose a strong password to secure your account.
          </motion.p>
        </motion.div>
      </section>

      <div className="lg-body">
        <motion.div className="lg-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}>
          {message && <div className="lg-success">{message}</div>}
          {error   && <div className="lg-error">{error}</div>}

          <form onSubmit={handleSubmit} className="lg-form">
            <div className="lg-field">
              <label>New Password</label>
              <div className="lg-input-wrap">
                <FaLock className="lg-input-icon" />
                <input type="password" placeholder="Enter new password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            <div className="lg-field">
              <label>Confirm Password</label>
              <div className="lg-input-wrap">
                <FaLock className="lg-input-icon" />
                <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="lg-submit-btn" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
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

export default ResetPassword;