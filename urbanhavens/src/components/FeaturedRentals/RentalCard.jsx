const RentalCard = ({ image, title, beds, bath, price, onBook }) => {
  return (
    <div className="rental-card">
      <img src={image} alt={title} />

      <div className="rentals-detail">
        <h3>{title}</h3>

        <div className="rental-d">
          <p>{beds} Beds</p>
          <p>{bath} Bath</p>
        </div>

        <div className="book-price">
          <p>${price}/month</p>
          <button onClick={onBook}>Book Now</button>
        </div>
      </div>
    </div>
  );
};

export default RentalCard;