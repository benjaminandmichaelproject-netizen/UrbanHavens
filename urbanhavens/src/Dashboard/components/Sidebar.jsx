import { NavLink } from "react-router-dom";
import {
  FaTachometerAlt, FaHome, FaCalendarCheck, FaUpload,
  FaUsers, FaFileContract, FaFileAlt, FaLifeRing, FaCog,
  FaSignOutAlt, FaClipboardCheck, FaChartBar, FaBell,
  FaUserShield, FaEye, FaHeart, FaCreditCard,
} from "react-icons/fa";
import "../Dashboard.css";

const NavItem = ({ to, icon, label, onClick, end }) => (
  <li>
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `db-nav-link ${isActive ? "db-nav-link--active" : ""}`
      }
    >
      <span className="db-nav-icon">{icon}</span>
      <span className="db-nav-label">{label}</span>
    </NavLink>
  </li>
);

const SectionLabel = ({ label }) => (
  <li className="db-nav-section">{label}</li>
);

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const role = localStorage.getItem("role");

  const handleClick = () => {
    if (window.innerWidth <= 768) toggleSidebar();
  };

  return (
    <aside className={`db-sidebar ${isOpen ? "db-sidebar--open" : "db-sidebar--closed"}`}>

      {/* Brand */}
      <div className="db-sidebar-brand">
        <div className="db-brand-icon">U</div>
        <span className="db-brand-name">UrbanHavens</span>
      </div>

      <nav className="db-sidebar-nav">
        <ul>

          {/* ── ADMIN ─────────────────────────────────── */}
          {role === "admin" && (
            <>
              <SectionLabel label="Overview" />
              <NavItem to="/dashboard/admin" end icon={<FaTachometerAlt />} label="Dashboard" onClick={handleClick} />

              <SectionLabel label="Management" />
              <NavItem to="/dashboard/admin/users" icon={<FaUsers />} label="Manage Users" onClick={handleClick} />
              <NavItem to="/dashboard/admin/properties" icon={<FaHome />} label="All Properties" onClick={handleClick} />
              <NavItem to="/dashboard/admin/add-property" icon={<FaUpload />} label="Add Property" onClick={handleClick} />
              <NavItem to="/dashboard/admin/pending" icon={<FaClipboardCheck />} label="Pending Approvals" onClick={handleClick} />
              <NavItem to="/dashboard/admin/bookings" icon={<FaCalendarCheck />} label="Bookings" onClick={handleClick} />
              <NavItem to="/dashboard/admin/FlaggedProperty/FlaggedProperty" icon={<FaCalendarCheck />} label="FlaggedProperty" onClick={handleClick} />
              <NavItem to="/dashboard/admin/Addmin/Addmin" icon={<FaCalendarCheck />} label="Addmin" onClick={handleClick} />
           

              <SectionLabel label="Insights" />
              <NavItem to="/dashboard/admin/reports" icon={<FaChartBar />} label="Reports" onClick={handleClick} />
              <NavItem to="/dashboard/admin/documents" icon={<FaFileAlt />} label="Documents" onClick={handleClick} />
              <NavItem to="/dashboard/admin/notifications" icon={<FaBell />} label="Notifications" onClick={handleClick} />

              <SectionLabel label="Account" />
              <NavItem to="/dashboard/admin/settings" icon={<FaCog />} label="Settings" onClick={handleClick} />
              <NavItem to="/dashboard/admin/profile" icon={<FaUserShield />} label="Profile" onClick={handleClick} />
              <NavItem to="/logout" icon={<FaSignOutAlt />} label="Log Out" onClick={handleClick} />
            </>
          )}

          {/* ── OWNER ─────────────────────────────────── */}
          {role === "owner" && (
            <>
              <SectionLabel label="Overview" />
              <NavItem to="/dashboard/owner" end icon={<FaTachometerAlt />} label="Dashboard" onClick={handleClick} />

              <SectionLabel label="Properties" />
              <NavItem to="/dashboard/owner/my-properties" icon={<FaHome />} label="My Properties" onClick={handleClick} />
              <NavItem to="/dashboard/owner/bookings" icon={<FaCalendarCheck />} label="Bookings" onClick={handleClick} />
              <NavItem to="/dashboard/owner/upload" icon={<FaUpload />} label="Upload Property" onClick={handleClick} />

              <SectionLabel label="Tenants" />
              <NavItem to="/dashboard/owner/OwnerLeases/OwnerLeases" icon={<FaUsers />} label="Tenants" onClick={handleClick} />
              <NavItem to="/dashboard/owner/contracts" icon={<FaFileContract />} label="Contracts" onClick={handleClick} />
              <NavItem to="/dashboard/owner/documents" icon={<FaFileAlt />} label="Documents" onClick={handleClick} />

              <SectionLabel label="Account" />
              <NavItem to="/dashboard/owner/help" icon={<FaLifeRing />} label="Help & Support" onClick={handleClick} />
              <NavItem to="/dashboard/owner/settings" icon={<FaCog />} label="Settings" onClick={handleClick} />
              <NavItem to="/logout" icon={<FaSignOutAlt />} label="Log Out" onClick={handleClick} />
            </>
          )}

          {/* ── TENANT ────────────────────────────────── */}
          {role === "tenant" && (
            <>
              <SectionLabel label="Overview" />
              <NavItem to="/dashboard/tenant" end icon={<FaHome />} label="Home" onClick={handleClick} />

              <SectionLabel label="Rentals" />
              <NavItem to="/dashboard/tenant/TenantBooking/TenantBooking" icon={<FaCalendarCheck />} label="Bookings" onClick={handleClick} />
              <NavItem to="/dashboard/tenant/scheduled-viewings" icon={<FaEye />} label="Scheduled Viewings" onClick={handleClick} />
              <NavItem to="/dashboard/tenant/favorites" icon={<FaHeart />} label="Saved" onClick={handleClick} />
              <NavItem to="/dashboard/tenant/lease/Lease" icon={<FaHeart />} label="lease" onClick={handleClick} />
              <NavItem to="/dashboard/tenant/payments" icon={<FaCreditCard />} label="Payments" onClick={handleClick} />
              <NavItem to="/dashboard/tenant/Report/Report" icon={<FaCreditCard />} label="Report" onClick={handleClick} />
              <NavItem to="/dashboard/tenant/TenantNotification/TenantNotification" icon={<FaCreditCard />} label="TenantNotification" onClick={handleClick} />

              <SectionLabel label="Account" />
              <NavItem to="/dashboard/tenant/help" icon={<FaLifeRing />} label="Help Center" onClick={handleClick} />
              <NavItem to="/dashboard/tenant/settings" icon={<FaCog />} label="Account Settings" onClick={handleClick} />
              <NavItem to="/logout" icon={<FaSignOutAlt />} label="Logout" onClick={handleClick} />
            </>
          )}

        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;