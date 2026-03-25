import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./Components/Navbar/Navbar";
import MobileBottomNav from "./components/MobileBottomNav/MobileBottomNav";
import ForgotPassword from "./components/Login/ForgotPassword";
import ConfirmResetCode from "./components/Login/ConfirmResetCode";
import ResetPassword from "./components/Login/ResetPassword";
import Home from "./Pages/Home/index";
import Contact from "./Pages/Contact";
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
import Tenants from "./Dashboard/Owner/Ownerleases/Ownerleases";
import Documents from "./Dashboard/Owner/Documents";
import Contracts from "./Dashboard/Owner/Contracts";
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
// ── AI Assistant ─────────────────────────────────────────────────
//  import { AIAssistantButton } from "./components/AIAssistant/AIAssistant";

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
  // const hideAIRoutes = [
  //   "/login",
  //   "/forgot-password",
  //   "/confirm-reset-code",
  //   "/reset-password",
  //   "/registration",
  //   "/register-form",
  // ];

  const shouldHideNavbar   = hideNavbarRoutes.includes(location.pathname);
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
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="owner" element={<OwnerDashboard />} />
          <Route path="owner/upload" element={<Upload />} />
          <Route path="owner/UploadDetails/uploadpage" element={<Uploadpage />} />
          <Route path="owner/my-properties" element={<MyProperties />} />
          <Route path="owner/bookings" element={<Bookings />} />
          <Route path="owner/settings" element={<div>Owner Settings</div>} />
          <Route path="owner/OwnerLeases/OwnerLeases" element={<OwnerLeases />} />
          <Route path="owner/contracts" element={<div>Contracts</div>} />
          <Route path="owner/documents" element={<div>Documents</div>} />
          <Route path="owner/help" element={<div>Help & Support</div>} />

          <Route path="tenant" element={<TenantDashboard />} />
          <Route path="tenant/scheduled-viewings" element={<ScheduledViewings />} />
          <Route path="tenant/TenantBooking/TenantBooking" element={<TenantBooking />} />
          <Route path="tenant/favorites" element={<Favorites />} />
          <Route path="tenant/Lease/Lease" element={<Lease />} />
          <Route path="tenant/TenantNotification/TenantNotification" element={<TenantNotification />} />
          <Route path="tenant/Report/Report" element={<Report />} />
          <Route path="tenant/payments" element={<Payments />} />
          <Route path="tenant/help" element={<HelpCenter />} />
          <Route path="tenant/settings" element={<AccountSettings />} />
          <Route path="tenant/bookings" element={<MyBookings />} />
          <Route path="tenant/profile" element={<Profile />} />
          <Route path="logout" element={<Logout />} />

          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/users" element={<Users />} />
          <Route path="/dashboard/admin/add-property" element={<AdminAddProperty />} />
          <Route path="admin/properties" element={<Allproperties />} />
          <Route path="admin/pending" element={<Pending />} />
          <Route path="admin/FlaggedProperty/FlaggedProperty" element={<FlaggedProperty />} />
          <Route path="admin/bookings" element={<AdminBookings />} />
          <Route path="admin/reports" element={<AdminReport/>} />
          <Route path="admin/documents" element={<div>Documents</div>} />
          <Route path="admin/notifications" element={<div>Notifications</div>} />
          <Route path="admin/settings" element={<div>Admin Settings</div>} />
          <Route path="admin/profile" element={<div>Admin Profile</div>} />
        </Route>
      </Routes>

      {/* ── Global overlays ──────────────────────────────────────── */}
      <NotificationToastContainer />

      {/* {shouldShowAI && <AIAssistantButton />}  */}
   

      {!isDashboard && !shouldHideBottomNav && <MobileBottomNav />}
    </>
  );
};

const App = () => <AppContent />;

export default App;