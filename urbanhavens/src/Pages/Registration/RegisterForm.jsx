// RegisterForm.jsx
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import "./Registration.css";

const RegisterForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const accountType = location.state?.accountType || "tenant";

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    documentType: "",
    documentFile: null,
    businessName: ""
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, documentFile: e.target.files[0] });
  };
const handleSubmit = async (e) => {
  e.preventDefault();

  // Basic frontend validation
  if (formData.password !== formData.confirmPassword) {
    setErrors({ confirmPassword: "Passwords do not match" });
    return;
  }

  const data = new FormData();
  data.append("username", formData.username);
  data.append("email", formData.email);
  data.append("phone", formData.phone || ""); // optional
  data.append("password", formData.password);
  data.append("role", accountType === "landlord" ? "owner" : "tenant");

  // Only add landlord-specific fields if accountType is landlord
  if (accountType === "landlord") {
    if (formData.documentType) data.append("document_type", formData.documentType);
    if (formData.documentFile) data.append("document_file", formData.documentFile);
    if (formData.businessName) data.append("business_name", formData.businessName);
  }

  try {
    const res = await axios.post(
      "http://127.0.0.1:8000/api/users/register/",
      data,
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    const user = res.data.user;
    localStorage.setItem("username", user.username);
    localStorage.setItem("role", user.role);
    navigate("/success", { state: { accountType: user.role } });
  } catch (err) {
    console.log("Registration error:", err.response?.data);
    if (err.response?.data) setErrors(err.response.data);
  }
};
  return (
    <div className="registration-containers">
      <h2>Create your {accountType} Account</h2>
  <form onSubmit={handleSubmit} className="registration-form">

  <div className="form-row">
    <div className="input-group">
      <label>Full Name</label>
      <input type="text" name="username" placeholder="Enter full name" onChange={handleChange} />
      {errors.username && <p className="error-text">{errors.username}</p>}
    </div>

    <div className="input-group">
      <label>Email</label>
      <input type="email" name="email" placeholder="Enter email" onChange={handleChange} />
      {errors.email && <p className="error-text">{errors.email}</p>}
    </div>
  </div>

  <div className="form-row">
    <div className="input-group">
      <label>Phone Number</label>
      <input type="tel" name="phone" placeholder="Enter phone number" onChange={handleChange} />
      {errors.phone && <p className="error-text">{errors.phone}</p>}
    </div>

    <div className="input-group">
      <label>Password</label>
      <input type="password" name="password" onChange={handleChange} />
      {errors.password && <p className="error-text">{errors.password}</p>}
    </div>
  </div>

 <div className="form-row">
  <div className="input-group">
    <label>Confirm Password</label>
    <input type="password" name="confirmPassword" onChange={handleChange} />
    {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
  </div>

  <div className="input-group">
    {accountType === "landlord" ? (
      <>
        <label>Document Type</label>
        <select name="documentType" onChange={handleChange}>
          <option value="">Select Document</option>
          <option value="National ID">National ID</option>
          <option value="Passport">Passport</option>
          <option value="Driver's License">Driver's License</option>
        </select>
        {errors.documentType && <p className="error-text">{errors.documentType}</p>}
      </>
    ) : (
      <div style={{ visibility: "hidden" }}>Placeholder</div> 
      // invisible but takes up space for alignment
    )}
  </div>
</div>

<div className="form-row">
  <div className="input-group">
    {accountType === "landlord" ? (
      <>
        <label>Upload Document</label>
        <input type="file" name="documentFile" onChange={handleFileChange} />
        {errors.documentFile && <p className="error-text">{errors.documentFile}</p>}
      </>
    ) : (
      <div style={{ visibility: "hidden" }}>Placeholder</div>
    )}
  </div>

  <div className="input-group">
    {accountType === "landlord" ? (
      <>
        <label>Business / Agency Name (optional)</label>
        <input type="text" name="businessName" placeholder="Enter business name" onChange={handleChange} />
      </>
    ) : (
      <div style={{ visibility: "hidden" }}>Placeholder</div>
    )}
  </div>
</div>

  <button type="submit" className="submit-btn">Create {accountType} Account</button>  
  <p className="readyaccount">Already have an account? <Link to="/login">Sign in here</Link></p>
</form>
    </div>
  );
};

export default RegisterForm;