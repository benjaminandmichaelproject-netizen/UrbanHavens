import React from 'react'
import "./Booking.css"
const BookingForm = () => {
    return (
        <div className='bookingForm'>
            <div className="headings">
                <h2>Interested in this property? </h2>
                <p></p>Get in touch with the landlord

                <div className="form-container">
                    <form action="">

                        <div className="input-group">
                            <label htmlFor="">Name</label> <br />
                            <input type="text" id="name" name="name" placeholder='Benjamin' />
                        </div>

                        <div className="input-group">
                            <label htmlFor="email">Email</label> <br />
                            <input type="text" id="email" name="email" placeholder='benjamin@gmail.com' />
                        </div>

                        <div className="input-group">
                            <label htmlFor="phone">Phone Number</label> <br />
                            <input type="text" id="phone" name="phone" placeholder='+254 712 345 678' />
                        </div>
                        <div className="input-group">
                            <label htmlFor="message">Message</label> <br />
                            <textarea name="message" id="message" placeholder='Enter your message here'></textarea>
                        </div>
                        
                   
                        <div className="input-group">
                            <button type="submit">Send Message</button>
                        </div>

                    </form>
                </div>


            </div>
        </div>
    )
}

export default BookingForm
