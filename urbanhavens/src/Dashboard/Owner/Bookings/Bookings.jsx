import React, { useEffect, useMemo, useState } from "react";
import "./Bookings.css";
import ScheduleMeeting from "../ScheduleMeeting/ScheduleMeeting";
import ConvertToTenantModal from "../ConvertToTenantModal/ConvertToTenantModal";
import {
  getOwnerBookings,
  createTenantLease,
} from "../UploadDetails/api/api";

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [submittingLease, setSubmittingLease] = useState(false);

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupType, setPopupType] = useState("success");
  const [popupMessage, setPopupMessage] = useState("");

  const totalBookings = useMemo(() => bookings.length, [bookings]);

  useEffect(() => {
    fetchBookings();
  }, []);

  const transformBookings = (data) => {
    if (!Array.isArray(data)) return [];
    const today = new Date();

    return data.map((booking) => {
      const lease = booking.lease || null;
      const leaseActive = lease?.status === "active";
      const leaseExpired =
        lease && lease.lease_end_date && new Date(lease.lease_end_date) < today;

      return {
        ...booking,
        property_name: booking.property_name || "Unknown Property",
        tenant_name: booking.tenant_name || booking.name,
        date: booking.created_at
          ? new Date(booking.created_at).toLocaleDateString()
          : "",
        status: booking.status
          ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
          : "Pending",
        lease,
        leaseActive,
        leaseExpired,
      };
    });
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const data = await getOwnerBookings();
      setBookings(transformBookings(data));
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const openScheduleModal = (booking) => {
    setSelectedBooking(booking);
    setScheduleOpen(true);
  };

  const closeScheduleModal = () => {
    setScheduleOpen(false);
    setSelectedBooking(null);
  };

  const openConvertModal = (booking) => {
    setSelectedBooking(booking);
    setConvertOpen(true);
  };

  const closeConvertModal = () => {
    if (submittingLease) return;
    setConvertOpen(false);
    setSelectedBooking(null);
  };

  const openPopup = (type, message) => {
    setPopupType(type);
    setPopupMessage(message);
    setPopupOpen(true);
  };

  const closePopup = () => {
    setPopupOpen(false);
    setPopupMessage("");
  };

  const handleConvertSubmit = async (leaseData) => {
    try {
      setSubmittingLease(true);
      await createTenantLease(leaseData);
      closeConvertModal();
      await fetchBookings();
      openPopup("success", "Tenant lease created successfully.");
    } catch (error) {
      console.error("Failed to create tenant lease:", error);
      openPopup("error", error?.detail || "Failed to create tenant lease.");
    } finally {
      setSubmittingLease(false);
    }
  };

  const renderConvertButton = (booking) => {
    const { leaseActive, leaseExpired } = booking;
    const isConverted = booking.status.toLowerCase() === "converted";

    if (isConverted && leaseActive) {
      return (
        <button className="convert-btn lease-active-btn" disabled>
          Lease In Progress
        </button>
      );
    }

    if (isConverted && leaseExpired) {
      return (
        <button
          className="convert-btn"
          onClick={() => openConvertModal(booking)}
        >
          Renew Lease
        </button>
      );
    }

    if (isConverted) {
      return (
        <button className="convert-btn" disabled>
          Converted
        </button>
      );
    }

    return (
      <button
        className="convert-btn"
        onClick={() => openConvertModal(booking)}
      >
        Convert to Tenant
      </button>
    );
  };

  if (loading) {
    return (
      <div className="bookings-page">
        <div className="bookings-empty">
          <h3>Loading bookings...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="bookings-page">
      <div className="bookings-header">
        <div>
          <h1>Bookings</h1>
          <p>View all booking requests sent by tenants for your properties.</p>
        </div>

        <div className="bookings-summary">
          <span>{totalBookings}</span>
          <small>Total Requests</small>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="bookings-empty">
          <h3>No bookings yet</h3>
          <p>When tenants send requests for your properties, they will appear here.</p>
        </div>
      ) : (
        <>
          <div className="bookings-table-wrapper">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Property</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Message</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>#{booking.id}</td>
                    <td>{booking.property_name}</td>
                    <td>{booking.tenant_name}</td>
                    <td>{booking.email}</td>
                    <td>
                      <a href={`tel:${booking.phone}`} className="call-link">
                        {booking.phone}
                      </a>
                    </td>
                    <td className="message-cell">{booking.message}</td>
                    <td>{booking.date}</td>
                    <td>
                      <span className={`booking-status ${booking.status.toLowerCase()}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      <div className="booking-action-buttons">
                        <button
                          className="schedule-btn"
                          onClick={() => openScheduleModal(booking)}
                        >
                          Schedule Meeting
                        </button>
                        {renderConvertButton(booking)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bookings-mobile-list">
            {bookings.map((booking) => (
              <div className="booking-card" key={booking.id}>
                <div className="booking-card-top">
                  <h3>{booking.property_name}</h3>
                  <span className={`booking-status ${booking.status.toLowerCase()}`}>
                    {booking.status}
                  </span>
                </div>

                <p><strong>ID:</strong> #{booking.id}</p>
                <p><strong>Name:</strong> {booking.tenant_name}</p>
                <p><strong>Email:</strong> {booking.email}</p>
                <p>
                  <strong>Contact:</strong>{" "}
                  <a href={`tel:${booking.phone}`} className="call-link">
                    {booking.phone}
                  </a>
                </p>
                <p><strong>Date:</strong> {booking.date}</p>
                <p><strong>Message:</strong> {booking.message}</p>

                <div className="booking-card-actions booking-action-buttons">
                  <button
                    className="schedule-btn"
                    onClick={() => openScheduleModal(booking)}
                  >
                    Schedule Meeting
                  </button>
                  {renderConvertButton(booking)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {scheduleOpen && (
        <ScheduleMeeting
          booking={selectedBooking}
          onClose={closeScheduleModal}
          onSuccess={fetchBookings}
        />
      )}

      {convertOpen && (
        <ConvertToTenantModal
          booking={selectedBooking}
          onClose={closeConvertModal}
          onSubmit={handleConvertSubmit}
          submitting={submittingLease}
        />
      )}

      {popupOpen && (
        <div className="booking-popup-overlay" onClick={closePopup}>
          <div
            className={`booking-popup-card ${popupType}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`booking-popup-icon ${popupType}`}>
              {popupType === "success" ? "✓" : "!"}
            </div>

            <h3>
              {popupType === "success" ? "Success" : "Something went wrong"}
            </h3>

            <p>{popupMessage}</p>

            <button className="booking-popup-btn" onClick={closePopup}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;