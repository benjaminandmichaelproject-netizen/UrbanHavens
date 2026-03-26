import React from 'react'
import Hero from '../../components/Hero/Hero'
import AboutSection from '../../components/AboutSection/AboutSection'
import FeaturedRentals from '../../components/FeaturedRentals/FeaturedRentals'
import "./Home.css"
import PropertyOwnersSection from '../../components/PropertyOwnersSection/PropertyOwnersSection.jsx'
import RentalProcess from '../../components/RentalProcess/RentalProcess.jsx'
import Footer from '../../components/Footer/Footer.jsx'
import TestimonialSlider from '../../components/TestimonialSlider/TestimonialSlider.jsx'
const Home = () => {
  return (
    <div>
        <Hero />
         <FeaturedRentals />
        <AboutSection />
        
         <PropertyOwnersSection />
         <RentalProcess/>

             <TestimonialSlider/>
         <Footer/>
    </div>
  )
}

export default Home
