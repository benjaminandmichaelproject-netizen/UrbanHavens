import React from "react";
import './RentalProcess.css'
import CallToAction from "../CallToAction/CallToAction";
import TestimonialSlider from "../TestimonialSlider/TestimonialSlider";
const RentalProcess = () => {
  return (
    <section className="rental-process-section">
      <div className="rental-process-container">

        <div className="subtitle">
          <h2 >
          House Rental <span>Process</span>
        </h2>
        </div>

        <div className="process-cards">

          {/* Step 1 */}
          <div className="process-card">
            <h3 className="process-card-title">Search For A Room</h3>
            <p className="process-card-description">
              Browse available houses, hostels, and rooms to find the one that fits your needs and budget.
            </p>
            <div className="process-step-number">01</div>
          </div>

          {/* Step 2 */}
          <div className="process-card">
            <h3 className="process-card-title">Contact The Owner</h3>
            <p className="process-card-description">
              Send a message or call the landlord to ask questions and confirm availability.
            </p>
            <div className="process-step-number">02</div>
          </div>

          {/* Step 3 */}
          <div className="process-card">
            <h3 className="process-card-title">Move In</h3>
            <p className="process-card-description">
              Complete the booking process, receive confirmation, and move into your new home.
            </p>
            <div className="process-step-number">03</div>
          </div>

        </div>
<CallToAction/>
<TestimonialSlider/>
      </div>
    </section>
  );
};

export default RentalProcess;