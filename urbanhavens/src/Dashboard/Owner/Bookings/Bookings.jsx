import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./Bookings.css";
import ScheduleMeeting from "../ScheduleMeeting/ScheduleMeeting";
import ConvertToTenantModal from "../ConvertToTenantModal/ConvertToTenantModal";
import {
  getOwnerBookings,
  createTenantLease,
  cancelMeeting,
  completeMeeting,
  rejectBooking,
  clearBooking,
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

  const [actionLoadingId, setActionLoadingId] = useState(null);

  const totalBookings = useMemo(() => bookings.length, [bookings]);

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
  };

  const formatTime = (value) => {
    if (!value) return "—";
    const raw = String(value).slice(0, 5);
    return raw || "—";
  };

  const transformBookings = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    const today = new Date();

    return data.map((booking) => {
      const lease = booking.lease || null;
      const leaseActive = lease?.status === "active";
      const leaseExpired =
        lease && lease.lease_end_date && new Date(lease.lease_end_date) < today;

      const meetingStatus = booking?.meeting?.status?.toLowerCase() || "";
      const propertyCategory =
        booking.property_category || booking.property?.category || "";

      return {
        ...booking,
        property_name: booking.property_name || "Unknown Property",
        property_category: propertyCategory,
        tenant_name: booking.tenant_name || "Unknown Tenant",
        tenant_email: booking.tenant_email || "—",
        tenant_phone: booking.phone || booking.tenant_phone || "—",
        requested_date: booking.preferred_date || "",
        requested_time: booking.preferred_time || "",
        created_date: booking.created_at
          ? new Date(booking.created_at).toLocaleDateString()
          : "",
        status: booking.status
          ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
          : "Pending",
        meetingStatus,
        lease,
        leaseActive,
        leaseExpired,
      };
    });
  }, []);

  const fetchBookings = useCallback(async () => {
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
  }, [transformBookings]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

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

 const formatApiError = (error) => {
  if (!error) return "Failed to create tenant lease.";
  if (typeof error === "string") return error;
  if (error.detail) return error.detail;

  const entries = Object.entries(error)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.join(", ")}`;
      if (typeof value === "string") return `${key}: ${value}`;
      return null;
    })
    .filter(Boolean);

  return entries.length ? entries.join(" | ") : "Failed to create tenant lease.";
};

const handleConvertSubmit = async (leaseData) => {
  try {
    console.log("LEASE PAYLOAD", leaseData);
    setSubmittingLease(true);
    await createTenantLease(leaseData);
    closeConvertModal();
    await fetchBookings();
    openPopup("success", "Tenant lease created successfully.");
  } catch (error) {
    console.error(
      "Failed to create tenant lease:",
      error?.response?.data || error?.detail || error?.message || error
    );
    openPopup("error", formatApiError(error));
  } finally {
    setSubmittingLease(false);
  }
};
  const handleRejectBooking = async (booking) => {
    try {
      setActionLoadingId(`reject-${booking.id}`);
      await rejectBooking(booking.id);
      await fetchBookings();
      openPopup("success", "Booking request rejected successfully.");
    } catch (error) {
      console.error("Failed to reject booking:", error);
      openPopup("error", "Failed to reject booking request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelMeeting = async (meetingId) => {
    try {
      setActionLoadingId(`cancel-${meetingId}`);
      await cancelMeeting(meetingId);
      await fetchBookings();
      openPopup("success", "Meeting cancelled successfully.");
    } catch (error) {
      console.error("Failed to cancel meeting:", error);
      openPopup("error", "Failed to cancel meeting.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCompleteMeeting = async (meetingId) => {
    try {
      setActionLoadingId(`complete-${meetingId}`);
      await completeMeeting(meetingId);
      await fetchBookings();
      openPopup("success", "Meeting marked as completed.");
    } catch (error) {
      console.error("Failed to complete meeting:", error);
      openPopup("error", "Failed to mark meeting as completed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClearBooking = async (bookingId) => {
    try {
      setActionLoadingId(`clear-${bookingId}`);
      await clearBooking(bookingId);
      await fetchBookings();
      openPopup("success", "Booking cleared from active list.");
    } catch (error) {
      console.error("Failed to clear booking:", error);
      openPopup("error", "Failed to clear booking.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const canConvertBooking = (booking) => {
    const bookingStatus = booking.status?.toLowerCase();
    const meetingStatus = booking?.meetingStatus || "";

    if (bookingStatus === "converted" || bookingStatus === "rejected") return false;
    if (!booking.meeting) return false;

    return meetingStatus === "completed";
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
          Converted to Tenant
        </button>
      );
    }

    if (!canConvertBooking(booking)) {
      return (
        <button className="convert-btn disabled-btn" disabled>
          Complete Meeting First
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

  const renderMeetingBlock = (booking) => {
    if (!booking.meeting) {
      return <span className="meeting-none">Not yet scheduled</span>;
    }

    return (
      <div className="confirmed-schedule-block">
        <div>
          <strong>{formatDate(booking.meeting.date)}</strong>
        </div>
        <div>{formatTime(booking.meeting.time)}</div>
        <div>{booking.meeting.location || "—"}</div>
        <div className={`meeting-status ${booking.meeting.status || ""}`}>
          {booking.meeting.status || "—"}
        </div>
      </div>
    );
  };

  const renderActionButtons = (booking) => {
    const bookingStatus = booking.status?.toLowerCase();
    const meetingStatus = booking?.meeting?.status?.toLowerCase();

    if (bookingStatus === "converted") {
      return (
        <>
          <button className="schedule-btn disabled-btn" disabled>
            Converted to Tenant
          </button>

          <button
            className="clear-btn"
            onClick={() => handleClearBooking(booking.id)}
            disabled={actionLoadingId === `clear-${booking.id}`}
          >
            {actionLoadingId === `clear-${booking.id}`
              ? "Clearing..."
              : "Clear Booking"}
          </button>
        </>
      );
    }

    if (bookingStatus === "rejected") {
      return (
        <button className="schedule-btn disabled-btn" disabled>
          Rejected
        </button>
      );
    }

    if (!booking.meeting) {
      return (
        <>
          <button
            className="schedule-btn"
            onClick={() => openScheduleModal(booking)}
            disabled={actionLoadingId === `reject-${booking.id}`}
          >
            Schedule Meeting
          </button>

          <button
            className="reject-btn"
            onClick={() => handleRejectBooking(booking)}
            disabled={actionLoadingId === `reject-${booking.id}`}
          >
            {actionLoadingId === `reject-${booking.id}`
              ? "Rejecting..."
              : "Reject Request"}
          </button>
        </>
      );
    }

    if (meetingStatus === "completed") {
      return (
        <button className="complete-btn" disabled>
          Completed
        </button>
      );
    }

    if (meetingStatus === "cancelled") {
      return (
        <button
          className="schedule-btn"
          onClick={() => openScheduleModal(booking)}
        >
          Reschedule Meeting
        </button>
      );
    }

    return (
      <>
        <button
          className="schedule-btn"
          onClick={() => openScheduleModal(booking)}
          disabled={
            actionLoadingId === `cancel-${booking.meeting.id}` ||
            actionLoadingId === `complete-${booking.meeting.id}`
          }
        >
          Reschedule Meeting
        </button>

        <button
          className="cancel-btn"
          onClick={() => handleCancelMeeting(booking.meeting.id)}
          disabled={
            actionLoadingId === `cancel-${booking.meeting.id}` ||
            actionLoadingId === `complete-${booking.meeting.id}`
          }
        >
          {actionLoadingId === `cancel-${booking.meeting.id}`
            ? "Cancelling..."
            : "Cancel Meeting"}
        </button>

        <button
          className="complete-btn"
          onClick={() => handleCompleteMeeting(booking.meeting.id)}
          disabled={
            actionLoadingId === `cancel-${booking.meeting.id}` ||
            actionLoadingId === `complete-${booking.meeting.id}`
          }
        >
          {actionLoadingId === `complete-${booking.meeting.id}`
            ? "Saving..."
            : "Mark Completed"}
        </button>
      </>
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
          <p>View all viewing requests sent by tenants for your properties.</p>
        </div>

        <div className="bookings-summary">
          <span>{totalBookings}</span>
          <small>Total Requests</small>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="bookings-empty">
          <h3>No bookings yet</h3>
          <p>
            When tenants send viewing requests for your properties, they will
            appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="bookings-table-wrapper">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Contact</th>
                  <th>Requested Schedule</th>
                  <th>Confirmed Meeting</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>#{booking.id}</td>
                    <td>
                      <div className="booking-property-stack">
                        <span>{booking.property_name}</span>
                        <small>
                          {booking.property_category === "hostel"
                            ? "Hostel"
                            : booking.property_category === "house_rent"
                            ? "House Rent"
                            : "Property"}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div className="tenant-block">
                        <div className="tenant-name">{booking.tenant_name}</div>
                        <div className="tenant-email">{booking.tenant_email}</div>
                      </div>
                    </td>
                    <td>
                      <a href={`tel:${booking.tenant_phone}`} className="call-link">
                        {booking.tenant_phone}
                      </a>
                    </td>
                    <td>
                      <div className="requested-schedule-block">
                        <div>
                          <strong>{formatDate(booking.requested_date)}</strong>
                        </div>
                        <div>{formatTime(booking.requested_time)}</div>
                      </div>
                    </td>
                    <td>{renderMeetingBlock(booking)}</td>
                    <td className="message-cell">{booking.message || "—"}</td>
                    <td>
                      <span className={`booking-status ${booking.status.toLowerCase()}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      <div className="booking-action-buttons">
                        {renderActionButtons(booking)}
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
                <p><strong>Category:</strong> {booking.property_category || "—"}</p>
                <p><strong>Tenant:</strong> {booking.tenant_name}</p>
                <p><strong>Email:</strong> {booking.tenant_email}</p>
                <p>
                  <strong>Contact:</strong>{" "}
                  <a href={`tel:${booking.tenant_phone}`} className="call-link">
                    {booking.tenant_phone}
                  </a>
                </p>
                <p>
                  <strong>Requested Date:</strong> {formatDate(booking.requested_date)}
                </p>
                <p>
                  <strong>Requested Time:</strong> {formatTime(booking.requested_time)}
                </p>

                <div className="booking-meeting-mobile">
                  <strong>Confirmed Meeting:</strong>
                  <div>{renderMeetingBlock(booking)}</div>
                </div>

                <p><strong>Message:</strong> {booking.message || "—"}</p>

                <div className="booking-card-actions booking-action-buttons">
                  {renderActionButtons(booking)}
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