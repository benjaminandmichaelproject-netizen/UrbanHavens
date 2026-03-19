import React, { useState, useEffect, useCallback } from "react";
import PropertyDescription from "./PropertyDescription";
import PropertyLocation from "./PropertyLocation";
import PropertyLook from "./PropertyLook";
import PreviewStep from "./PreviewStep";
import { DEFAULT_FORM_DATA, DEFAULT_FILES } from "./constants";
import { uploadProperty } from "./api/api";
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

  const handleSubmit = async () => {
    setSubmitStatus("submitting");
    setSubmitError(null);

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
      await uploadProperty(formPayload);

      localStorage.removeItem("uploadFormState");
      setFormData(DEFAULT_FORM_DATA);
      setFiles({ ...DEFAULT_FILES });
      setStep(1);
      setSubmitStatus("success");
      setShowFileWarning(false);
    } catch (err) {
      console.error("Submit failed:", err);
      setSubmitError(err?.detail || JSON.stringify(err));
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
  );
};

export default Uploadpage;