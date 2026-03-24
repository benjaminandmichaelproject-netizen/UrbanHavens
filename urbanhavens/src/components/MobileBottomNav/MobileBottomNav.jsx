import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FaHome, FaBell, FaUser, FaHeart } from "react-icons/fa";
import { getUnreadNotificationCount } from "../../Dashboard/Owner/UploadDetails/api/api";
import "./MobileBottomNav.css";

const MobileBottomNav = () => {
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const location = useLocation();

  const role = localStorage.getItem("role");
  const token = localStorage.getItem("token");

  let profileLink = "/login";
  let profileLabel = "Profile";

  if (token) {
    if (role === "owner") {
      profileLink = "/dashboard/owner";
      profileLabel = "Dashboard";
    } else if (role === "user" || role === "tenant") {
      profileLink = "/dashboard/tenant";
      profileLabel = "Dashboard";
    } else if (role === "admin") {
      profileLink = "/dashboard/admin";
      profileLabel = "Dashboard";
    } else {
      profileLink = "/dashboard/tenant";
      profileLabel = "Dashboard";
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setShowNav(currentScrollY <= lastScrollY);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    if (!token) {
      setNotificationCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const data = await getUnreadNotificationCount();
        setNotificationCount(data?.unread_count || 0);
      } catch {
        setNotificationCount(0);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const isHomeActive = location.pathname === "/";

  return (
    <nav className={`mobile-bottom-nav ${showNav ? "show" : "hide"}`}>
      <NavLink
        to="/favorites"
        className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
      >
        <FaHeart />
        <span>Favorites</span>
      </NavLink>

      <NavLink
        to="/notifications"
        className={({ isActive }) =>
          `nav-item notification-nav-item${isActive ? " active" : ""}`
        }
      >
        <div className="notification-icon-wrap">
          <FaBell />
          {notificationCount > 0 && (
            <span className="notification-badge">{notificationCount}</span>
          )}
        </div>
        <span>Alerts</span>
      </NavLink>

      <div className="nav-center-space" aria-hidden="true" />

      <NavLink
        to="/menu"
        className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
      >
        <FaHeart style={{ visibility: "hidden", position: "absolute" }} />
      </NavLink>

      <NavLink
        to={profileLink}
        className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
      >
        <FaUser />
        <span>{profileLabel}</span>
      </NavLink>

      <NavLink
        to="/"
        className={`nav-center-btn${isHomeActive ? " active" : ""}`}
      >
        <div className="nav-center-circle">
          <FaHome />
        </div>
        <span className="nav-center-label">Home</span>
      </NavLink>
    </nav>
  );
};

export default MobileBottomNav;