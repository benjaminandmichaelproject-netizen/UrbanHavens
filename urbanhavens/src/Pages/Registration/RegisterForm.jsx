import { useLocation, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import "./Registration.css";

const RegisterForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const accountType = location.state?.accountType || "tenant";

  const [formData, setFormData] = useState({
    firstName: "",
    surname: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    idType: "",
    idNumber: "",
    idFile: null
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, idFile: e.target.files[0] });
    setErrors({ ...errors, idFile: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required!";
    if (!formData.surname.trim()) newErrors.surname = "Surname is required!";
    if (!formData.email.trim()) newErrors.email = "Email is required!";
    if (!formData.password) newErrors.password = "Password is required!";
    if (!formData.confirmPassword) newErrors.confirmPassword = "Confirm your password!";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match!";
    }

    if (accountType === "landlord") {
      if (!formData.businessName.trim()) newErrors.businessName = "Business name is required!";
      if (!formData.idType) newErrors.idType = "Select ID type!";
      if (!formData.idNumber.trim()) newErrors.idNumber = "ID number is required!";
      if (!formData.idFile) newErrors.idFile = "Upload your ID document!";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const data = new FormData();
    data.append("first_name", formData.firstName);
    data.append("last_name", formData.surname);
    data.append("email", formData.email);
    data.append("phone", formData.phone || "");
    data.append("password", formData.password);
    data.append("confirm_password", formData.confirmPassword);
    data.append("role", accountType === "landlord" ? "owner" : "tenant");

    if (accountType === "landlord") {
      data.append("business_name", formData.businessName);
      data.append("document_type", formData.idType);
      data.append("id_number", formData.idNumber);
      data.append("document_file", formData.idFile);
    }

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/api/users/register/",
        data,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );

      const user = res.data.user;

      localStorage.removeItem("token");
      localStorage.setItem("username", user.username || "");
      localStorage.setItem("role", user.role || "");

      navigate("/login", {
        state: {
          message: "Account created successfully. Please log in."
        }
      });
    } catch (err) {
      console.error(err.response?.data);

      if (err.response?.data) {
        const backendErrors = {};

        Object.keys(err.response.data).forEach((key) => {
          const value = err.response.data[key];
          backendErrors[key] = Array.isArray(value) ? value[0] : value;
        });

        setErrors(backendErrors);
      }
    }
  };

  return (
    <div className="login-container">
      <section className="hero-banner">
        <div className="hero-overlay">
          <span className="small-title">PROPERTY RENTALS</span>
          <h2>Create your {accountType} Account</h2>
        </div>
      </section>

      <div className="login-card" style={{ maxWidth: "800px", marginTop: "-60px" }}>
        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-row">
            <div className="input-group">
              <label>First Name</label>
              <input name="firstName" value={formData.firstName} onChange={handleChange} />
              {errors.firstName && <p className="error-text">{errors.firstName}</p>}
            </div>

            <div className="input-group">
              <label>Surname</label>
              <input name="surname" value={formData.surname} onChange={handleChange} />
              {errors.surname && <p className="error-text">{errors.surname}</p>}
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} />
              {errors.email && <p className="error-text">{errors.email}</p>}
            </div>

            <div className="input-group">
              <label>Phone</label>
              <input name="phone" value={formData.phone} onChange={handleChange} />
              {errors.phone && <p className="error-text">{errors.phone}</p>}
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} />
              {errors.password && <p className="error-text">{errors.password}</p>}
            </div>

            <div className="input-group">
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
            </div>
          </div>

          {accountType === "landlord" && (
            <>
              <div className="form-row">
                <div className="input-group">
                  <label>Business Name</label>
                  <input name="businessName" value={formData.businessName} onChange={handleChange} />
                  {(errors.businessName || errors.business_name) && (
                    <p className="error-text">{errors.businessName || errors.business_name}</p>
                  )}
                </div>

                <div className="input-group">
                  <label>ID Type</label>
                  <select name="idType" value={formData.idType} onChange={handleChange}>
                    <option value="">Select ID</option>
                    <option value="Ghana Card">Ghana Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Driver License">Driver License</option>
                  </select>
                  {(errors.idType || errors.document_type) && (
                    <p className="error-text">{errors.idType || errors.document_type}</p>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label>ID Number</label>
                  <input name="idNumber" value={formData.idNumber} onChange={handleChange} />
                  {(errors.idNumber || errors.id_number) && (
                    <p className="error-text">{errors.idNumber || errors.id_number}</p>
                  )}
                </div>

                <div className="input-group">
                  <label>Upload ID</label>
                  <input type="file" onChange={handleFileChange} />
                  {(errors.idFile || errors.document_file) && (
                    <p className="error-text">{errors.idFile || errors.document_file}</p>
                  )}
                </div>
              </div>
            </>
          )}

          <button className="login-btn" type="submit">
            Create Account
          </button>

          <p className="readyaccount">
            Already have an account? <Link to="/login">Sign in here</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm;