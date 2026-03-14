// Registration.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountTypeCard from "../../components/AccountType/AccountType";
import './Registration.css';

const Registration = () => {
  const [accountType, setAccountType] = useState("");
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!accountType) {
      alert("Please select an account type");
      return;
    }
    navigate("/register-form", { state: { accountType } });
  };

  return (
    <div className="register-page">
      <div className="reg-head">
        <h2>Choose Your Account Type</h2>
        <p>Select the account type that best matches your role in the rental ecosystem</p>
      </div>

      <div className="card-container">
        <AccountTypeCard
          title="Tenant"
          description="I'm Renting a Property"
          selected={accountType === "tenant"}
          onSelect={() => setAccountType("tenant")}
        />

        <AccountTypeCard
          title="Property Manager & Owner"
          description="I Own and Manage Properties"
          selected={accountType === "landlord"}
          onSelect={() => setAccountType("landlord")}
        />
      </div>

      <button
        className="continue-btn"
        onClick={handleContinue}
        disabled={!accountType}
      >
        Continue Registration
      </button>
    </div>
  );
};

export default Registration;