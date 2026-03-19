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
    <div className="registration-wrapper">
     
   {/* HERO BANNER SECTION */}
<section className="hero-banner">
  <div className="hero-overlay">
    <div className="hero-container">
      <div className="hero-left">
        <span className="small-title">PROPERTY RENTALS</span>

        <h1>
          Find Your Perfect <span>Home</span>
        </h1>

      <p>
  Select the account type that matches your role. Are you looking to rent a
  property or list and manage properties? Choose an option below to get started.
</p>
        <div className="hero-btns">
          <button className="btn-primary">Browse Properties</button>
          <button className="btn-outline">Contact Us</button>
        </div>
      </div>
    </div>
  </div>
</section>

      {/* YOUR ORIGINAL CODE STARTS HERE */}
      <div className="register-page">
        <div className="reg-head">
  
          <h2>Choose Your <span>Account Type</span></h2>
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
 <div className="important-note">
        <h3>Important Note

</h3>

<p>Property owners should register as Property Manager & Owner to access all property management features. </p>
      </div>
        <button
          className="continue-btn"
          onClick={handleContinue}
          disabled={!accountType}
        >
          Continue Registration
        </button>
      </div>
     

    </div>
  );
};

export default Registration;