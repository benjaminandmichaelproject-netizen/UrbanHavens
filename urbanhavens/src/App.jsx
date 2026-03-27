import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar/Navbar";
import MobileBottomNav from "./components/MobileBottomNav/MobileBottomNav";
import ForgotPassword from "./components/Login/ForgotPassword";
import ConfirmResetCode from "./components/Login/ConfirmResetCode";
import ResetPassword from "./components/Login/ResetPassword";
import Home from "./Pages/Home/index";
import Contact from "./Pages/Contact/Contact";
import About from "./Pages/About/About";
import Login from "./Pages/Login";
import Registration from "./Pages/Registration/Registration";
import RegisterForm from "./Pages/Registration/RegisterForm";
import Success from "./Pages/Success";
import TenantDashboard from "./Dashboard/Tenant/TenantDashboard/TenantDashboard";
import ScheduledViewings from "./Dashboard/Tenant/ScheduledViewings/ScheduledViewings";
import Favorites from "./Dashboard/Tenant/Favorites";
import Payments from "./Dashboard/Tenant/Payments";
import HelpCenter from "./Dashboard/HelpCenter";
import AccountSettings from "./Dashboard/AccountSettings";
import Logout from "./Dashboard/Tenant/Logout";
import MyBookings from "./Dashboard/Tenant/MyBookings";
import Profile from "./Dashboard/Tenant/Profile";
import MyProperties from "./Dashboard/Owner/MyProperties/MyProperties";
import OwnerDashboard from "./Dashboard/Owner/OwnerDashboard/OwnerDashboard";
import AdminDashboard from "./Dashboard/Admin/AdminMain/AdminDashboard";
import PropertyListing from "./Pages/PropertyListing/PropertyListing";
import DashboardLayout from "./Dashboard/components/DashboardLayout";
import LoginPage from "./Pages/LoginPage/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Detail from "./Pages/Detail/Detail";
import Landlord from "./Pages/Landlord/Lanlord";
import "./App.css";
import Uploadpage from "./Dashboard/Owner/UploadDetails/Uploadpage";
import Upload from "./Dashboard/Owner/Upload";
// import Tenants from "./Dashboard/Owner/Ownerleases/Ownerleases";
// import Documents from "./Dashboard/Owner/Documents";
// import Contracts from "./Dashboard/Owner/Contracts";
import Bookings from "./Dashboard/Owner/Bookings/Bookings";
import Notifications from "./Pages/Notifications/Notifications";
import Users from "./Dashboard/Admin/Users/Users";
import Allproperties from "./Dashboard/Admin/Allproperties/Allproperties";
import AdminAddProperty from "./Dashboard/Admin/AddProperty/AdminAddProperty";
import Pending from "./Dashboard/Admin/Pending/Pending";
import NotificationToastContainer from "./context/NotificationToastContainer";
import AdminBookings from "./Dashboard/Admin/Bookings/AdminBookings";
import TenantBooking from "./Dashboard/Tenant/TenantBooking/TenantBooking";
import OwnerLeases from "./Dashboard/Owner/Ownerleases/Ownerleases";
import FavoritePage from "./Pages/Favotite/FavoritePage";
import Lease from "./Dashboard/Tenant/Lease/Lease";
import TenantNotification from "./Dashboard/Tenant/TenantNotification/TenantNotification";
import Report from "./Dashboard/Tenant/Report/Report";
import AdminReport from "./Dashboard/Admin/AdminReport";
import FlaggedProperty from "./Dashboard/Owner/FlaggedProperty/FlaggedProperty";
import Addmin from "./Dashboard/Admin/Addmin/Addmin";
import Footer from "./components/Footer/Footer";
import Hostel from "./Pages/PropertyListing/hostelForRent/Hostel";
import HouseForRent from "./Pages/PropertyListing/houseForRent/HouseForRent";
// ── AI Assistant ─────────────────────────────────────────────────
 import { AIAssistantButton } from "./components/AIAssistant/AIAssistant";

const AppContent = () => {
  const location = useLocation();

  const isDashboard = location.pathname.startsWith("/dashboard");

  const hideNavbarRoutes = [
    "/login",
    "/forgot-password",
    "/confirm-reset-code",
    "/reset-password",
    "/notifications",
  ];

  const hideBottomNavRoutes = [
    "/login",
    "/forgot-password",
    "/confirm-reset-code",
    "/reset-password",
  ];

  // Hide AI button on auth pages where it makes no sense
  const hideAIRoutes = [
    "/login",
    "/forgot-password",
    "/confirm-reset-code",
    "/reset-password",
    "/registration",
    "/register-form",
  ];

  const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);
  const shouldHideBottomNav = hideBottomNavRoutes.includes(location.pathname);
  const shouldShowAI = !hideAIRoutes.includes(location.pathname);

  return (
    <>
      {!isDashboard && !shouldHideNavbar && <Navbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/propertylisting" element={<PropertyListing />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/confirm-reset-code" element={<ConfirmResetCode />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/register-form" element={<RegisterForm />} />
        <Route path="/success" element={<Success />} />
        <Route path="/detail/:id" element={<Detail />} />
        <Route path="/landlord/:type/:id" element={<Landlord />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/favorites" element={<FavoritePage />} />
        <Route path="/hostel" element={<Hostel />} />
        <Route path="/houseforrent" element={<HouseForRent />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["owner", "tenant", "admin"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="owner"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/upload"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <Upload />
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/UploadDetails/uploadpage"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <Uploadpage />
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/my-properties"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <MyProperties />
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/bookings"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <Bookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/settings"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <div>Owner Settings</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/OwnerLeases/OwnerLeases"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <OwnerLeases />
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/contracts"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <div>Contracts</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/documents"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <div>Documents</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="owner/help"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <div>Help & Support</div>
              </ProtectedRoute>
            }
          />

          <Route
            path="tenant"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <TenantDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/scheduled-viewings"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <ScheduledViewings />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/TenantBooking/TenantBooking"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <TenantBooking />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/favorites"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/Lease/Lease"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <Lease />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/TenantNotification/TenantNotification"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <TenantNotification />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/Report/Report"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <Report />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/payments"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/help"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <HelpCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/settings"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <AccountSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/bookings"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="tenant/profile"
            element={
              <ProtectedRoute allowedRoles={["tenant"]}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="logout"
            element={
              <ProtectedRoute allowedRoles={["owner", "tenant", "admin"]}>
                <Logout />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/add-property"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminAddProperty />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/properties"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Allproperties />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/Addmin/Addmin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Addmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/pending"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Pending />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/FlaggedProperty/FlaggedProperty"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <FlaggedProperty />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/bookings"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/reports"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/documents"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <div>Documents</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/notifications"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <div>Notifications</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/settings"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <div>Admin Settings</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/profile"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <div>Admin Profile</div>
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>

      {/* ── Global overlays ──────────────────────────────────────── */}
      <NotificationToastContainer />

     {shouldShowAI && <AIAssistantButton />} 


      {!isDashboard && !shouldHideBottomNav && <MobileBottomNav />}
    </>
  );
};

const App = () => <AppContent />;

export default App;