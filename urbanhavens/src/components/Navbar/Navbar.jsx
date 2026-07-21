import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserCircle,
  faTachometerAlt,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";

import "./Navbar.css";
import {
  clearAuthStorage,
} from "../../Dashboard/Owner/UploadDetails/api/api";
import URBANHAVENSLOGO from "../../assets/images/URBANHAVENSLOGO.png";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopDropdownOpen, setDesktopDropdownOpen] =
    useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] =
    useState(false);

  const navigate = useNavigate();

  const role = localStorage.getItem("role");
  const dashboardPath = role
    ? `/dashboard/${role}`
    : null;

  // Clears authentication and returns the user home.
  const handleLogout = () => {
    clearAuthStorage();
    setDesktopDropdownOpen(false);
    setMobileDropdownOpen(false);
    setMenuOpen(false);
    navigate("/", { replace: true });
  };

  // Closes the mobile navigation after selecting a page.
  const closeMobileMenu = () => {
    setMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="logo">
        <Link to="/">
          <img
            src={URBANHAVENSLOGO}
            alt="UrbanHavens Logo"
          />
        </Link>
      </div>

      <ul
        className={`nav-links ${
          menuOpen ? "active" : ""
        }`}
      >
        <li>
          <Link to="/" onClick={closeMobileMenu}>
            Home
          </Link>
        </li>

        <li>
          <Link to="/about" onClick={closeMobileMenu}>
            About
          </Link>
        </li>

        <li>
          <Link to="/contact" onClick={closeMobileMenu}>
            Contact
          </Link>
        </li>

        <li>
          <Link
            to="/propertylisting"
            onClick={closeMobileMenu}
          >
            Property
          </Link>
        </li>

        {/* Desktop account dropdown */}
        <li className="account-menu desktop-account-menu">
          <button
            type="button"
            className="account-btn"
            onClick={() =>
              setDesktopDropdownOpen(
                (previous) => !previous
              )
            }
          >
            <FontAwesomeIcon icon={faUserCircle} />
            Account
          </button>

          {desktopDropdownOpen && (
            <div className="dropdown-menus">
              {!role ? (
                <>
                  <Link
                    to="/login"
                    onClick={() =>
                      setDesktopDropdownOpen(false)
                    }
                  >
                    Login
                  </Link>

                  <Link
                    to="/registration"
                    onClick={() =>
                      setDesktopDropdownOpen(false)
                    }
                  >
                    Registration
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to={dashboardPath}
                    onClick={() =>
                      setDesktopDropdownOpen(false)
                    }
                  >
                    <FontAwesomeIcon
                      icon={faTachometerAlt}
                    />
                    Dashboard
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                  >
                    <FontAwesomeIcon
                      icon={faSignOutAlt}
                    />
                    Logout
                  </button>
                </>
              )}
            </div>
          )}
        </li>
      </ul>

      {/* Mobile account and hamburger controls */}
      <div className="mobile-navbar-actions">
        <div className="mobile-account-menu">
          <button
            type="button"
            className="mobile-account-btn"
            onClick={() => {
              setMobileDropdownOpen(
                (previous) => !previous
              );
              setMenuOpen(false);
            }}
            aria-label="Open account menu"
          >
            <FontAwesomeIcon icon={faUserCircle} />
          </button>

          {mobileDropdownOpen && (
            <div className="mobile-account-dropdown">
              {!role ? (
                <>
                  <Link
                    to="/login"
                    onClick={() =>
                      setMobileDropdownOpen(false)
                    }
                  >
                    Login
                  </Link>

                  <Link
                    to="/registration"
                    onClick={() =>
                      setMobileDropdownOpen(false)
                    }
                  >
                    Registration
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to={dashboardPath}
                    onClick={() =>
                      setMobileDropdownOpen(false)
                    }
                  >
                    <FontAwesomeIcon
                      icon={faTachometerAlt}
                    />
                    Dashboard
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                  >
                    <FontAwesomeIcon
                      icon={faSignOutAlt}
                    />
                    Logout
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`menu-toggle ${
            menuOpen ? "open" : ""
          }`}
          onClick={() => {
            setMenuOpen((previous) => !previous);
            setMobileDropdownOpen(false);
          }}
          aria-label="Open navigation menu"
        >
          ☰
        </button>
      </div>
    </nav>
  );
};

export default Navbar;