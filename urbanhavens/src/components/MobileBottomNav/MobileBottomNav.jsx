import { useState, useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { FaHome, FaBell, FaUser, FaHeart } from "react-icons/fa";
import "./MobileBottomNav.css";

const MobileBottomNav = () => {
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const role = localStorage.getItem("role");
  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");

  const [notifications] = useState([
    {
      id: 1,
      type: "booking",
      is_read: false,
    },
    {
      id: 2,
      type: "booking",
      is_read: false,
    },
    {
      id: 3,
      type: "meeting",
      is_read: true,
    },
  ]);

  const notificationCount = useMemo(() => {
    if (role === "owner") {
      return notifications.filter(
        (item) => item.type === "booking" && !item.is_read
      ).length;
    }

    return notifications.filter(
      (item) => item.type === "meeting" && !item.is_read
    ).length;
  }, [notifications, role]);

  let profileLink = "/login";
  let label = "Profile";

  if (token) {
    if (role === "owner") {
      profileLink = `/landlord/${userId}`;
      label = "Profile";
    } else {
      profileLink = "/dashboard/user";
      label = "Dashboard";
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY) {
        setShowNav(false);
      } else {
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

      <NavLink to="/notifications" className="nav-item notification-nav-item">
        <div className="notification-icon-wrap">
          <FaBell />
          {notificationCount > 0 && (
            <span className="notification-badge">{notificationCount}</span>
          )}
        </div>
        <span>Notifications</span>
      </NavLink>

      <NavLink to={profileLink} className="nav-item">
        <FaUser />
        <span>{label}</span>
      </NavLink>
    </div>
  );
};

export default MobileBottomNav;