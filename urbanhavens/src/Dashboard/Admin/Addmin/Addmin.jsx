import React, { useState } from "react";
import "./AddAdmin.css";

const EyeIcon = ({ open }) =>
  open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M2 7l10 7 10-7"/>
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.86 19.86 0 0 1 3.08 4.18 2 2 0 0 1 5.09 2h3a2 2 0 0 1 2 1.72c.13 1 .37 1.97.72 2.9a2 2 0 0 1-.45 2.11L9.09 9.91a16 16 0 0 0 6 6l1.18-1.18a2 2 0 0 1 2.11-.45c.93.35 1.9.59 2.9.72A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const INITIAL = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  confirm_password: "",
};

const AddAdmin = () => {
  const [form, setForm] = useState(INITIAL);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = "First name is required.";
    if (!form.last_name.trim())  errs.last_name  = "Last name is required.";
    if (!form.email.trim())      errs.email      = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Enter a valid email.";
    if (!form.phone.trim())      errs.phone      = "Phone number is required.";
    if (!form.password)          errs.password   = "Password is required.";
    else if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (!form.confirm_password)
      errs.confirm_password = "Please confirm the password.";
    else if (form.password !== form.confirm_password)
      errs.confirm_password = "Passwords do not match.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      // Register action uses MultiPartParser — send FormData, not JSON
      const formData = new FormData();
      Object.entries({ ...form, role: "admin" }).forEach(([key, val]) => {
        formData.append(key, val);
      });

      const response = await fetch("/api/users/register/", {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          // Do NOT set Content-Type — browser sets it with boundary for FormData
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Map DRF field errors back onto the form
        // e.g. { email: ["An account with this email already exists."] }
        const fieldErrors = {};
        Object.entries(data).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val;
        });
        setErrors(fieldErrors);
        return;
      }

      // Success
      setSuccess(true);
      setForm(INITIAL);
      setTimeout(() => setSuccess(false), 3500);

    } catch (err) {
      setErrors({ non_field_errors: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aa-page">
      <div className="aa-card">

        {/* Header */}
        <div className="aa-header">
          <div className="aa-header-icon">
            <UserIcon />
          </div>
          <div>
            <h2 className="aa-title">Add Administrator</h2>
            <p className="aa-subtitle">Create a new admin account with full dashboard access</p>
          </div>
        </div>

        {/* Success banner */}
        {success && (
          <div className="aa-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Admin account created successfully.
          </div>
        )}

        {/* Non-field / network error */}
        {errors.non_field_errors && (
          <div className="aa-error-banner">{errors.non_field_errors}</div>
        )}

        <form className="aa-form" onSubmit={handleSubmit} noValidate>

          {/* Name row */}
          <div className="aa-row">
            <div className="aa-field">
              <label className="aa-label">First Name</label>
              <div className={`aa-input-wrap ${errors.first_name ? "error" : ""}`}>
                <span className="aa-input-icon"><UserIcon /></span>
                <input
                  className="aa-input"
                  type="text"
                  name="first_name"
                  placeholder="John"
                  value={form.first_name}
                  onChange={handleChange}
                  autoComplete="given-name"
                />
              </div>
              {errors.first_name && <span className="aa-error">{errors.first_name}</span>}
            </div>

            <div className="aa-field">
              <label className="aa-label">Last Name</label>
              <div className={`aa-input-wrap ${errors.last_name ? "error" : ""}`}>
                <span className="aa-input-icon"><UserIcon /></span>
                <input
                  className="aa-input"
                  type="text"
                  name="last_name"
                  placeholder="Doe"
                  value={form.last_name}
                  onChange={handleChange}
                  autoComplete="family-name"
                />
              </div>
              {errors.last_name && <span className="aa-error">{errors.last_name}</span>}
            </div>
          </div>

          {/* Email */}
          <div className="aa-field">
            <label className="aa-label">Email Address</label>
            <div className={`aa-input-wrap ${errors.email ? "error" : ""}`}>
              <span className="aa-input-icon"><MailIcon /></span>
              <input
                className="aa-input"
                type="email"
                name="email"
                placeholder="admin@urbanhavens.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
            </div>
            {errors.email && <span className="aa-error">{errors.email}</span>}
          </div>

          {/* Phone */}
          <div className="aa-field">
            <label className="aa-label">Phone Number</label>
            <div className={`aa-input-wrap ${errors.phone ? "error" : ""}`}>
              <span className="aa-input-icon"><PhoneIcon /></span>
              <input
                className="aa-input"
                type="tel"
                name="phone"
                placeholder="+233 XX XXX XXXX"
                value={form.phone}
                onChange={handleChange}
                autoComplete="tel"
              />
            </div>
            {errors.phone && <span className="aa-error">{errors.phone}</span>}
          </div>

          {/* Password row */}
          <div className="aa-row">
            <div className="aa-field">
              <label className="aa-label">Password</label>
              <div className={`aa-input-wrap ${errors.password ? "error" : ""}`}>
                <span className="aa-input-icon"><LockIcon /></span>
                <input
                  className="aa-input"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="aa-eye"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {errors.password && <span className="aa-error">{errors.password}</span>}
            </div>

            <div className="aa-field">
              <label className="aa-label">Confirm Password</label>
              <div className={`aa-input-wrap ${errors.confirm_password ? "error" : ""}`}>
                <span className="aa-input-icon"><LockIcon /></span>
                <input
                  className="aa-input"
                  type={showConfirm ? "text" : "password"}
                  name="confirm_password"
                  placeholder="Repeat password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="aa-eye"
                  onClick={() => setShowConfirm((p) => !p)}
                  tabIndex={-1}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {errors.confirm_password && (
                <span className="aa-error">{errors.confirm_password}</span>
              )}
            </div>
          </div>

          {/* Submit */}
          <button className="aa-submit" type="submit" disabled={loading}>
            {loading ? (
              <span className="aa-spinner" />
            ) : (
              <>
                <UserIcon />
                Create Admin Account
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};

export default AddAdmin;