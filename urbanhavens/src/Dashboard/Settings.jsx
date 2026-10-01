import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faEnvelope,
  faPhone,
  faBuilding,
  faShieldHalved,
  faIdCard,
  faLock,
  faKey,
  faCheckCircle,
  faSave,
} from "@fortawesome/free-solid-svg-icons";

import {
  getMyAccount,
  updateMyAccount,
  changeMyPassword,
} from "./Owner/UploadDetails/api/api";

import "./Settings.css";

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [account, setAccount] = useState({
    id: null,
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "",
    business_name: "",
    document_type: "",
    id_number: "",
    is_verified: null,
    document_file: null,
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    loadAccount();
  }, []);

  const loadAccount = async () => {
    setLoading(true);
    setProfileError("");

    try {
      const data = await getMyAccount();

      setAccount({
        id: data.id ?? null,
        username: data.username ?? "",
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        role: data.role ?? "",
        business_name: data.business_name ?? "",
        document_type: data.document_type ?? "",
        id_number: data.id_number ?? "",
        is_verified: data.is_verified ?? null,
        document_file: data.document_file ?? null,
      });
    } catch (error) {
      setProfileError(
        error?.detail ||
          "Unable to load your account settings."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    setAccount((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    setProfileMessage("");
    setProfileError("");
    setSavingProfile(true);

    try {
      const payload = {
        first_name: account.first_name,
        last_name: account.last_name,
        phone: account.phone,
      };

      if (account.role === "owner") {
        payload.business_name = account.business_name;
      }

      const response = await updateMyAccount(payload);

      if (response?.user) {
        setAccount((prev) => ({
          ...prev,
          ...response.user,
          business_name:
            response.user.business_name ?? "",
        }));
      }

      setProfileMessage(
        response?.message ||
          "Account settings updated successfully."
      );
    } catch (error) {
      setProfileError(
        error?.detail ||
          "Unable to update your account settings."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    if (
      passwordForm.new_password !==
      passwordForm.confirm_password
    ) {
      setPasswordError(
        "The new passwords do not match."
      );
      return;
    }

    setSavingPassword(true);

    try {
      const response = await changeMyPassword(
        passwordForm
      );

      setPasswordMessage(
        response?.detail ||
          "Password changed successfully."
      );

      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
   } catch (error) {
  if (error?.current_password) {
    setPasswordError(
      Array.isArray(error.current_password)
        ? error.current_password.join(" ")
        : error.current_password
    );
  } else if (error?.confirm_password) {
    setPasswordError(
      Array.isArray(error.confirm_password)
        ? error.confirm_password.join(" ")
        : error.confirm_password
    );
  } else if (error?.new_password) {
    setPasswordError(
      Array.isArray(error.new_password)
        ? error.new_password.join(" ")
        : error.new_password
    );
  } else if (error?.non_field_errors) {
    setPasswordError(
      Array.isArray(error.non_field_errors)
        ? error.non_field_errors.join(" ")
        : error.non_field_errors
    );
  } else {
    setPasswordError(
      error?.detail ||
        "Unable to change your password."
    );
  }
} finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          Loading account settings...
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">

      {/* HEADER */}
      <motion.div
        className="settings-header"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <span className="settings-eyebrow">
            ACCOUNT SETTINGS
          </span>

          <h1>Manage your account</h1>

          <p>
            Update your personal details and manage
            your account security.
          </p>
        </div>

        <div className="settings-header-icon">
          <FontAwesomeIcon icon={faUser} />
        </div>
      </motion.div>

      {/* PERSONAL DETAILS */}
      <motion.section
        className="settings-card"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="settings-card-heading">
          <div className="settings-card-icon">
            <FontAwesomeIcon icon={faUser} />
          </div>

          <div>
            <span>PERSONAL DETAILS</span>
            <h2>Profile Information</h2>
          </div>
        </div>

        {profileMessage && (
          <div className="settings-success">
            <FontAwesomeIcon icon={faCheckCircle} />
            {profileMessage}
          </div>
        )}

        {profileError && (
          <div className="settings-error">
            {profileError}
          </div>
        )}

        <form onSubmit={handleProfileSubmit}>
          <div className="settings-grid">

            <div className="settings-field">
              <label>First Name</label>

              <div className="settings-input-wrap">
                <FontAwesomeIcon icon={faUser} />

                <input
                  type="text"
                  name="first_name"
                  value={account.first_name}
                  onChange={handleProfileChange}
                  placeholder="First name"
                />
              </div>
            </div>

            <div className="settings-field">
              <label>Last Name</label>

              <div className="settings-input-wrap">
                <FontAwesomeIcon icon={faUser} />

                <input
                  type="text"
                  name="last_name"
                  value={account.last_name}
                  onChange={handleProfileChange}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="settings-field">
              <label>Phone Number</label>

              <div className="settings-input-wrap">
                <FontAwesomeIcon icon={faPhone} />

                <input
                  type="text"
                  name="phone"
                  value={account.phone}
                  onChange={handleProfileChange}
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div className="settings-field">
              <label>Email Address</label>

              <div className="settings-input-wrap readonly">
                <FontAwesomeIcon icon={faEnvelope} />

                <input
                  type="email"
                  value={account.email}
                  readOnly
                />
              </div>

              <small>
                Email changes are currently protected.
              </small>
            </div>

          </div>

          {account.role === "owner" && (
            <>
              <div className="settings-divider" />

              <div className="settings-subheading">
                <span>OWNER DETAILS</span>
                <h3>Landlord Profile</h3>
              </div>

              <div className="settings-grid">

                <div className="settings-field">
                  <label>Business Name</label>

                  <div className="settings-input-wrap">
                    <FontAwesomeIcon icon={faBuilding} />

                    <input
                      type="text"
                      name="business_name"
                      value={account.business_name}
                      onChange={handleProfileChange}
                      placeholder="Business name"
                    />
                  </div>
                </div>

                <div className="settings-field">
                  <label>Verification Status</label>

                  <div className="settings-readonly-box">
                    <FontAwesomeIcon
                      icon={faShieldHalved}
                    />

                    <span>
                      {account.is_verified
                        ? "Verified"
                        : "Not Verified"}
                    </span>
                  </div>
                </div>

                <div className="settings-field">
                  <label>Document Type</label>

                  <div className="settings-readonly-box">
                    <FontAwesomeIcon icon={faIdCard} />

                    <span>
                      {account.document_type || "—"}
                    </span>
                  </div>
                </div>

                <div className="settings-field">
                  <label>ID Number</label>

                  <div className="settings-readonly-box">
                    <FontAwesomeIcon icon={faIdCard} />

                    <span>
                      {account.id_number || "—"}
                    </span>
                  </div>
                </div>

              </div>
            </>
          )}

          <div className="settings-divider" />

          <div className="settings-account-meta">
            <div>
              <span>Username</span>
              <strong>{account.username}</strong>
            </div>

            <div>
              <span>Account Role</span>
              <strong className="settings-role">
                {account.role}
              </strong>
            </div>
          </div>

          <button
            type="submit"
            className="settings-save-btn"
            disabled={savingProfile}
          >
            <FontAwesomeIcon icon={faSave} />

            {savingProfile
              ? "Saving..."
              : "Save Changes"}
          </button>
        </form>
      </motion.section>

      {/* SECURITY */}
      <motion.section
        className="settings-card"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.45,
          delay: 0.08,
        }}
      >
        <div className="settings-card-heading">
          <div className="settings-card-icon">
            <FontAwesomeIcon icon={faLock} />
          </div>

          <div>
            <span>SECURITY</span>
            <h2>Change Password</h2>
          </div>
        </div>

        <p className="settings-security-desc">
          Enter your current password before choosing a
          new one.
        </p>

        {passwordMessage && (
          <div className="settings-success">
            <FontAwesomeIcon icon={faCheckCircle} />
            {passwordMessage}
          </div>
        )}

        {passwordError && (
          <div className="settings-error">
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit}>

          <div className="settings-password-grid">

            <div className="settings-field">
              <label>Current Password</label>

              <div className="settings-input-wrap">
                <FontAwesomeIcon icon={faKey} />

                <input
                  type="password"
                  name="current_password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  required
                />
              </div>
            </div>

            <div className="settings-field">
              <label>New Password</label>

              <div className="settings-input-wrap">
                <FontAwesomeIcon icon={faLock} />

                <input
                  type="password"
                  name="new_password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  required
                />
              </div>
            </div>

            <div className="settings-field">
              <label>Confirm New Password</label>

              <div className="settings-input-wrap">
                <FontAwesomeIcon icon={faLock} />

                <input
                  type="password"
                  name="confirm_password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  required
                />
              </div>
            </div>

          </div>

          <button
            type="submit"
            className="settings-password-btn"
            disabled={savingPassword}
          >
            <FontAwesomeIcon icon={faShieldHalved} />

            {savingPassword
              ? "Updating..."
              : "Update Password"}
          </button>

        </form>
      </motion.section>

    </div>
  );
};

export default Settings;