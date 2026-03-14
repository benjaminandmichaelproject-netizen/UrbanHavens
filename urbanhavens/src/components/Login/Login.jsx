import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(""); // clear previous error
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/users/login/", formData);

      // Destructure correct fields from backend response
      const { token, username, role, is_superuser } = res.data;

      // Determine role: superuser is admin
      const userRole = is_superuser ? "admin" : role.toLowerCase();

      // Store in localStorage for dashboard
      localStorage.setItem("token", token);
      localStorage.setItem("role", userRole);
      localStorage.setItem("username", username);

      // Redirect based on role
      if (userRole === "owner") {
        navigate("/dashboard/owner");
      } else if (userRole === "admin") {
        navigate("/dashboard/admin");
      } else {
        navigate("/");
      }

    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Invalid email or password");
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Login</h2>
        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="login-input">
            <label>Email</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
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
              onChange={handleChange}
              required
            />
          </div>

          <button className="login-btn" type="submit">
            Login
          </button>
        </form>

        <div className="login-subtext">
          <p>
            Forgot your password?{" "}
            <span
              className="forgot-password-link"
              onClick={() => navigate("/forgot-password")}
              style={{ color: "#38bdf8", cursor: "pointer" }}
            >
              Reset here
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;