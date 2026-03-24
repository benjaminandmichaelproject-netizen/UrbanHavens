import React, { useState } from "react";
import {
  FaFlag, FaExclamationTriangle, FaCheckCircle,
  FaPaperPlane, FaChevronDown, FaTimes,
} from "react-icons/fa";
import "./Report.css";
import { api } from "../../Owner/UploadDetails/api/api";

const REPORT_CATEGORIES = [
  { value: "", label: "Select a reason" },
  { value: "fraudulent_listing",    label: "Fraudulent or fake listing" },
  { value: "misleading_info",       label: "Misleading property information" },
  { value: "inappropriate_content", label: "Inappropriate content or photos" },
  { value: "scam",                  label: "Suspected scam or fraud" },
  { value: "wrong_price",           label: "Incorrect pricing" },
  { value: "already_rented",        label: "Property already rented" },
  { value: "harassment",            label: "Harassment or abuse" },
  { value: "other",                 label: "Other" },
];

const Report = () => {
  const [form, setForm] = useState({
    category:      "",
    subject:       "",
    description:   "",
    propertyId:    "",
    contact_email: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [errors,    setErrors]    = useState({});
  const [apiError,  setApiError]  = useState("");

  const validate = () => {
    const e = {};
    if (!form.category)                       e.category    = "Please select a reason.";
    if (!form.subject.trim())                 e.subject     = "Subject is required.";
    if (form.description.trim().length < 20)  e.description = "Please provide at least 20 characters.";
    if (form.contact_email && !/\S+@\S+\.\S+/.test(form.contact_email))
                                              e.contact_email = "Enter a valid email address.";
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (apiError)     setApiError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return; }

    setLoading(true);
    setApiError("");

    try {
      const payload = {
        category:      form.category,
        subject:       form.subject,
        description:   form.description,
        contact_email: form.contact_email,
        ...(form.propertyId && { reported_property: form.propertyId }),
      };

      await api.post("/reports/", payload);
      setSubmitted(true);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail  ||
        "Something went wrong. Please try again.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ category: "", subject: "", description: "", propertyId: "", contact_email: "" });
    setErrors({});
    setApiError("");
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="report-page">
        <div className="report-success-card">
          <div className="report-success-icon"><FaCheckCircle /></div>
          <h2>Report Submitted</h2>
          <p>Thank you for helping keep UrbanHavens safe. Our team will review your report within 24-48 hours.</p>
          <button className="report-submit-btn" onClick={handleReset}>Submit Another Report</button>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <div className="report-page-header">
        <div className="report-header-icon"><FaFlag /></div>
        <div>
          <h2>Report an Issue</h2>
          <p>Help us maintain a trustworthy platform by reporting problems.</p>
        </div>
      </div>

      <div className="report-warning-banner">
        <FaExclamationTriangle />
        <span>False reports may result in account suspension. Please only report genuine issues.</span>
      </div>

      {apiError && (
        <div className="report-api-error">
          <FaExclamationTriangle /> {apiError}
        </div>
      )}

      <form className="report-form" onSubmit={handleSubmit} noValidate>
        <div className="report-form-row">
          <div className={`report-field ${errors.category ? "has-error" : ""}`}>
            <label htmlFor="category">Reason for Report <span>*</span></label>
            <div className="report-select-wrapper">
              <select id="category" name="category" value={form.category} onChange={handleChange}>
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} disabled={c.value === ""}>{c.label}</option>
                ))}
              </select>
              <FaChevronDown className="report-select-arrow" />
            </div>
            {errors.category && <span className="report-error-msg">{errors.category}</span>}
          </div>

          <div className="report-field">
            <label htmlFor="propertyId">Property ID <span className="report-optional">(optional)</span></label>
            <input type="text" id="propertyId" name="propertyId" placeholder="e.g. 123" value={form.propertyId} onChange={handleChange} />
          </div>
        </div>

        <div className={`report-field ${errors.subject ? "has-error" : ""}`}>
          <label htmlFor="subject">Subject <span>*</span></label>
          <input type="text" id="subject" name="subject" placeholder="Brief summary of the issue" value={form.subject} onChange={handleChange} maxLength={120} />
          <div className="report-field-footer">
            {errors.subject ? <span className="report-error-msg">{errors.subject}</span> : <span />}
            <span className="report-char-count">{form.subject.length}/120</span>
          </div>
        </div>

        <div className={`report-field ${errors.description ? "has-error" : ""}`}>
          <label htmlFor="description">Description <span>*</span></label>
          <textarea id="description" name="description" placeholder="Describe the issue in detail." value={form.description} onChange={handleChange} rows={5} maxLength={1000} />
          <div className="report-field-footer">
            {errors.description ? <span className="report-error-msg">{errors.description}</span> : <span />}
            <span className="report-char-count">{form.description.length}/1000</span>
          </div>
        </div>

        <div className={`report-field ${errors.contact_email ? "has-error" : ""}`}>
          <label htmlFor="contact_email">Your Email <span className="report-optional">(optional - for follow-up)</span></label>
          <input type="email" id="contact_email" name="contact_email" placeholder="you@example.com" value={form.contact_email} onChange={handleChange} />
          {errors.contact_email && <span className="report-error-msg">{errors.contact_email}</span>}
        </div>

        <div className="report-form-actions">
          <button type="button" className="report-cancel-btn" onClick={handleReset} disabled={loading}>
            <FaTimes /> Clear
          </button>
          <button type="submit" className="report-submit-btn" disabled={loading}>
            {loading ? <span className="report-spinner" /> : <><FaPaperPlane /> Submit Report</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Report;