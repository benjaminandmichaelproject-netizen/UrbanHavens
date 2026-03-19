import React, { useState } from "react";

const PersonalInfo = ({ data = {}, update, next }) => {
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    const formatted = name === "age" ? (value ? Number(value) : "") : value;
    update({ [name]: formatted });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};

    if (!data.first_name?.trim())   newErrors.first_name  = "First name is required";
    if (!data.last_name?.trim())    newErrors.last_name   = "Last name is required";
    if (!data.nationality?.trim())  newErrors.nationality = "Nationality is required";
    if (!data.gender)               newErrors.gender      = "Gender is required";

    if (!data.contact?.trim()) {
      newErrors.contact = "Contact is required";
    } else if (!/^[0-9]{9,15}$/.test(data.contact)) {
      newErrors.contact = "Enter a valid phone number (9–15 digits)";
    }

    if (!data.age) {
      newErrors.age = "Age is required";
    } else if (data.age < 18) {
      newErrors.age = "Must be at least 18";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) next();
  };

  return (
    <div className="form-section">
      <div className="sub-tile">
        <h2>Personal information</h2>
        <p>First, we need to know a little bit about you</p>
      </div>

      <div className="form-grid">
        {[
          { label: "First name",   name: "first_name",  type: "text" },
          { label: "Last name",    name: "last_name",   type: "text" },
          { label: "Contact",      name: "contact",     type: "text" },
          { label: "Nationality",  name: "nationality", type: "text" },
          { label: "Age",          name: "age",         type: "number" },
        ].map(({ label, name, type }) => (
          <div className="form-group" key={name}>
            <label>{label}</label>
            <input
              type={type}
              name={name}
              value={data[name] ?? ""}
              onChange={handleChange}
              className={errors[name] ? "error-input" : ""}
            />
            {errors[name] && <span className="error-text">{errors[name]}</span>}
          </div>
        ))}

        <div className="form-group">
          <label>Gender</label>
          <select
            name="gender"
            value={data.gender ?? ""}
            onChange={handleChange}
            className={errors.gender ? "error-input" : ""}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {errors.gender && <span className="error-text">{errors.gender}</span>}
        </div>
      </div>

      <div className="form-actions">
        <button onClick={handleNext} className="nxt-btn">Next</button>
      </div>
    </div>
  );
};

export default PersonalInfo;
