import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import './TestimonialSlider.css'

const testimonials = [
  {
    name: "Kwame Adom",
    role: "Property Owner",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    review:
      "The platform helped me rent out my apartment quickly. The tenants were verified and the process was smooth.",
  },
  {
    name: "Ama Owusu",
    role: "Tenant",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    review:
      "Finding a room in Accra was so easy. I contacted the landlord directly and moved in within a week.",
  },
  {
    name: "Kofi Mensah",
    role: "Property Owner",
    image: "https://randomuser.me/api/portraits/men/12.jpg",
    review:
      "Listing my property took just minutes and I received multiple inquiries almost immediately.",
  },
  {
    name: "Akosua Boateng",
    role: "Tenant",
    image: "https://randomuser.me/api/portraits/women/65.jpg",
    review:
      "Very reliable platform. I found a safe and affordable hostel close to my university.",
  },
];

const TestimonialSlider = () => {
  return (
 <div className="testi">
   <section className="testimonial-section">
      <div className="testimonial-container">

        <p className="testimonial-label">TESTIMONIALS</p>

        <h2 className="testimonial-title">
          What Our <span>Customers Say</span>
        </h2>

        <Swiper
          modules={[Navigation, Pagination, Autoplay]}
          spaceBetween={30}
          slidesPerView={3}
          navigation
          pagination={{ clickable: true }}
          autoplay={{ delay: 4000 }}
          breakpoints={{
            320: { slidesPerView: 1 },
            768: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
          }}
        >
          {testimonials.map((item, index) => (
            <SwiperSlide key={index}>
              <div className="testimonial-card">

                <div className="quote">“</div>

                <p className="testimonial-text">{item.review}</p>

                <div className="testimonial-user">
                  <img src={item.image} alt={item.name} />

                  <div>
                    <h4>{item.name}</h4>
                    <p>{item.role}</p>

                    <div className="stars">
                      ⭐⭐⭐⭐⭐
                    </div>
                  </div>
                </div>

              </div>
            </SwiperSlide>
          ))}
        </Swiper>

      </div>
    </section>


 </div>
  );
};

export default TestimonialSlider;