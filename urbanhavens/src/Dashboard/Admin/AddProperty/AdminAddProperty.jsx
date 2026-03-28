import React, { useState, useEffect, useCallback } from "react";
import OwnerSourceStep from "./OwnerSourceStep";
import PropertyDescription from "../../Owner/UploadDetails/PropertyDescription";
import PropertyLocation from "../../Owner/UploadDetails/PropertyLocation";
import PropertyLook from "../../Owner/UploadDetails/PropertyLook";
import PreviewStep from "../../Owner/UploadDetails/PreviewStep";
import { api } from "../../Owner/UploadDetails/api/api";
import { getOwners, uploadProperty } from "../../Owner/UploadDetails/api/api";
import { ADMIN_DEFAULT_FORM_DATA, ADMIN_DEFAULT_FILES } from "./adminConstants";

import SuccessModal from "../../../components/Modals/SuccessModal";
import "./AdminAddProperty.css";
import ErrorModal from "../../../components/Modals/ErrorModal";

const STEPS = [
    { component: OwnerSourceStep, key: "owner_source", label: "Owner Source" },
    { component: PropertyDescription, key: "property", label: "Property" },
    { component: PropertyLocation, key: "property_location", label: "Location" },
    { component: PropertyLook, key: "property_images", label: "Images" },
    { component: PreviewStep, key: "preview", label: "Preview & Submit" },
];

function loadSavedState() {
    try {
        const raw = localStorage.getItem("adminAddPropertyState");
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        localStorage.removeItem("adminAddPropertyState");
        return null;
    }
}

function saveState(formData, step) {
    localStorage.setItem(
        "adminAddPropertyState",
        JSON.stringify({ formData, step })
    );
}

const AdminAddProperty = () => {
    const saved = loadSavedState();

    const [formData, setFormData] = useState(
        saved?.formData ?? ADMIN_DEFAULT_FORM_DATA
    );
    const [files, setFiles] = useState({ ...ADMIN_DEFAULT_FILES });
    const [step, setStep] = useState(saved?.step ?? 1);
    const [submitStatus, setSubmitStatus] = useState("idle");
    const [submitError, setSubmitError] = useState(null);
    const [showFileWarning, setShowFileWarning] = useState(!!saved && (saved?.step ?? 1) > 1);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [owners, setOwners] = useState([]);
    const [ownersLoading, setOwnersLoading] = useState(false);
    const [activeSupportSession, setActiveSupportSession] = useState(null);
    const [supportSessionLoading, setSupportSessionLoading] = useState(false);

    // ── Fetch owners list
    useEffect(() => {
        const fetchOwners = async () => {
            try {
                setOwnersLoading(true);
                const users = await getOwners();
                const ownerUsers = users.map((user) => ({
                    id: user.id,
                    name:
                        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                        user.username,
                    email: user.email,
                    phone: user.phone,
                }));
                setOwners(ownerUsers);
            } catch (error) {
                console.error("Failed to fetch owners:", error);
            } finally {
                setOwnersLoading(false);
            }
        };

        fetchOwners();
    }, []);

    // ── Persist form state to localStorage
    useEffect(() => {
        saveState(formData, step);
    }, [formData, step]);

    // ── Fetch the current active support session from the server
    const fetchActiveSupportSession = useCallback(async () => {
        try {
            setSupportSessionLoading(true);
            const res = await api.get("/support/admin/current/");
            const session = res.data || null;
            setActiveSupportSession(session);

            if (session?.owner) {
                // Session is active — lock the owner field to the invited owner
                setFormData((prev) => ({
                    ...prev,
                    owner_source: {
                        ...prev.owner_source,
                        owner_mode: "existing",
                        owner_user_id: String(session.owner),
                    },
                }));
            } else {
                // No active session — reset owner selection so the dropdown clears
                setFormData((prev) => ({
                    ...prev,
                    owner_source: {
                        ...prev.owner_source,
                        owner_mode: prev.owner_source.owner_mode === "existing"
                            ? "external"   // fall back to external if no session
                            : prev.owner_source.owner_mode,
                        owner_user_id: "",
                    },
                }));
            }
        } catch (error) {
            console.error("Failed to fetch active support session:", error);
            setActiveSupportSession(null);
        } finally {
            setSupportSessionLoading(false);
        }
    }, []);

    // ── Initial fetch on mount
    useEffect(() => {
        fetchActiveSupportSession();
    }, [fetchActiveSupportSession]);

    // ── Listen for live support session events from the WebSocket
    //    (dispatched by NotificationContext when the backend pushes a message)
    useEffect(() => {
        const handleSupportEvent = async (e) => {
            const data = e.detail;
            if (!data?.event) return;

            // Re-fetch whenever any support session changes so the UI
            // stays in sync without the admin having to refresh
            if (typeof data.event === "string" && data.event.startsWith("support_")) {
                await fetchActiveSupportSession();
            }
        };

        window.addEventListener("support_event", handleSupportEvent);
        return () => window.removeEventListener("support_event", handleSupportEvent);
    }, [fetchActiveSupportSession]);

    const nextStep = useCallback(() => {
        setStep((prev) => Math.min(prev + 1, STEPS.length));
    }, []);

    const prevStep = useCallback(() => {
        setStep((prev) => Math.max(prev - 1, 1));
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
        const { owner_source, property, property_location } = formData;

        const combinedData = {
            ...property,
            ...property_location,
        };

        Object.entries(combinedData).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                if (key === "amenities") {
                    formPayload.append(
                        "amenities",
                        JSON.stringify(Array.isArray(value) ? value : [])
                    );
                } else {
                    formPayload.append(key, value);
                }
            }
        });

        if (owner_source.owner_mode === "existing") {
            if (owner_source.owner_user_id) {
                formPayload.append("owner_user_id", owner_source.owner_user_id);
                if (activeSupportSession?.id) {
                    formPayload.append("support_session_id", activeSupportSession.id);
                }
            }
        } else {
            if (owner_source.external_full_name) {
                formPayload.append("external_full_name", owner_source.external_full_name);
            }
            if (owner_source.external_phone) {
                formPayload.append("external_phone", owner_source.external_phone);
            }
            if (owner_source.external_email) {
                formPayload.append("external_email", owner_source.external_email);
            }
            if (owner_source.external_business_name) {
                formPayload.append("external_business_name", owner_source.external_business_name);
            }
            if (owner_source.external_document_type) {
                formPayload.append("external_document_type", owner_source.external_document_type);
            }
            if (owner_source.external_id_number) {
                formPayload.append("external_id_number", owner_source.external_id_number);
            }

            const externalDocument = files.owner_source?.external_document_file;
            if (externalDocument instanceof File) {
                formPayload.append("external_document_file", externalDocument);
            }
        }

        const imageFiles = files.property_images?.property_images || [];
        imageFiles.forEach((file) => {
            if (file instanceof File) {
                formPayload.append("property_images", file);
            }
        });

        try {
            await uploadProperty(formPayload);

            localStorage.removeItem("adminAddPropertyState");
            setFormData(ADMIN_DEFAULT_FORM_DATA);
            setFiles({ ...ADMIN_DEFAULT_FILES });
            setStep(1);
            setSubmitStatus("success");
            setShowSuccessModal(true);
            setShowFileWarning(false);
        } catch (err) {
            console.error("Admin property submit failed:", err);

            let message = "Something went wrong while submitting the property.";

            if (err?.owner_user_id?.[0]) {
                message = err.owner_user_id[0];
            } else if (err?.detail) {
                message = err.detail;
            } else if (typeof err === "string") {
                message = err;
            } else {
                try {
                    message = JSON.stringify(err);
                } catch {
                    message = "An unexpected error occurred.";
                }
            }

            setSubmitStatus("error");
            setErrorMessage(message);
            setShowErrorModal(true);
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
                owners={owners}
                ownersLoading={ownersLoading}
                activeSupportSession={activeSupportSession}
                supportSessionLoading={supportSessionLoading}
            />
        );
    };

    const progressPercent = Math.round((step / STEPS.length) * 100);

    return (
        <div className="admin-add-property-container">
            {showFileWarning && (
                <div className="popup-banner popup-warning">
                    <span>Uploaded files are not saved after refresh — please re-upload.</span>
                    <button onClick={() => setShowFileWarning(false)}>✕</button>
                </div>
            )}

            {showErrorModal && (
                <ErrorModal
                    title="Property Submission Failed"
                    message={errorMessage}
                    onClose={() => setShowErrorModal(false)}
                />
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

            {showSuccessModal && (
                <SuccessModal
                    title="Property Submitted"
                    message="The property has been submitted successfully."
                    buttonText="Done"
                    onClose={() => setShowSuccessModal(false)}
                />
            )}
        </div>
    );
};

export default AdminAddProperty;