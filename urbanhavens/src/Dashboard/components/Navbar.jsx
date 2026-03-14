// src/Dashboard/Navbar.jsx
import React from "react";
import "../Dashboard.css";

const Navbar = ({ toggleSidebar }) => {
  const username = localStorage.getItem("username");

  return (
    <nav className="dashboard-navbar">
      <div className="navbar-left">
        <span className="menu-toggle" onClick={toggleSidebar}>
          &#9776;
        </span>
     
      </div>

      <div className="navbar-right">
        {username && <span className="user-name">Hello, {username}</span>}
      </div>
    </nav>
  );
};

export default Navbar;