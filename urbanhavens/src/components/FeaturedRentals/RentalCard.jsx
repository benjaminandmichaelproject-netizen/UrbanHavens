const RentalCard = ({
  image,
  title,
  city,
  amenities,
  price,
  onBook,
  viewMode = "grid",
}) => {
  return (
    <div className={`rental-card ${viewMode}`}>
      <img src={image} alt={title} />

      <div className="rentals-detail">
        <h3>{title}</h3>

        <div className="rental-d">
          <p>{city}</p>
        </div>

        <div className="rental-d">
          {amenities && amenities.length > 0 ? (
            amenities.map((item, index) => (
              <p key={index}>{item}</p>
            ))
          ) : (
            <p>No amenities</p>
          )}
        </div>

        <div className="book-price">
          <p>GHS {price}/month</p>
          <button onClick={onBook}>View Details</button>
        </div>
      </div>
    </div>
  );
};

export default RentalCard;