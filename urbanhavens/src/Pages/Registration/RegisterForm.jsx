import { useLocation, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
// import axios from "axios";
import { FaArrowRight, FaHome, FaBuilding } from "react-icons/fa";
import "./Registration.css";
import { api } from "../../Dashboard/Owner/UploadDetails/api/api";
const fadeUp  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const RegisterForm = () => {
  const location    = useLocation();
  const navigate    = useNavigate();
  const accountType = location.state?.accountType || "tenant";

  const [formData, setFormData] = useState({
    firstName: "", surname: "", email: "", phone: "",
    password: "", confirmPassword: "",
    businessName: "", idType: "", idNumber: "", idFile: null,
  });

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, idFile: e.target.files[0] });
    setErrors({ ...errors, idFile: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let newErrors = {};

    if (!formData.firstName.trim())    newErrors.firstName       = "First name is required";
    if (!formData.surname.trim())      newErrors.surname         = "Surname is required";
    if (!formData.email.trim())        newErrors.email           = "Email is required";
    if (!formData.password)            newErrors.password        = "Password is required";
    if (!formData.confirmPassword)     newErrors.confirmPassword = "Confirm your password";
    if (formData.password !== formData.confirmPassword)
                                       newErrors.confirmPassword = "Passwords do not match";

    if (accountType === "landlord") {
      if (!formData.businessName.trim()) newErrors.businessName = "Business name is required";
      if (!formData.idType)              newErrors.idType       = "Select ID type";
      if (!formData.idNumber.trim())     newErrors.idNumber     = "ID number is required";
      if (!formData.idFile)              newErrors.idFile       = "Upload your ID document";
    }

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const data = new FormData();
    data.append("first_name",        formData.firstName);
    data.append("last_name",         formData.surname);
    data.append("email",             formData.email);
    data.append("phone",             formData.phone || "");
    data.append("password",          formData.password);
    data.append("confirm_password",  formData.confirmPassword);
    data.append("role",              accountType === "landlord" ? "owner" : "tenant");

    if (accountType === "landlord") {
      data.append("business_name",  formData.businessName);
      data.append("document_type",  formData.idType);
      data.append("id_number",      formData.idNumber);
      data.append("document_file",  formData.idFile);
    }

    try {
      setLoading(true);
   const res = await api.post("/users/register/", data, {
  headers: { "Content-Type": "multipart/form-data" },
});
      const user = res.data.user;
      localStorage.removeItem("token");
      localStorage.setItem("username", user.username || "");
      localStorage.setItem("role",     user.role     || "");

      navigate("/login", { state: { message: "Account created successfully. Please log in." } });
    } catch (err) {
      if (err.response?.data) {
        const be = {};
        Object.keys(err.response.data).forEach(k => {
          const v = err.response.data[k];
          be[k] = Array.isArray(v) ? v[0] : v;
        });
        setErrors(be);
      }
    } finally {
      setLoading(false);
    }
  };

  const isLandlord = accountType === "landlord";

  return (
    <div className="rg-page">

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="rg-hero rg-hero-short">
        <div className="rg-hero-texture" />
        <div className="rg-hero-glow" />
        <motion.div
          className="rg-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.span className="rg-eyebrow" variants={fadeUp}>
            {isLandlord ? "PROPERTY OWNER" : "TENANT"}
          </motion.span>
          <motion.h1 className="rg-hero-title" variants={fadeUp}>
            {isLandlord ? "Owner" : "Tenant"}{" "}
            <span className="rg-accent">Registration</span>
          </motion.h1>
          <motion.p className="rg-hero-sub" variants={fadeUp}>
            {isLandlord
              ? "Create your owner account to list and manage properties."
              : "Create your tenant account to find and book your perfect home."}
          </motion.p>
        </motion.div>
      </section>

      {/* ── Form ────────────────────────────────────────────── */}
      <div className="rg-body">
        <motion.div
          className="rg-form-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          {/* Account type badge */}
          <div className="rg-form-badge">
            {isLandlord ? <FaBuilding /> : <FaHome />}
            {isLandlord ? "Property Owner Account" : "Tenant Account"}
          </div>

          <form onSubmit={handleSubmit} className="rg-form">

            {/* Section: Personal info */}
            <p className="rg-form-section-label">Personal Information</p>

            <div className="rg-row">
              <div className="rg-field">
                <label>First Name</label>
                <input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" />
                {errors.firstName && <span className="rg-error">{errors.firstName}</span>}
              </div>
              <div className="rg-field">
                <label>Surname</label>
                <input name="surname" value={formData.surname} onChange={handleChange} placeholder="Doe" />
                {errors.surname && <span className="rg-error">{errors.surname}</span>}
              </div>
            </div>

            <div className="rg-row">
              <div className="rg-field">
                <label>Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" />
                {errors.email && <span className="rg-error">{errors.email}</span>}
              </div>
              <div className="rg-field">
                <label>Phone <span className="rg-optional">(optional)</span></label>
                <input name="phone" value={formData.phone} onChange={handleChange} placeholder="+233 XX XXX XXXX" />
                {errors.phone && <span className="rg-error">{errors.phone}</span>}
              </div>
            </div>

            {/* Section: Security */}
            <p className="rg-form-section-label">Security</p>

            <div className="rg-row">
              <div className="rg-field">
                <label>Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" />
                {errors.password && <span className="rg-error">{errors.password}</span>}
              </div>
              <div className="rg-field">
                <label>Confirm Password</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" />
                {errors.confirmPassword && <span className="rg-error">{errors.confirmPassword}</span>}
              </div>
            </div>

            {/* Section: Landlord extras */}
            {isLandlord && (
              <>
                <p className="rg-form-section-label">Business & Verification</p>

                <div className="rg-row">
                  <div className="rg-field">
                    <label>Business Name</label>
                    <input name="businessName" value={formData.businessName} onChange={handleChange} placeholder="Your business or trade name" />
                    {(errors.businessName || errors.business_name) && <span className="rg-error">{errors.businessName || errors.business_name}</span>}
                  </div>
                  <div className="rg-field">
                    <label>ID Type</label>
                    <select name="idType" value={formData.idType} onChange={handleChange}>
                      <option value="">Select ID type</option>
                      <option value="Ghana Card">Ghana Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Driver License">Driver License</option>
                    </select>
                    {(errors.idType || errors.document_type) && <span className="rg-error">{errors.idType || errors.document_type}</span>}
                  </div>
                </div>

                <div className="rg-row">
                  <div className="rg-field">
                    <label>ID Number</label>
                    <input name="idNumber" value={formData.idNumber} onChange={handleChange} placeholder="GHA-XXXXXXXXX-X" />
                    {(errors.idNumber || errors.id_number) && <span className="rg-error">{errors.idNumber || errors.id_number}</span>}
                  </div>
                  <div className="rg-field">
                    <label>Upload ID Document</label>
                    <div className="rg-file-wrap">
                      <input type="file" onChange={handleFileChange} className="rg-file-input" id="idFile" />
                      <label htmlFor="idFile" className="rg-file-label">
                        {formData.idFile ? formData.idFile.name : "Choose file..."}
                      </label>
                    </div>
                    {(errors.idFile || errors.document_file) && <span className="rg-error">{errors.idFile || errors.document_file}</span>}
                  </div>
                </div>
              </>
            )}

            {/* Submit */}
            <button className="rg-submit-btn" type="submit" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
              {!loading && <FaArrowRight />}
            </button>

            <p className="rg-signin-link">
              Already have an account? <Link to="/login">Sign in here</Link>
            </p>

          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default RegisterForm;