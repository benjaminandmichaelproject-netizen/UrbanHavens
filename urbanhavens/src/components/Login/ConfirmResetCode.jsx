import React, { useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import "./Login.css";
const ConfirmResetCode = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://127.0.0.1:8000/api/confirm-reset-code/", { email, code });
      setError("");
      navigate("/reset-password", { state: { email } });
    } catch (err) {
      setError(err.response?.data?.error || "Invalid code");
    }
  };

  return (
    <div className="confirm-reset-container">
      <div className="confirm-card">
        <h2>Confirm Reset Code</h2>
        {error && <p className="error-text">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Reset Code</label>
            <input
              type="text"
              placeholder="Enter code sent to your email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="submit-btn">
            Confirm Code
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConfirmResetCode;