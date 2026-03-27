import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const accessToken =
    localStorage.getItem("access") || localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!accessToken || !role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={`/dashboard/${role}`} replace />;
  }

  return children;
};

export default ProtectedRoute;