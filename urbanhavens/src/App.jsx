import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./Components/Navbar/Navbar";
import MobileBottomNav from "./components/MobileBottomNav/MobileBottomNav";
import ForgotPassword from "./components/Login/ForgotPassword";
import ConfirmResetCode from "./components/Login/ConfirmResetCode";
import ResetPassword from "./components/Login/ResetPassword";
import Home from "./Pages/Home/Home";
import Contact from "./Pages/Contact";
import About from "./Pages/About/About";
import Login from "./Pages/Login";
import Registration from "./Pages/Registration/Registration";
import RegisterForm from "./Pages/Registration/RegisterForm";
import Success from "./Pages/Success";

import TenantDashboard from "./Dashboard/Tenant/TenantDashboard";
import OwnerDashboard from "./Dashboard/Owner/OwnerDashboard";
import AdminDashboard from "./Dashboard/Admin/AdminDashboard";

import DashboardLayout from "./Dashboard/components/DashboardLayout";
import LoginPage from "./Pages/LoginPage/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

const AppContent = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");

  return (
    <>
      {/* Show Navbar only on public pages */}
      {!isDashboard && <Navbar />}

      <Routes>

        {/* PUBLIC ROUTES */}
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/confirm-reset-code" element={<ConfirmResetCode />} />
<Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/register-form" element={<RegisterForm />} />
        <Route path="/success" element={<Success />} />


        {/* DASHBOARD LAYOUT */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >

          {/* OWNER ROUTES */}
          <Route path="owner" element={<OwnerDashboard />} />
          <Route path="owner/upload" element={<div>Upload Page</div>} />
          <Route path="owner/my-properties" element={<div>My Properties</div>} />
          <Route path="owner/bookings" element={<div>Bookings</div>} />
          <Route path="owner/settings" element={<div>Owner Settings</div>} />


          {/* TENANT ROUTES */}
          <Route path="tenant" element={<TenantDashboard />} />
          <Route path="tenant/favorites" element={<div>Favorites</div>} />
          <Route path="tenant/bookings" element={<div>Tenant Bookings</div>} />
          <Route path="tenant/settings" element={<div>Tenant Settings</div>} />


          {/* ADMIN ROUTES */}
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/users" element={<div>Manage Users</div>} />
          <Route path="admin/properties" element={<div>Manage Properties</div>} />
          <Route path="admin/reports" element={<div>Reports</div>} />
          <Route path="admin/settings" element={<div>Admin Settings</div>} />

        </Route>

      </Routes>

      {/* Bottom nav only on public pages */}
      {!isDashboard && <MobileBottomNav />}
    </>
  );
};

const App = () => {
  return <AppContent />;
};

export default App;