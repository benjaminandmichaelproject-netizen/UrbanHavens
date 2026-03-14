// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const role = localStorage.getItem("role"); // get role from storage

  if (!role) {
    // If user is not logged in, redirect to login page
    return <Navigate to="/login" replace />;
  }

  return children; // else show the dashboard
};

export default ProtectedRoute;