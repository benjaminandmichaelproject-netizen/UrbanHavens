import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MobileBottomNav from "./components/MobileBottomNav/MobileBottomNav";
import Navbar from './Components/Navbar/Navbar.jsx';
import Home from './Pages/Home/Home.jsx';
import Contact from './Pages/Contact';
import About from './Pages/About/About.jsx';
import Login from './Pages/Login';
import Register from './Pages/Register';
import TermsPage from './Pages/TermsPage/TermsPage';
import FavoritesPage from "./Pages/Favorites/FavoritesPage.jsx";
import './App.css';

const App = () => {
  return (
    <div>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/terms/:id" element={<TermsPage />} />
        <Route path="/favorites" element={<FavoritesPage />} /> {/* ✅ FIXED */}
      </Routes>

      <MobileBottomNav />
    </div>
  );
};

export default App;