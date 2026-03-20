import React, { useMemo, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import {
  FaSearch,
  FaEye,
  FaUserCheck,
  FaUserSlash,
  FaTrash,
  FaShieldAlt,
  FaHome,
  FaUser,
} from "react-icons/fa";
import "./Users.css";

const Users = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const users = [
    {
      id: 1,
      name: "Benjamin Michael",
      email: "benjamin@gmail.com",
      phone: "0241234567",
      role: "admin",
      status: "active",
      verified: true,
    },
    {
      id: 2,
      name: "Kwame Asare",
      email: "kwame@gmail.com",
      phone: "0559876543",
      role: "owner",
      status: "active",
      verified: true,
    },
    {
      id: 3,
      name: "Ama Serwaa",
      email: "ama@gmail.com",
      phone: "0204567891",
      role: "tenant",
      status: "active",
      verified: false,
    },
    {
      id: 4,
      name: "Kojo Mensah",
      email: "kojo@gmail.com",
      phone: "0273456789",
      role: "owner",
      status: "inactive",
      verified: false,
    },
    {
      id: 5,
      name: "Esi Boateng",
      email: "esi@gmail.com",
      phone: "0501122334",
      role: "tenant",
      status: "active",
      verified: false,
    },
  ];

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole =
        roleFilter === "all" ? true : user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [searchTerm, roleFilter]);

  const getRoleIcon = (role) => {
    if (role === "admin") return <FaShieldAlt />;
    if (role === "owner") return <FaHome />;
    return <FaUser />;
  };

  return (

      <div className="users-page">
        <div className="users-header">
          <div>
            <h2>Manage Users</h2>
            <p>View, monitor, and manage all users on the platform.</p>
          </div>

          <div className="users-summary">
            <div className="summary-card">
              <span>Total Users</span>
              <h3>{users.length}</h3>
            </div>
            <div className="summary-card">
              <span>Owners</span>
              <h3>{users.filter((u) => u.role === "owner").length}</h3>
            </div>
            <div className="summary-card">
              <span>Tenants</span>
              <h3>{users.filter((u) => u.role === "tenant").length}</h3>
            </div>
          </div>
        </div>

        <div className="users-toolbar">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, or phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <button
              className={roleFilter === "all" ? "active-filter" : ""}
              onClick={() => setRoleFilter("all")}
            >
              All
            </button>
            <button
              className={roleFilter === "admin" ? "active-filter" : ""}
              onClick={() => setRoleFilter("admin")}
            >
              Admins
            </button>
            <button
              className={roleFilter === "owner" ? "active-filter" : ""}
              onClick={() => setRoleFilter("owner")}
            >
              Owners
            </button>
            <button
              className={roleFilter === "tenant" ? "active-filter" : ""}
              onClick={() => setRoleFilter("tenant")}
            >
              Tenants
            </button>
          </div>
        </div>

        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verification</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4>{user.name}</h4>
                          <p>{user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td>{user.phone}</td>

                    <td>
                      <span className={`role-badge ${user.role}`}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${
                          user.status === "active" ? "active" : "inactive"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`verify-badge ${
                          user.verified ? "verified" : "unverified"
                        }`}
                      >
                        {user.verified ? "Verified" : "Not Verified"}
                      </span>
                    </td>

                    <td>
                      <div className="action-buttons">
                        <button className="view-btn" title="View User">
                          <FaEye />
                        </button>
                        <button className="approve-btn" title="Activate / Verify">
                          <FaUserCheck />
                        </button>
                        <button className="suspend-btn" title="Deactivate User">
                          <FaUserSlash />
                        </button>
                        <button className="delete-btn" title="Delete User">
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

  );
};

export default Users;