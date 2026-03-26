import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserCircle, faTachometerAlt, faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import { clearAuthStorage } from "../../Dashboard/Owner/UploadDetails/api/api";
const Navbar = () => {

  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navigate = useNavigate();

  const role = localStorage.getItem("role");
  const dashboardPath = role ? `/dashboard/${role}` : null;
const handleLogout = () => {
  clearAuthStorage();
  setDropdownOpen(false);
  setMenuOpen(false);
  navigate("/", { replace: true });
};
  return (
    <nav className="navbar">

      <div className="logo">
        <h2>UrbanHavens</h2>
      </div>

      <ul className={`nav-links ${menuOpen ? "active" : ""}`}>
        <li><Link to="/" onClick={() => setMenuOpen(false)}>Home</Link></li>
        <li><Link to="/about" onClick={() => setMenuOpen(false)}>About</Link></li>
        <li><Link to="/contact" onClick={() => setMenuOpen(false)}>Contact</Link></li>
        <li><Link to="/propertylisting" onClick={() => setMenuOpen(false)}>Property</Link></li>

        {/* ACCOUNT DROPDOWN */}
        <li className="account-menu">

          <div
            className="account-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <FontAwesomeIcon icon={faUserCircle} /> Account
          </div>

          {dropdownOpen && (
            <div className="dropdown-menus">

              {!role && (
                <>
                  <Link to="/login" onClick={() => setDropdownOpen(false)}>
                    Login
                  </Link>

                  <Link to="/registration" onClick={() => setDropdownOpen(false)}>
                    Registration
                  </Link>
                </>
              )}

              {role && (
                <>
                  <Link
                    to={dashboardPath}
                    onClick={() => setDropdownOpen(false)}
                  >
                    <FontAwesomeIcon icon={faTachometerAlt} /> Dashboard
                  </Link>

                  <button onClick={handleLogout}>
                    <FontAwesomeIcon icon={faSignOutAlt} /> Logout
                  </button>
                </>
              )}

            </div>
          )}

        </li>

      </ul>

      {/* Mobile Hamburger */}
      <div
        className={`menu-toggle ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        ☰
      </div>

    </nav>
  );
};

export default Navbar;