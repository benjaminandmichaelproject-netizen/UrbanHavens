import React, { useState, useEffect, useCallback } from "react";
import {
  FaGraduationCap,
  FaPlus,
  FaSearch,
  FaTimes,
  FaPen,
  FaTrash,
  FaExclamationTriangle,
  FaCheckCircle,
} from "react-icons/fa";
import {
  getAllSchoolsAdmin,
  createSchool,
  updateSchool,
  deleteSchool,
} from "../../Owner/UploadDetails/api/api";
import "./SchoolsRegion.css";
/* Region options shown in the filter and form select */
const REGION_OPTIONS = [
  { value: "ahafo", label: "Ahafo" },
  { value: "ashanti", label: "Ashanti" },
  { value: "bono", label: "Bono" },
  { value: "bono_east", label: "Bono East" },
  { value: "central", label: "Central" },
  { value: "eastern", label: "Eastern" },
  { value: "greater_accra", label: "Greater Accra" },
  { value: "north_east", label: "North East" },
  { value: "northern", label: "Northern" },
  { value: "oti", label: "Oti" },
  { value: "savannah", label: "Savannah" },
  { value: "upper_east", label: "Upper East" },
  { value: "upper_west", label: "Upper West" },
  { value: "volta", label: "Volta" },
  { value: "western", label: "Western" },
  { value: "western_north", label: "Western North" },
];;

/* Convert stored region value into readable text */
const getRegionLabel = (value) =>
  REGION_OPTIONS.find((region) => region.value === value)?.label ??
  value?.replace(/_/g, " ") ??
  "—";

/* Default form values */
const EMPTY_FORM = {
  name: "",
  city: "",
  region: "",
  is_active: true,
};

export default function SchoolsRegion() {
  /* Main school list state */
  const [schools, setSchools] = useState([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState(null);

  /* Filter state */
  const [searchText, setSearchText] = useState("");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

  /* Modal and form state */
  const [activeModalType, setActiveModalType] = useState(null); // null | add | edit | delete
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolForm, setSchoolForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  /* Toast state */
  const [toastMessage, setToastMessage] = useState(null); // { type, text }

  /* Load all schools for admin table */
  const loadSchools = useCallback(async () => {
    setIsLoadingSchools(true);
    setLoadErrorMessage(null);

    try {
      const response = await getAllSchoolsAdmin();
      setSchools(Array.isArray(response) ? response : response.results ?? []);
    } catch (error) {
      console.error("Failed to load schools:", error);
      setLoadErrorMessage("Failed to load schools. Please try again.");
    } finally {
      setIsLoadingSchools(false);
    }
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  /* Auto-dismiss toast after a few seconds */
  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  /* Filter visible table rows */
  const filteredSchools = schools.filter((school) => {
    const matchesSearch =
      !searchText ||
      school.name.toLowerCase().includes(searchText.toLowerCase()) ||
      school.city.toLowerCase().includes(searchText.toLowerCase());

    const matchesRegion =
      !selectedRegionFilter || school.region === selectedRegionFilter;

    const matchesStatus =
      selectedStatusFilter === "all"
        ? true
        : selectedStatusFilter === "active"
        ? school.is_active
        : !school.is_active;

    return matchesSearch && matchesRegion && matchesStatus;
  });

  /* Open add modal */
  const openAddSchoolModal = () => {
    setSchoolForm(EMPTY_FORM);
    setFormErrors({});
    setSelectedSchool(null);
    setActiveModalType("add");
  };

  /* Open edit modal */
  const openEditSchoolModal = (school) => {
    setSchoolForm({
      name: school.name,
      city: school.city,
      region: school.region,
      is_active: school.is_active,
    });
    setFormErrors({});
    setSelectedSchool(school);
    setActiveModalType("edit");
  };

  /* Open delete modal */
  const openDeleteSchoolModal = (school) => {
    setSelectedSchool(school);
    setActiveModalType("delete");
  };

  /* Close any modal */
  const closeModal = () => {
    setActiveModalType(null);
    setSelectedSchool(null);
    setFormErrors({});
  };

  /* Validate form before submit */
  const validateSchoolForm = () => {
    const errors = {};

    if (!schoolForm.name.trim()) {
      errors.name = "School name is required";
    }

    if (!schoolForm.city.trim()) {
      errors.city = "City is required";
    }

    if (!schoolForm.region) {
      errors.region = "Region is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* Create or update school */
  const handleSchoolFormSubmit = async () => {
    if (!validateSchoolForm()) return;

    setIsSubmittingForm(true);

    try {
      if (activeModalType === "add") {
        const createdSchool = await createSchool(schoolForm);

        setSchools((previousSchools) =>
          [...previousSchools, createdSchool].sort((firstSchool, secondSchool) =>
            firstSchool.name.localeCompare(secondSchool.name)
          )
        );

        setToastMessage({
          type: "success",
          text: `"${createdSchool.name}" added successfully.`,
        });
      } else if (activeModalType === "edit" && selectedSchool) {
        const updatedSchool = await updateSchool(selectedSchool.id, schoolForm);

        setSchools((previousSchools) =>
          previousSchools.map((school) =>
            school.id === updatedSchool.id ? updatedSchool : school
          )
        );

        setToastMessage({
          type: "success",
          text: `"${updatedSchool.name}" updated successfully.`,
        });
      }

      closeModal();
    } catch (error) {
      console.error("Failed to save school:", error);
      setToastMessage({
        type: "error",
        text: "Save failed. Check your admin access and try again.",
      });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  /* Delete school */
  const handleDeleteSchool = async () => {
    if (!selectedSchool) return;

    setIsSubmittingForm(true);

    try {
      await deleteSchool(selectedSchool.id);

      setSchools((previousSchools) =>
        previousSchools.filter((school) => school.id !== selectedSchool.id)
      );

      setToastMessage({
        type: "success",
        text: `"${selectedSchool.name}" deleted successfully.`,
      });

      closeModal();
    } catch (error) {
      console.error("Failed to delete school:", error);
      setToastMessage({
        type: "error",
        text: "Delete failed. Please try again.",
      });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  /* Quick active/inactive toggle */
  const handleToggleSchoolStatus = async (school) => {
    try {
      const updatedSchool = await updateSchool(school.id, {
        is_active: !school.is_active,
      });

      setSchools((previousSchools) =>
        previousSchools.map((currentSchool) =>
          currentSchool.id === updatedSchool.id ? updatedSchool : currentSchool
        )
      );

      setToastMessage({
        type: "success",
        text: `"${updatedSchool.name}" is now ${
          updatedSchool.is_active ? "active" : "inactive"
        }.`,
      });
    } catch (error) {
      console.error("Failed to toggle school status:", error);
      setToastMessage({
        type: "error",
        text: "Status update failed.",
      });
    }
  };

  /* Dashboard summary values */
  const totalSchoolsCount = schools.length;
  const activeSchoolsCount = schools.filter((school) => school.is_active).length;
  const inactiveSchoolsCount = totalSchoolsCount - activeSchoolsCount;
  const uniqueRegionsCount = new Set(schools.map((school) => school.region)).size;

  return (
    <>
      <div className="schools-region-page">
        <div className="schools-region-header">
          <div className="schools-region-header-content">
            <div className="schools-region-header-icon">
              <FaGraduationCap />
            </div>

            <div>
              <h1 className="schools-region-title">Schools and Regions</h1>
              <p className="schools-region-subtitle">
                Manage universities and institutions listed on the platform
              </p>
            </div>
          </div>

          <button
            type="button"
            className="schools-region-add-button"
            onClick={openAddSchoolModal}
          >
            <FaPlus />
            <span>Add School</span>
          </button>
        </div>

        <div className="schools-region-statistics-grid">
          <div className="schools-region-statistics-card">
            <span className="schools-region-statistics-number">
              {totalSchoolsCount}
            </span>
            <span className="schools-region-statistics-label">
              Total Schools
            </span>
          </div>

          <div className="schools-region-statistics-card schools-region-statistics-card-active">
            <span className="schools-region-statistics-number">
              {activeSchoolsCount}
            </span>
            <span className="schools-region-statistics-label">Active</span>
          </div>

          <div className="schools-region-statistics-card schools-region-statistics-card-inactive">
            <span className="schools-region-statistics-number">
              {inactiveSchoolsCount}
            </span>
            <span className="schools-region-statistics-label">Inactive</span>
          </div>

          <div className="schools-region-statistics-card schools-region-statistics-card-region">
            <span className="schools-region-statistics-number">
              {uniqueRegionsCount}
            </span>
            <span className="schools-region-statistics-label">Regions</span>
          </div>
        </div>

        <div className="schools-region-filter-bar">
          <div className="schools-region-search-wrapper">
            <span className="schools-region-search-icon">
              <FaSearch />
            </span>

            <input
              type="text"
              className="schools-region-search-input"
              placeholder="Search by school name or city..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />

            {searchText && (
              <button
                type="button"
                className="schools-region-search-clear-button"
                onClick={() => setSearchText("")}
              >
                <FaTimes />
              </button>
            )}
          </div>

          <select
            className="schools-region-select"
            value={selectedRegionFilter}
            onChange={(event) => setSelectedRegionFilter(event.target.value)}
          >
            <option value="">All Regions</option>
            {REGION_OPTIONS.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>

          <div className="schools-region-status-filter-group">
            {["all", "active", "inactive"].map((statusValue) => (
              <button
                key={statusValue}
                type="button"
                className={`schools-region-status-filter-button ${
                  selectedStatusFilter === statusValue
                    ? "schools-region-status-filter-button-active"
                    : ""
                }`}
                onClick={() => setSelectedStatusFilter(statusValue)}
              >
                {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="schools-region-table-container">
          {isLoadingSchools ? (
            <div className="schools-region-empty-state">
              <div className="schools-region-loading-spinner" />
              <p>Loading schools...</p>
            </div>
          ) : loadErrorMessage ? (
            <div className="schools-region-empty-state schools-region-empty-state-error">
              <FaExclamationTriangle className="schools-region-empty-state-icon" />
              <p>{loadErrorMessage}</p>
              <button
                type="button"
                className="schools-region-retry-button"
                onClick={loadSchools}
              >
                Retry
              </button>
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="schools-region-empty-state">
              <FaGraduationCap className="schools-region-empty-state-icon schools-region-empty-state-icon-muted" />
              <p>
                {schools.length === 0
                  ? "No schools added yet."
                  : "No schools match your current filters."}
              </p>
            </div>
          ) : (
            <table className="schools-region-table">
              <thead>
                <tr>
                  <th>School Name</th>
                  <th>City</th>
                  <th>Region</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredSchools.map((school) => (
                  <tr
                    key={school.id}
                    className={
                      !school.is_active
                        ? "schools-region-table-row-inactive"
                        : ""
                    }
                  >
                    <td className="schools-region-school-name-cell">
                      <span
                        className="schools-region-school-status-dot"
                        data-active={school.is_active}
                      />
                      {school.name}
                    </td>

                    <td>{school.city}</td>

                    <td>
                      <span className="schools-region-region-badge">
                        {getRegionLabel(school.region)}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={`schools-region-status-button ${
                          school.is_active
                            ? "schools-region-status-button-active"
                            : "schools-region-status-button-inactive"
                        }`}
                        onClick={() => handleToggleSchoolStatus(school)}
                        title="Click to toggle school status"
                      >
                        {school.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>

                    <td>
                      <div className="schools-region-action-buttons">
                        <button
                          type="button"
                          className="schools-region-action-button schools-region-action-button-edit"
                          onClick={() => openEditSchoolModal(school)}
                        >
                          <FaPen />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          className="schools-region-action-button schools-region-action-button-delete"
                          onClick={() => openDeleteSchoolModal(school)}
                        >
                          <FaTrash />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="schools-region-count-text">
          {!isLoadingSchools &&
            !loadErrorMessage &&
            `Showing ${filteredSchools.length} of ${schools.length} schools`}
        </p>
      </div>

      {(activeModalType === "add" || activeModalType === "edit") && (
        <div className="schools-region-modal-backdrop" onClick={closeModal}>
          <div
            className="schools-region-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="schools-region-modal-header">
              <h2>
                {activeModalType === "add" ? "Add New School" : "Edit School"}
              </h2>

              <button
                type="button"
                className="schools-region-modal-close-button"
                onClick={closeModal}
              >
                <FaTimes />
              </button>
            </div>

            <div className="schools-region-modal-body">
              <div className="schools-region-form-field">
                <label>
                  School or University Name{" "}
                  <span className="schools-region-required-mark">*</span>
                </label>
                <input
                  type="text"
                  className={`schools-region-form-input ${
                    formErrors.name ? "schools-region-form-input-error" : ""
                  }`}
                  placeholder="e.g. University of Ghana"
                  value={schoolForm.name}
                  onChange={(event) => {
                    setSchoolForm((previousForm) => ({
                      ...previousForm,
                      name: event.target.value,
                    }));
                    setFormErrors((previousErrors) => ({
                      ...previousErrors,
                      name: "",
                    }));
                  }}
                />
                {formErrors.name && (
                  <span className="schools-region-form-error-text">
                    {formErrors.name}
                  </span>
                )}
              </div>

              <div className="schools-region-form-field">
                <label>
                  City <span className="schools-region-required-mark">*</span>
                </label>
                <input
                  type="text"
                  className={`schools-region-form-input ${
                    formErrors.city ? "schools-region-form-input-error" : ""
                  }`}
                  placeholder="e.g. Accra"
                  value={schoolForm.city}
                  onChange={(event) => {
                    setSchoolForm((previousForm) => ({
                      ...previousForm,
                      city: event.target.value,
                    }));
                    setFormErrors((previousErrors) => ({
                      ...previousErrors,
                      city: "",
                    }));
                  }}
                />
                {formErrors.city && (
                  <span className="schools-region-form-error-text">
                    {formErrors.city}
                  </span>
                )}
              </div>

              <div className="schools-region-form-field">
                <label>
                  Region <span className="schools-region-required-mark">*</span>
                </label>
                <select
                  className={`schools-region-form-input ${
                    formErrors.region ? "schools-region-form-input-error" : ""
                  }`}
                  value={schoolForm.region}
                  onChange={(event) => {
                    setSchoolForm((previousForm) => ({
                      ...previousForm,
                      region: event.target.value,
                    }));
                    setFormErrors((previousErrors) => ({
                      ...previousErrors,
                      region: "",
                    }));
                  }}
                >
                  <option value="">Select a region</option>
                  {REGION_OPTIONS.map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
                {formErrors.region && (
                  <span className="schools-region-form-error-text">
                    {formErrors.region}
                  </span>
                )}
              </div>

              <div className="schools-region-form-field schools-region-form-field-row">
                <label className="schools-region-checkbox-label">
                  <input
                    type="checkbox"
                    checked={schoolForm.is_active}
                    onChange={(event) =>
                      setSchoolForm((previousForm) => ({
                        ...previousForm,
                        is_active: event.target.checked,
                      }))
                    }
                  />
                  <span>Active (visible in search and filters)</span>
                </label>
              </div>
            </div>

            <div className="schools-region-modal-footer">
              <button
                type="button"
                className="schools-region-cancel-button"
                onClick={closeModal}
                disabled={isSubmittingForm}
              >
                Cancel
              </button>

              <button
                type="button"
                className="schools-region-save-button"
                onClick={handleSchoolFormSubmit}
                disabled={isSubmittingForm}
              >
                {isSubmittingForm
                  ? "Saving..."
                  : activeModalType === "add"
                  ? "Add School"
                  : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModalType === "delete" && selectedSchool && (
        <div className="schools-region-modal-backdrop" onClick={closeModal}>
          <div
            className="schools-region-modal schools-region-modal-small"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="schools-region-modal-header schools-region-modal-header-danger">
              <h2>Delete School</h2>

              <button
                type="button"
                className="schools-region-modal-close-button"
                onClick={closeModal}
              >
                <FaTimes />
              </button>
            </div>

            <div className="schools-region-modal-body">
              <p className="schools-region-delete-message">
                Are you sure you want to delete{" "}
                <strong>{selectedSchool.name}</strong>? Properties linked to this
                school will lose the reference. This action cannot be undone.
              </p>
            </div>

            <div className="schools-region-modal-footer">
              <button
                type="button"
                className="schools-region-cancel-button"
                onClick={closeModal}
                disabled={isSubmittingForm}
              >
                Cancel
              </button>

              <button
                type="button"
                className="schools-region-delete-confirm-button"
                onClick={handleDeleteSchool}
                disabled={isSubmittingForm}
              >
                {isSubmittingForm ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          className={`schools-region-toast ${
            toastMessage.type === "success"
              ? "schools-region-toast-success"
              : "schools-region-toast-error"
          }`}
        >
          {toastMessage.type === "success" ? (
            <FaCheckCircle className="schools-region-toast-icon" />
          ) : (
            <FaExclamationTriangle className="schools-region-toast-icon" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </>
  );
}