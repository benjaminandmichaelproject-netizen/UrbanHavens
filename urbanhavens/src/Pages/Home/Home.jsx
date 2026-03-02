import React from 'react'
import Hero from '../../components/Hero/Hero'
import AboutSection from '../../components/AboutSection/AboutSection'
import FeaturedRentals from '../../components/FeaturedRentals/FeaturedRentals'
import "./Home.css"

const Home = () => {
  return (
    <div>
        <Hero />
        <AboutSection />
         <FeaturedRentals />
    </div>
  )
}

export default Home
