import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./FeaturedRentals.css";
import RentalCard from "./RentalCard";
import AgreementModal from "../AgreementModal/AgreementModal";

const FeaturedRentals = () => {
  const navigate = useNavigate();

  const [rentals, setRentals] = useState([]); // now from backend
  const [selectedRental, setSelectedRental] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // 🔥 Fetch from Django API
useEffect(() => {
  fetch("http://127.0.0.1:8000/api/properties/")
    .then((res) => res.json())
    .then((data) => {
      console.log("Fetched Data:", data); // 👈 ADD THIS
      setRentals(data);
    })
    .catch((err) => console.error("Error fetching properties:", err));
}, []);
  const handleBook = (rental) => {
    setSelectedRental(rental);
    setShowModal(true);
  };

  const handleAccept = (rental) => {
    setShowModal(false);
    navigate(`/detail/${rental.id}`);
  };

  return (
    <div className="rentals-main-container">

      <div className="heading">
        <h1>Featured Rentals</h1>
        <p>Explore our handpicked selection of premium rental properties</p>
      </div>

      <div className="rentals-container">
        {rentals.map((rental) => (
          <RentalCard
            key={rental.id}
            {...rental}
            image={`http://127.0.0.1:8000${rental.image}`} // important for images
            onBook={() => handleBook(rental)}
          />
        ))}
      </div>

      {showModal && (
        <AgreementModal
          isOpen={showModal}
          rental={selectedRental}
          onClose={() => setShowModal(false)}
          onAccept={handleAccept}
        />
      )}

    </div>
  );
};

export default FeaturedRentals;