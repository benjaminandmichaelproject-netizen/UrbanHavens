const RentalCard = ({ image, title, city, amenities, price, onBook }) => {
  return (
    <div className="rental-card">
      <img src={image} alt={title} />

      <div className="rentals-detail">
        <h3>{title}</h3>

        {/* Location */}
        <div className="rental-d">
          <p>{city}</p>
        </div>

        {/* Amenities */}
        <div className="rental-d">
          {amenities && amenities.length > 0 ? (
            amenities.map((item, index) => (
              <p key={index}>{item}</p>
            ))
          ) : (
            <p>No amenities</p>
          )}
        </div>

        {/* Price + Button */}
        <div className="book-price">
          <p>GHS {price}/month</p>
        <button onClick={onBook}>Book Now</button>
        </div>
      </div>
    </div>
  );
};

export default RentalCard;