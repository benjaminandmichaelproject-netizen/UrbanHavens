import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar  from "./Navbar";
import { Outlet } from "react-router-dom";
import "../Dashboard.css";

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(window.innerWidth <= 768);

  const toggleSidebar = () => setSidebarOpen(p => !p);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  return (
    <div className="db-layout">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="db-overlay" onClick={toggleSidebar} />
      )}

      <div className={`db-main ${sidebarOpen && !isMobile ? "sidebar-open" : ""}`}>
        <Navbar toggleSidebar={toggleSidebar} />
        <div className="db-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;