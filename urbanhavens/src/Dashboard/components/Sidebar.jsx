import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaTachometerAlt,
  FaHome,
  FaCalendarCheck,
  FaUpload,
  FaUsers,
  FaFileContract,
  FaFileAlt,
  FaLifeRing,
  FaCog,
  FaSignOutAlt,
  FaClipboardCheck,
  FaChartBar,
  FaBell,
  FaUserShield,
} from "react-icons/fa";
import "../Dashboard.css";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const role = localStorage.getItem("role");

  const handleClick = () => {
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  };

  const getLinkClass = ({ isActive }) =>
    isActive ? "sidebar-link active-link" : "sidebar-link";

  return (
    <aside className={`dashboard-sidebar ${isOpen ? "open" : "closed"}`}>
      <h3>Menu</h3>

      <ul>
        {/* ADMIN */}
        {role === "admin" && (
          <>
            <li>
              <NavLink to="/dashboard/admin" end onClick={handleClick} className={getLinkClass}>
                <FaTachometerAlt className="sidebar-icon" />
                <span>Dashboard</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/users" onClick={handleClick} className={getLinkClass}>
                <FaUsers className="sidebar-icon" />
                <span>Manage Users</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/properties" onClick={handleClick} className={getLinkClass}>
                <FaHome className="sidebar-icon" />
                <span>All Properties</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/dashboard/admin/AddProperty/add-property" onClick={handleClick} className={getLinkClass}>
                <FaHome className="sidebar-icon" />
                <span>AdminAddProperty</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/pending" onClick={handleClick} className={getLinkClass}>
                <FaClipboardCheck className="sidebar-icon" />
                <span>Pending Approvals</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/bookings" onClick={handleClick} className={getLinkClass}>
                <FaCalendarCheck className="sidebar-icon" />
                <span>Bookings</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/reports" onClick={handleClick} className={getLinkClass}>
                <FaChartBar className="sidebar-icon" />
                <span>Reports</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/documents" onClick={handleClick} className={getLinkClass}>
                <FaFileAlt className="sidebar-icon" />
                <span>Documents</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/notifications" onClick={handleClick} className={getLinkClass}>
                <FaBell className="sidebar-icon" />
                <span>Notifications</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/settings" onClick={handleClick} className={getLinkClass}>
                <FaCog className="sidebar-icon" />
                <span>Settings</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/admin/profile" onClick={handleClick} className={getLinkClass}>
                <FaUserShield className="sidebar-icon" />
                <span>Profile</span>
              </NavLink>
            </li>

            <li className="sidebar-logout-item">
              <NavLink to="/logout" onClick={handleClick} className={getLinkClass}>
                <FaSignOutAlt className="sidebar-icon" />
                <span>Log Out</span>
              </NavLink>
            </li>
          </>
        )}

        {/* OWNER */}
        {role === "owner" && (
          <>
            <li>
              <NavLink to="/dashboard/owner" end onClick={handleClick} className={getLinkClass}>
                <FaTachometerAlt className="sidebar-icon" />
                <span>Dashboard</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/owner/my-properties" onClick={handleClick} className={getLinkClass}>
                <FaHome className="sidebar-icon" />
                <span>My Properties</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/owner/bookings" onClick={handleClick} className={getLinkClass}>
                <FaCalendarCheck className="sidebar-icon" />
                <span>Bookings</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/owner/upload" onClick={handleClick} className={getLinkClass}>
                <FaUpload className="sidebar-icon" />
                <span>Upload Property</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/owner/OwnerLeases/OwnerLeases" onClick={handleClick} className={getLinkClass}>
                <FaUsers className="sidebar-icon" />
                <span>Tenants</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/owner/contracts" onClick={handleClick} className={getLinkClass}>
                <FaFileContract className="sidebar-icon" />
                <span>Contracts</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/owner/documents" onClick={handleClick} className={getLinkClass}>
                <FaFileAlt className="sidebar-icon" />
                <span>Documents</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/owner/help" onClick={handleClick} className={getLinkClass}>
                <FaLifeRing className="sidebar-icon" />
                <span>Help & Support</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/owner/settings" onClick={handleClick} className={getLinkClass}>
                <FaCog className="sidebar-icon" />
                <span>Settings</span>
              </NavLink>
            </li>

            <li className="sidebar-logout-item">
              <NavLink to="/logout" onClick={handleClick} className={getLinkClass}>
                <FaSignOutAlt className="sidebar-icon" />
                <span>Log Out</span>
              </NavLink>
            </li>
          </>
        )}

        {/* TENANT */}
        {role === "tenant" && (
          <>
            <li>
              <NavLink to="/dashboard/tenant" end onClick={handleClick} className={getLinkClass}>
                <FaHome className="sidebar-icon" />
                <span>Home</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/tenant/TenantBooking/TenantBooking" onClick={handleClick} className={getLinkClass}>
                <FaCalendarCheck className="sidebar-icon" />
                <span>Bookings</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/dashboard/tenant/scheduled-viewings" onClick={handleClick} className={getLinkClass}>
                <FaCalendarCheck className="sidebar-icon" />
                <span>Scheduled Viewings</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/tenant/favorites" onClick={handleClick} className={getLinkClass}>
                <FaHome className="sidebar-icon" />
                <span>Saved</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/tenant/payments" onClick={handleClick} className={getLinkClass}>
                <FaFileContract className="sidebar-icon" />
                <span>Payments</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/tenant/help" onClick={handleClick} className={getLinkClass}>
                <FaLifeRing className="sidebar-icon" />
                <span>Help Center</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/dashboard/tenant/settings" onClick={handleClick} className={getLinkClass}>
                <FaCog className="sidebar-icon" />
                <span>Account Settings</span>
              </NavLink>
            </li>

            <li>
              <NavLink to="/logout" onClick={handleClick} className={getLinkClass}>
                <FaSignOutAlt className="sidebar-icon" />
                <span>Logout</span>
              </NavLink>
            </li>
          </>
        )}
      </ul>
    </aside>
  );
};

export default Sidebar;