import { useState } from "react";
import "./FeaturedRentals.css";
import RentalCard from "./RentalCard";
import AgreementModal from "../AgreementModal/AgreementModal";
import { city, city2 } from "../../assets/assets";

const FeaturedRentals = () => {

  const [selectedRental, setSelectedRental] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const rentals = [
    {
      id: 1,
      image: city,
      title: "Modern Apartment",
      beds: 2,
      bath: 1,
      price: 1200
    },
    {
      id: 2,
      image: city2,
      title: "Luxury Condo",
      beds: 3,
      bath: 2,
      price: 2200
    },
    {
      id: 3,
      image: city,
      title: "Family House",
      beds: 4,
      bath: 3,
      price: 3200
    }
  ];

  const handleBook = (rental) => {
    setSelectedRental(rental);
    setShowModal(true);
  };

  return (
    <div className="rentals-main-container">

      <div className="heading">
        <h1>Featured Rentals</h1>
        <p>Explore our handpicked selection of premium rental properties</p>
      </div>

      <div className="rentals-container">
        {rentals.map(rental => (
          <RentalCard
            key={rental.id}
            {...rental}
            onBook={() => handleBook(rental)}
          />
        ))}
      </div>

      {showModal && (
        <AgreementModal
          isOpen={showModal}
          rental={selectedRental}
          onClose={() => setShowModal(false)}
        />
      )}

    </div>
  );
};

export default FeaturedRentals;