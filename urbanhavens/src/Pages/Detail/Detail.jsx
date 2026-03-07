import { useNavigate } from "react-router-dom";
import "./Detail.css";
import BookingForm from "../../components/BookingForm/BookingForm";
import { FaBed, FaBath, FaRulerCombined, FaHome } from "react-icons/fa";
const Detail = () => {
    const navigate = useNavigate();

    return (
        <div className="detail-container">
            <button className="back-btn" onClick={() => navigate(-1)}>
                ← Go Back
            </button>

            <div className="detail-main-container">
                <div className="detail-card">
                    <div className="detailed-images">
                        <img
                            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c"
                            alt="Luxury Apartment"
                        />

                    </div>
                    <div className="detail-info">
                        <div className="price-specs">
                            <div className="price-sp">
                                <h1>Luxury 3 Bedroom Apartment</h1>
                            <p className="price">$1,200 / month</p>
                            </div>

                            <div className="specs">

                                <div className="spec-item">
                                    <div className="spec-icon">
                                        <FaBed />
                                    </div>
                                    <span>3 Beds</span>
                                </div>

                                <div className="spec-item">
                                    <div className="spec-icon">
                                        <FaBath />
                                    </div>
                                    <span>2 Baths</span>
                                </div>

                                <div className="spec-item">
                                    <div className="spec-icon">
                                        <FaRulerCombined />
                                    </div>
                                    <span>1,500 sqft</span>
                                </div>

                                <div className="spec-item">
                                    <div className="spec-icon">
                                        <FaHome />
                                    </div>
                                    <span>Apartment</span>
                                </div>

                            </div>
                        </div>

                        <p className="description">
                            This modern luxury apartment is located in the heart of the city.
                            It offers spacious living areas, high-end finishes, 24/7 security,
                            and close proximity to shopping centers and schools.
                        </p>


                    </div>
                </div>

                <div className="detail-form">
                    <BookingForm />
                </div>
            </div>
        </div>
    );
};

export default Detail;