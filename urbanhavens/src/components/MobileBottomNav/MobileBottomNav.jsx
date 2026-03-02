import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FaHome, FaBell, FaUser, FaHeart } from "react-icons/fa";
import "./MobileBottomNav.css";

const MobileBottomNav = () => {
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY) {
        // scrolling down
        setShowNav(false);
      } else {
        // scrolling up
        setShowNav(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  return (
    <div className={`mobile-bottom-nav ${showNav ? "show" : "hide"}`}>
      <NavLink to="/" className="nav-item">
        <FaHome />
        <span>Home</span>
      </NavLink>

      <NavLink to="/favorites" className="nav-item">
        <FaHeart />
        <span>Favorites</span>
      </NavLink>

      <NavLink to="/notifications" className="nav-item">
        <FaBell />
        <span>Notifications</span>
      </NavLink>

      <NavLink to="/profile" className="nav-item">
        <FaUser />
        <span>Profile</span>
      </NavLink>
    </div>
  );
};

export default MobileBottomNav;