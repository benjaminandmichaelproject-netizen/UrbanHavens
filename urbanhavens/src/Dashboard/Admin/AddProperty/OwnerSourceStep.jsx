import React, { useEffect, useState } from "react";
import "./AdminAddProperty.css";

const OwnerSourceStep = ({
  data = {},
  update,
  files = {},
  setFile,
  next,
  owners = [],
  ownersLoading = false,
  activeSupportSession = null,
  supportSessionLoading = false,
}) => {
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => /^\d{10}$/.test(phone);

  const hasActiveSupportOwner = Boolean(
    activeSupportSession?.id && activeSupportSession?.owner
  );

  const visibleOwners = hasActiveSupportOwner
    ? owners.filter(
        (owner) => String(owner.id) === String(activeSupportSession?.owner)
      )
    : [];

  const selectedOwner = visibleOwners.find(
    (owner) =>
      String(owner.id) ===
      String(data.owner_user_id || activeSupportSession?.owner || "")
  );

  useEffect(() => {
    if (hasActiveSupportOwner) {
      update({
        owner_mode: "existing",
        owner_user_id: String(activeSupportSession.owner),
      });
    } else if (data.owner_mode !== "external") {
      update({
        owner_mode: "external",
        owner_user_id: "",
      });
    }
  }, [hasActiveSupportOwner, activeSupportSession?.owner]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "owner_mode") {
      update({ owner_mode: value });
      setErrors({});

      if (value === "existing") {
        update({
          owner_user_id: hasActiveSupportOwner
            ? String(activeSupportSession?.owner || "")
            : "",
          external_full_name: "",
          external_phone: "",
          external_email: "",
          external_business_name: "",
          external_document_type: "",
          external_id_number: "",
        });
        setFile("external_document_file", null);
      }

      if (value === "external") {
        update({
          owner_user_id: "",
        });
      }

      return;
    }

    update({ [name]: value });
    setErrors((prevErr) => ({ ...prevErr, [name]: "" }));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    update({ external_phone: value });
    setErrors((prevErr) => ({ ...prevErr, external_phone: "" }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFile("external_document_file", file);
    setErrors((prevErr) => ({ ...prevErr, external_document_file: "" }));
  };

  const validate = () => {
    const newErrors = {};

    if (data.owner_mode === "existing") {
      const effectiveOwnerId =
        data.owner_user_id || activeSupportSession?.owner || "";

      if (!hasActiveSupportOwner) {
        newErrors.owner_user_id =
          "An active owner invite is required before posting for a registered landlord.";
      } else if (!effectiveOwnerId.toString().trim()) {
        newErrors.owner_user_id = "No invited owner is linked to this session.";
      }
    }

    if (data.owner_mode === "external") {
      if (!data.external_full_name?.trim()) {
        newErrors.external_full_name = "Full name is required.";
      }

      if (!data.external_phone?.trim()) {
        newErrors.external_phone = "Phone number is required.";
      } else if (!validatePhone(data.external_phone.trim())) {
        newErrors.external_phone = "Phone number must be exactly 10 digits.";
      }

      if (!data.external_email?.trim()) {
        newErrors.external_email = "Email is required.";
      } else if (!validateEmail(data.external_email.trim())) {
        newErrors.external_email = "Enter a valid email address.";
      }

      if (!data.external_business_name?.trim()) {
        newErrors.external_business_name = "Business name is required.";
      }

      if (!data.external_document_type?.trim()) {
        newErrors.external_document_type = "ID type is required.";
      }

      if (!data.external_id_number?.trim()) {
        newErrors.external_id_number = "ID number is required.";
      }

      if (!files.external_document_file) {
        newErrors.external_document_file = "ID document is required.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) next();
  };

  return (
    <div className="admin-owner-step">
      <div className="owner-step-header">
        <h2>Owner Source</h2>
        <p>Choose who this property belongs to before continuing.</p>
      </div>

      {supportSessionLoading ? (
        <div className="support-session-banner support-session-banner--loading">
          Checking active support session...
        </div>
      ) : hasActiveSupportOwner ? (
        <div className="support-session-banner">
          <h4>Active Admin Assistance Session</h4>
          <p>
            You are posting for{" "}
            <strong>{activeSupportSession.owner_name || "selected owner"}</strong>
            {activeSupportSession.owner_email
              ? ` — ${activeSupportSession.owner_email}`
              : ""}
          </p>
        </div>
      ) : (
        <div className="support-session-banner support-session-banner--warning">
          <h4>No active owner invite</h4>
          <p>
            You can add for a new external landlord now. Posting for a registered
            landlord requires an active owner invite.
          </p>
        </div>
      )}

      <div className="owner-mode-group">
        <label
          className={`owner-mode-card ${
            data.owner_mode === "existing" ? "selected" : ""
          } ${!hasActiveSupportOwner ? "disabled-card" : ""}`}
        >
          <input
            type="radio"
            name="owner_mode"
            value="existing"
            checked={data.owner_mode === "existing"}
            onChange={handleChange}
            disabled={!hasActiveSupportOwner}
          />
          <div className="owner-mode-text">
            <h4>Existing Landlord</h4>
            <p>Use a landlord who already has an account.</p>
          </div>
        </label>

        <label
          className={`owner-mode-card ${
            data.owner_mode === "external" ? "selected" : ""
          }`}
        >
          <input
            type="radio"
            name="owner_mode"
            value="external"
            checked={data.owner_mode === "external"}
            onChange={handleChange}
          />
          <div className="owner-mode-text">
            <h4>New Landlord</h4>
            <p>Add property for a landlord without an account.</p>
          </div>
        </label>
      </div>

      <div className="owner-form-shell">
        {data.owner_mode === "existing" && (
          <div className="admin-form-grid compact-grid">
            <div className="form-group full-width">
              <label>Select Registered Landlord</label>
              <select
                name="owner_user_id"
                value={data.owner_user_id || activeSupportSession?.owner || ""}
                onChange={handleChange}
                disabled={ownersLoading || !hasActiveSupportOwner}
              >
                <option value="">
                  {ownersLoading ? "Loading landlords..." : "Choose a landlord"}
                </option>

                {visibleOwners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name} — {owner.email} — {owner.phone || "No phone"}
                  </option>
                ))}
              </select>

              {errors.owner_user_id && (
                <small className="error-text">{errors.owner_user_id}</small>
              )}
            </div>

            {selectedOwner && (
              <div className="selected-owner-card full-width">
                <h4>Selected Landlord</h4>
                <p><strong>Name:</strong> {selectedOwner.name}</p>
                <p><strong>Email:</strong> {selectedOwner.email}</p>
                <p><strong>Phone:</strong> {selectedOwner.phone || "N/A"}</p>
              </div>
            )}
          </div>
        )}

        {data.owner_mode === "external" && (
          <div className="admin-form-grid compact-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="external_full_name"
                value={data.external_full_name || ""}
                onChange={handleChange}
                placeholder="Enter full name"
              />
              {errors.external_full_name && (
                <small className="error-text">{errors.external_full_name}</small>
              )}
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="text"
                name="external_phone"
                value={data.external_phone || ""}
                onChange={handlePhoneChange}
                placeholder="Enter 10-digit phone number"
                maxLength={10}
              />
              {errors.external_phone && (
                <small className="error-text">{errors.external_phone}</small>
              )}
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="external_email"
                value={data.external_email || ""}
                onChange={handleChange}
                placeholder="Enter email"
              />
              {errors.external_email && (
                <small className="error-text">{errors.external_email}</small>
              )}
            </div>

            <div className="form-group">
              <label>Business Name</label>
              <input
                type="text"
                name="external_business_name"
                value={data.external_business_name || ""}
                onChange={handleChange}
                placeholder="Enter business name"
              />
              {errors.external_business_name && (
                <small className="error-text">{errors.external_business_name}</small>
              )}
            </div>

            <div className="form-group">
              <label>ID Type</label>
              <select
                name="external_document_type"
                value={data.external_document_type || ""}
                onChange={handleChange}
              >
                <option value="">Select ID type</option>
                <option value="Ghana Card">Ghana Card</option>
                <option value="Driver License">Driver License</option>
              </select>
              {errors.external_document_type && (
                <small className="error-text">{errors.external_document_type}</small>
              )}
            </div>

            <div className="form-group">
              <label>ID Number</label>
              <input
                type="text"
                name="external_id_number"
                value={data.external_id_number || ""}
                onChange={handleChange}
                placeholder="Enter ID number"
              />
              {errors.external_id_number && (
                <small className="error-text">{errors.external_id_number}</small>
              )}
            </div>

            <div className="form-group full-width">
              <label>ID Document Upload</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
              />
              {files.external_document_file && (
                <small className="file-note">{files.external_document_file.name}</small>
              )}
              {errors.external_document_file && (
                <small className="error-text">{errors.external_document_file}</small>
              )}
            </div>
          </div>
        )}

        <div className="admin-step-actions">
          <button type="button" className="next-btn" onClick={handleNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerSourceStep;