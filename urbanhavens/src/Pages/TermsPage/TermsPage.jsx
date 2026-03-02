import { useParams, useNavigate } from "react-router-dom";
import "./TermsPage.css";

const TermsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Example mock data (later this can come from API)
  const rentals = [
    { id: "1", title: "Modern Apartment" },
    { id: "2", title: "Luxury Condo" },
    { id: "3", title: "Family House" }
  ];

  const rental = rentals.find(item => item.id === id);

  if (!rental) {
    return <h2>Property not found</h2>;
  }

  return (
    <div className="terms-page">

      <div className="terms-container">

        <h1>Tenancy Agreement</h1>

        <h2>{rental.title}</h2>

        <div className="agreement-content">
          <h3>1. Payment Terms</h3>
          <p>
            Full rental payment must be completed before commencement of tenancy.
            Reservation is confirmed only after payment verification.
          </p>

          <h3>2. Cancellation Policy</h3>
          <p>
            Cancellations 24hrs before rental start incur a 10% fee.
            Cancellations within 24hrs incur a 40% fee.
          </p>

          <h3>3. Tenant Responsibilities</h3>
          <p>
            The tenant is responsible for damages, maintenance compliance,
            and adherence to community rules.
          </p>

          <h3>4. Prohibited Activities</h3>
          <p>
            No illegal activity, subletting, or smoking inside the property.
          </p>
        </div>

        <button
          className="continue-btn"
          onClick={() => navigate(`/details/${rental.id}`)}
        >
          Continue to Book
        </button>

      </div>
    </div>
  );
};

export default TermsPage;