import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropertyDescription from "./PropertyDescription";
import PropertyLocation from "./PropertyLocation";
import PropertyLook from "./PropertyLook";
import PreviewStep from "./PreviewStep";
import { DEFAULT_FORM_DATA, DEFAULT_FILES } from "./constants";
import { uploadProperty, getPropertyById } from "./api/api";
import "./Uploadpage.css";

const STEPS = [
  { component: PropertyDescription, key: "property", label: "Property" },
  { component: PropertyLocation, key: "property_location", label: "Location" },
  { component: PropertyLook, key: "property_images", label: "Images" },
  { component: PreviewStep, key: "preview", label: "Preview & Submit" },
];

function loadSavedState() {
  try {
    const raw = localStorage.getItem("uploadFormState");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("uploadFormState");
    return null;
  }
}

function saveState(formData, step) {
  localStorage.setItem("uploadFormState", JSON.stringify({ formData, step }));
}

const Uploadpage = () => {
  const saved = loadSavedState();

  const [formData, setFormData] = useState(saved?.formData ?? DEFAULT_FORM_DATA);
  const [files, setFiles] = useState({ ...DEFAULT_FILES });
  const [step, setStep] = useState(saved?.step ?? 1);

  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitError, setSubmitError] = useState(null);
  const [showFileWarning, setShowFileWarning] = useState(!!saved && step > 1);

  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityAlertData, setSecurityAlertData] = useState(null);

  useEffect(() => {
    saveState(formData, step);
  }, [formData, step]);

  const nextStep = useCallback(() => {
    setStep((p) => Math.min(p + 1, STEPS.length));
  }, []);

  const prevStep = useCallback(() => {
    setStep((p) => Math.max(p - 1, 1));
  }, []);

  const updateSection = useCallback((section, newData) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...newData },
    }));
  }, []);

  const updateFile = useCallback((section, key, file) => {
    setFiles((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: file },
    }));
  }, []);

  const closeSecurityModal = () => {
    setShowSecurityModal(false);
  };

  const securitySummary = useMemo(() => {
    const duplicateMatches = securityAlertData?.duplicate_matches || [];
    const topMatch = duplicateMatches[0] || null;
    const rawReason = (
      topMatch?.match_reason ||
      securityAlertData?.security_flag_reason ||
      "Possible duplicate listing detected from another user account."
    ).toLowerCase();

    const chips = [];

    if (securityAlertData?.security_flag_type === "duplicate_property") {
      chips.push("Possible duplicate listing");
    }

    if (rawReason.includes("duplicate property image")) {
      chips.push("Duplicate property image");
    }

    if (rawReason.includes("very similar description")) {
      chips.push("Very similar description");
    }

    if (rawReason.includes("same property name")) {
      chips.push("Same property name");
    }

    if (rawReason.includes("very close coordinates")) {
      chips.push("Very close coordinates");
    }

    if (!chips.length) {
      if (rawReason.includes("image")) chips.push("Image similarity detected");
      if (rawReason.includes("description")) chips.push("Description similarity");
      if (rawReason.includes("name")) chips.push("Property name similarity");
      if (rawReason.includes("coordinate")) chips.push("Location similarity");
    }

    if (!chips.length) {
      chips.push("Listing requires review");
    }

    return {
      title: "Possible Duplicate Listing Detected",
      status: securityAlertData?.security_under_review ? "Under Review" : "Flagged",
      reason:
        topMatch?.match_reason ||
        securityAlertData?.security_flag_reason ||
        "Possible duplicate listing detected from another user account.",
      chips,
      matchScore: topMatch?.match_score ?? null,
      matchedPropertyName: topMatch?.matched_property_name || null,
    };
  }, [securityAlertData]);
const handleSubmit = async () => {
  setSubmitStatus("submitting");
  setSubmitError(null);
  setShowSecurityModal(false);
  setSecurityAlertData(null);

  const formPayload = new FormData();

  const combinedData = {
    ...formData.property,
    ...formData.property_location,
  };

  Object.entries(combinedData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (key === "amenities") {
        formPayload.append("amenities", JSON.stringify(Array.isArray(value) ? value : []));
      } else {
        formPayload.append(key, value);
      }
    }
  });

  const imageFiles = files.property_images?.property_images || [];
  imageFiles.forEach((file) => {
    if (file instanceof File) {
      formPayload.append("property_images", file);
    }
  });

  try {
    const response = await uploadProperty(formPayload);
    const createdProperty = response?.data || response;
    const propertyId = createdProperty?.id;

    localStorage.removeItem("uploadFormState");
    setFormData(DEFAULT_FORM_DATA);
    setFiles({ ...DEFAULT_FILES });
    setStep(1);
    setSubmitStatus("success");
    setShowFileWarning(false);

    // Poll for security flag since duplicate check runs async after commit
    if (propertyId) {
      let attempts = 0;
      const maxAttempts = 5;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const updated = await getPropertyById(propertyId);
          if (
            updated?.security_flagged &&
            updated?.security_flag_type === "duplicate_property"
          ) {
            clearInterval(interval);
            setSecurityAlertData(updated);
            setShowSecurityModal(true);
          }
        } catch (_) {}
        if (attempts >= maxAttempts) clearInterval(interval);
      }, 2000);
    }

  } catch (err) {
    console.error("Submit failed:", err);
    setSubmitError(
      err?.response?.data?.detail ||
        err?.detail ||
        err?.message ||
        JSON.stringify(err)
    );
    setSubmitStatus("error");
  }
};

  const renderStep = () => {
    const currentStep = STEPS[step - 1];
    if (!currentStep) return null;

    const { component: Component, key } = currentStep;

    if (key === "preview") {
      return (
        <Component
          formData={formData}
          files={files}
          prev={prevStep}
          finish={handleSubmit}
          isSubmitting={submitStatus === "submitting"}
        />
      );
    }

    return (
      <Component
        data={formData[key] ?? {}}
        update={(data) => updateSection(key, data)}
        files={files[key] ?? {}}
        setFile={(k, f) => updateFile(key, k, f)}
        next={nextStep}
        prev={prevStep}
      />
    );
  };

  const progressPercent = Math.round((step / STEPS.length) * 100);

  return (
    <>
      <div className="multi-step-container">
        {showFileWarning && (
          <div className="popup-banner popup-warning">
            <span>Uploaded files are not saved after refresh — please re-upload.</span>
            <button onClick={() => setShowFileWarning(false)}>✕</button>
          </div>
        )}

        {submitStatus === "success" && (
          <div className="banner banner--success">Property submitted successfully!</div>
        )}

        {submitStatus === "error" && submitError && (
          <div className="banner banner--error">Error: {submitError}</div>
        )}

        <div className="stepper-wrapper">
          <div className="stepper-header">
            {STEPS.map((s, index) => (
              <span key={index} className={step >= index + 1 ? "active" : ""}>
                ● {s.label}
              </span>
            ))}
          </div>

          <div className="progress-track-container">
            <div
              className="progress-track-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="form-content-area">{renderStep()}</div>
      </div>

      {showSecurityModal && (
        <div className="security-modal-overlay" onClick={closeSecurityModal}>
          <div
            className="security-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="security-modal__badge">Security Alert</div>

            <h3 className="security-modal__title">
              {securitySummary.title}
            </h3>

            <p className="security-modal__text">
              Your property was submitted successfully, but the system detected possible duplication and has placed this listing under review.
            </p>

            <div className="security-modal__chips">
              {securitySummary.chips.map((chip, index) => (
                <span key={index} className="security-modal__chip">
                  {chip}
                </span>
              ))}
            </div>

            <div className="security-modal__info">
              <div className="security-modal__row">
                <span>Property</span>
                <strong>{securityAlertData?.property_name || "Submitted Property"}</strong>
              </div>

              <div className="security-modal__row">
                <span>Status</span>
                <strong>{securitySummary.status}</strong>
              </div>

              <div className="security-modal__row">
                <span>Alert Type</span>
                <strong>
                  {securityAlertData?.security_flag_type === "duplicate_property"
                    ? "Duplicate Property Alert"
                    : "Security Review"}
                </strong>
              </div>

              <div className="security-modal__row">
                <span>Reason</span>
                <strong>{securitySummary.reason}</strong>
              </div>

              {securitySummary.matchScore !== null && (
                <div className="security-modal__row">
                  <span>Match Score</span>
                  <strong>{securitySummary.matchScore}</strong>
                </div>
              )}

              {securitySummary.matchedPropertyName && (
                <div className="security-modal__row">
                  <span>Matched With</span>
                  <strong>{securitySummary.matchedPropertyName}</strong>
                </div>
              )}
            </div>

            <div className="security-modal__note">
              Please make sure the property details, location, and uploaded images are correct. An admin will review the listing before any further moderation action is taken.
            </div>

            <div className="security-modal__actions">
              <button
                className="security-modal__btn security-modal__btn--primary"
                onClick={closeSecurityModal}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Uploadpage;