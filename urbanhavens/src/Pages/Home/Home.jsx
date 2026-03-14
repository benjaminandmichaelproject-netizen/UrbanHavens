import React from 'react'
import Hero from '../../components/Hero/Hero'
import AboutSection from '../../components/AboutSection/AboutSection'
import FeaturedRentals from '../../components/FeaturedRentals/FeaturedRentals'
import "./Home.css"
import PropertyOwnersSection from '../../components/PropertyOwnersSection/PropertyOwnersSection.jsx'
import RentalProcess from '../../components/RentalProcess/RentalProcess.jsx'

const Home = () => {
  return (
    <div>
        <Hero />
        <AboutSection />
         <FeaturedRentals />
         <PropertyOwnersSection />
         <RentalProcess/>
    </div>
  )
}

export default Home
