import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const successMessage = location.state?.message || "";

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/users/login/", formData);

      const { access, refresh, id, username, role, is_superuser } = res.data;
      const userRole = is_superuser ? "admin" : role.toLowerCase();

      localStorage.setItem("token", access);
      localStorage.setItem("refresh", refresh);
      localStorage.setItem("userId", id);
      localStorage.setItem("username", username);
      localStorage.setItem("role", userRole);

      if (userRole === "owner") navigate("/dashboard/owner");
      else if (userRole === "admin") navigate("/dashboard/admin");
      else navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Invalid credentials"
      );
    }
  };

  return (
    <div className="login-container">
      <div className="hero-banner">
        <div className="hero-overlay">
          <span className="small-title">PROPERTY RENTALS</span>
          <h1>Welcome Back</h1>
          <p>Log in to manage your properties or find your next home.</p>
        </div>
      </div>

      <div className="login-card">
        <h2>Login</h2>

        {successMessage && <p className="login-success">{successMessage}</p>}
        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="login-input">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="Enter email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="login-input">
            <label>Password</label>
            <input
              type="password"
              name="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="login-btn">Login</button>
        </form>

       <div className="reset-have-account">
         <p>
          Forgot your password?{" "}
          <span onClick={() => navigate("/forgot-password")}>Reset here</span>
        </p>
        <p>
          Don't have an account?{" "}
          <span onClick={() => navigate("/register")}>Register here</span>
        </p>
       </div>
      </div>
    </div>
  );
};

export default Login;