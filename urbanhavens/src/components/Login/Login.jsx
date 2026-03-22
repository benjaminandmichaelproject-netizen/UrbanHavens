import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { FaArrowRight, FaEnvelope, FaLock } from "react-icons/fa";
import "./Login.css";

const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const successMessage          = location.state?.message || "";

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res      = await axios.post("/api/users/login/", formData);
      const { access, refresh, id, username, role } = res.data;
      const userRole = role.toLowerCase();

      localStorage.setItem("token",    access);
      localStorage.setItem("refresh",  refresh);
      localStorage.setItem("userId",   id);
      localStorage.setItem("username", username);
      localStorage.setItem("role",     userRole);

      if      (userRole === "owner") window.location.href = "/dashboard/owner";
      else if (userRole === "admin") window.location.href = "/dashboard/admin";
      else                           window.location.href = "/";
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.error  ||
        "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-page">

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="lg-hero">
        <div className="lg-hero-texture" />
        <div className="lg-hero-glow" />

        <motion.div
          className="lg-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.span className="lg-eyebrow" variants={fadeUp}>URBANHAVENS</motion.span>
          <motion.h1 className="lg-hero-title" variants={fadeUp}>
            Welcome <span className="lg-accent">Back</span>
          </motion.h1>
          <motion.p className="lg-hero-sub" variants={fadeUp}>
            Log in to manage your properties or find your next home across Ghana.
          </motion.p>
        </motion.div>
      </section>

      {/* ── Card ────────────────────────────────────────── */}
      <div className="lg-body">
        <motion.div
          className="lg-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
        >
          {successMessage && <div className="lg-success">{successMessage}</div>}
          {error          && <div className="lg-error">{error}</div>}

          <form onSubmit={handleSubmit} className="lg-form">

            <div className="lg-field">
              <label>Email Address</label>
              <div className="lg-input-wrap">
                <FaEnvelope className="lg-input-icon" />
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

            <div className="lg-field">
              <div className="lg-label-row">
                <label>Password</label>
                <span className="lg-forgot" onClick={() => navigate("/forgot-password")}>
                  Forgot password?
                </span>
              </div>
              <div className="lg-input-wrap">
                <FaLock className="lg-input-icon" />
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <button type="submit" className="lg-submit-btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <FaArrowRight />}
            </button>

          </form>

          <p className="lg-register-link">
            Don't have an account?{" "}
            <span onClick={() => navigate("/register-form")}>Create one here</span>
          </p>

        </motion.div>
      </div>

    </div>
  );
};

export default Login;