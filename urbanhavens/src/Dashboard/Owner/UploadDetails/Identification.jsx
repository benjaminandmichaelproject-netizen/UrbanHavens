import React, { useState, useEffect, useRef } from "react";

// files = { id_image: File | null }
// setFile("id_image", file) — matches Uploadpage's updateFile(section, key, file)
const Identification = ({ data = {}, files = {}, setFile, update, next, prev }) => {
  const [errors, setErrors]   = useState({});
  const [preview, setPreview] = useState(null);
  const fileInputRef          = useRef(null);

  // Revoke previous object URL to avoid memory leaks
  useEffect(() => {
    if (files.id_image instanceof File) {
      const url = URL.createObjectURL(files.id_image);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [files.id_image]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    update({ [name]: value });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile("id_image", selected);
      setErrors((prev) => ({ ...prev, id_image: "" }));
    }
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setFile("id_image", null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNext = () => {
    const newErrors = {};
    if (!data.id_type)         newErrors.id_type  = "ID type is required";
    if (!data.id_number?.trim()) newErrors.id_number = "ID number is required";
    if (!(files.id_image instanceof File)) newErrors.id_image = "ID image is required";

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) next();
  };

  return (
    <div className="form-section">
      <h2>Identification</h2>

      <div className="form-grid">
        <div className="form-group">
          <label>ID Type</label>
          <select
            name="id_type"
            value={data.id_type ?? ""}
            onChange={handleChange}
            className={errors.id_type ? "error-input" : ""}
          >
            <option value="">Select ID type</option>
            <option value="Ghana card">Ghana card</option>
            <option value="Passport">Passport</option>
            <option value="Voters ID">Voters ID</option>
          </select>
          {errors.id_type && <span className="error-text">{errors.id_type}</span>}
        </div>

        <div className="form-group">
          <label>ID Number</label>
          <input
            type="text"
            name="id_number"
            value={data.id_number ?? ""}
            onChange={handleChange}
            className={errors.id_number ? "error-input" : ""}
          />
          {errors.id_number && <span className="error-text">{errors.id_number}</span>}
        </div>
      </div>

      <div className="upload-section">
        <label>ID Image</label>
        <div
          className={`upload-box ${errors.id_image ? "upload-box--error" : ""}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            hidden
            accept="image/*"
            onChange={handleFileChange}
          />

          {preview ? (
            <div className="preview-wrapper">
              <img src={preview} alt="ID preview" className="preview-img" />
              <button className="remove-btn" onClick={removeFile} aria-label="Remove image">✕</button>
            </div>
          ) : (
            <div className="upload-label">Drag & Drop or Browse</div>
          )}
        </div>
        {errors.id_image && <span className="error-text">{errors.id_image}</span>}
      </div>

      <div className="form-actions-row">
        <button onClick={prev} className="prv-btn">Previous</button>
        <button onClick={handleNext} className="nxt-btn">Next</button>
      </div>
    </div>
  );
};

export default Identification;
