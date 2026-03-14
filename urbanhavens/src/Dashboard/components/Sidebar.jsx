import React from "react";
import { Link } from "react-router-dom";
import "../Dashboard.css";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const role = localStorage.getItem("role");

  const handleClick = () => {
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  };

  return (
    <aside className={`dashboard-sidebar ${isOpen ? "open" : "closed"}`}>
      <h3>Menu</h3>

      <ul>

        {/* ADMIN */}
        {role === "admin" && (
          <>
            <li>
              <Link to="/dashboard/admin" onClick={handleClick}>
                Dashboard
              </Link>
            </li>

            <li>
              <Link to="/dashboard/admin/users" onClick={handleClick}>
                Users
              </Link>
            </li>

            <li>
              <Link to="/dashboard/admin/properties" onClick={handleClick}>
                Properties
              </Link>
            </li>

            <li>
              <Link to="/dashboard/admin/reports" onClick={handleClick}>
                Reports
              </Link>
            </li>

            <li>
              <Link to="/dashboard/admin/settings" onClick={handleClick}>
                Settings
              </Link>
            </li>
          </>
        )}

        {/* OWNER */}
        {role === "owner" && (
          <>
            <li>
              <Link to="/dashboard/owner" onClick={handleClick}>
                Dashboard
              </Link>
            </li>

            <li>
              <Link to="/dashboard/owner/my-properties" onClick={handleClick}>
                My Properties
              </Link>
            </li>

            <li>
              <Link to="/dashboard/owner/bookings" onClick={handleClick}>
                Bookings
              </Link>
            </li>

            <li>
              <Link to="/dashboard/owner/upload" onClick={handleClick}>
                Upload Property
              </Link>
            </li>

            <li>
              <Link to="/dashboard/owner/settings" onClick={handleClick}>
                Settings
              </Link>
            </li>
          </>
        )}

        {/* TENANT */}
        {role === "tenant" && (
          <>
            <li>
              <Link to="/dashboard/tenant" onClick={handleClick}>
                Dashboard
              </Link>
            </li>

            <li>
              <Link to="/dashboard/tenant/favorites" onClick={handleClick}>
                Favorites
              </Link>
            </li>

            <li>
              <Link to="/dashboard/tenant/bookings" onClick={handleClick}>
                My Bookings
              </Link>
            </li>

            <li>
              <Link to="/dashboard/tenant/settings" onClick={handleClick}>
                Settings
              </Link>
            </li>
          </>
        )}

      </ul>
    </aside>
  );
};

export default Sidebar;