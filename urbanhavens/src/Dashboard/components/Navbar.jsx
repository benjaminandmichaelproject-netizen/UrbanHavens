import { FaBars, FaBell, FaSearch } from "react-icons/fa";
import { useNotifications } from "../../context/NotificationContext";
import "../Dashboard.css";

const Navbar = ({ toggleSidebar }) => {
  const username    = localStorage.getItem("username") || "User";
  const role        = localStorage.getItem("role")     || "";
  const initials    = username.slice(0, 2).toUpperCase();
  const { unreadCount } = useNotifications?.() || { unreadCount: 0 };

  const roleLabel = {
    admin:  "Administrator",
    owner:  "Property Owner",
    tenant: "Tenant",
  }[role] || role;

  return (
    <nav className="db-navbar">
      {/* Left */}
      <div className="db-navbar-left">
        <button className="db-menu-btn" onClick={toggleSidebar} aria-label="Toggle menu">
          <FaBars />
        </button>

        <div className="db-search-wrap">
          <FaSearch className="db-search-icon" />
          <input
            type="text"
            placeholder="Search..."
            className="db-search-input"
          />
        </div>
      </div>

      {/* Right */}
      <div className="db-navbar-right">
        {/* Notification bell */}
        <button className="db-nav-icon-btn" aria-label="Notifications">
          <FaBell />
          {unreadCount > 0 && (
            <span className="db-notif-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User chip */}
        <div className="db-user-chip">
          <div className="db-user-avatar">{initials}</div>
          <div className="db-user-info">
            <span className="db-user-name">{username}</span>
            <span className="db-user-role">{roleLabel}</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;