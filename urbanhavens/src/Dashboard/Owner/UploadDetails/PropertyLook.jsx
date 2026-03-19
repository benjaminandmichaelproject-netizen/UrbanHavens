import React, { useState, useEffect, useRef } from "react";

const MAX_IMAGES = 6;

// files = { property_images: File[] }  — passed from Uploadpage as files[key]
// setFile("property_images", File[])   — calls updateFile(section, key, file)
const PropertyLook = ({ files = {}, setFile, next, prev }) => {
  const [error, setError]     = useState("");
  const [previews, setPreviews] = useState([]);
  const inputRef              = useRef(null);

  const images = Array.isArray(files.property_images) ? files.property_images : [];

  // Rebuild ALL preview URLs only when images array changes
  useEffect(() => {
    const urls = images.map((f) => (f instanceof File ? URL.createObjectURL(f) : null));
    setPreviews(urls);
    return () => urls.forEach((url) => url && URL.revokeObjectURL(url));
  }, [images]);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).filter((f) => f instanceof File);
    if (!selected.length) return;

    const slots     = MAX_IMAGES - images.length;
    const incoming  = selected.slice(0, slots);
    const updated   = [...images, ...incoming];

    setFile("property_images", updated);   // ✅ 2 args: key + value
    setError("");

    // Reset input so the same file(s) can be re-selected if removed
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeImage = (index) => {
    const updated = images.filter((_, i) => i !== index);
    setFile("property_images", updated);
  };

  const handleNext = () => {
    if (!images.length) {
      setError("Upload at least 1 image");
      return;
    }
    setError("");
    next();
  };

  const remaining = MAX_IMAGES - images.length;

  return (
    <div className="form-section">
      <div className="form-group">
        <label>Property Images (max {MAX_IMAGES})</label>

        {remaining > 0 && (
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
          />
        )}

        {remaining === 0 && (
          <p className="error-text">Maximum {MAX_IMAGES} images reached.</p>
        )}
      </div>

      {error && <div className="custom-alert"><p>{error}</p></div>}

      <div className="image-preview-grid">
        {previews.map((url, i) =>
          url ? (
            <div key={i} className="image-preview">
              <img src={url} alt={`Property image ${i + 1}`} />
              <button
                className="remove-btn"
                onClick={() => removeImage(i)}
                aria-label={`Remove image ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ) : null
        )}
      </div>

      <div className="form-actions-row">
        <button className="prv-btn" onClick={prev}>Previous</button>
        <button className="nxt-btn" onClick={handleNext}>Next</button>
      </div>
    </div>
  );
};

export default PropertyLook;
