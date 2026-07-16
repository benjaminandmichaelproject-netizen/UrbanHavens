import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FaHome,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaUser,
  FaCalendarAlt,
  FaHourglass,
  FaCheckCircle,
  FaTimesCircle,
  FaExchangeAlt,
  FaSearch,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaTrashAlt,
} from "react-icons/fa";

import "./TenantBooking.css";

import {
  api,
  clearTenantBooking,
} from "../../Owner/UploadDetails/api/api";


const STATUS_META = {
  pending: {
    label: "Pending",
    icon: <FaHourglass />,
    cls: "st-pending",
  },
  approved: {
    label: "Approved",
    icon: <FaCheckCircle />,
    cls: "st-confirmed",
  },
  inspection_completed: {
    label: "Inspection Completed",
    icon: <FaCheckCircle />,
    cls: "st-confirmed",
  },
  payment_pending: {
    label: "Payment Pending",
    icon: <FaHourglass />,
    cls: "st-pending",
  },
  payment_completed: {
    label: "Payment Completed",
    icon: <FaCheckCircle />,
    cls: "st-confirmed",
  },
  converted: {
    label: "Converted",
    icon: <FaExchangeAlt />,
    cls: "st-converted",
  },
  rejected: {
    label: "Rejected",
    icon: <FaTimesCircle />,
    cls: "st-rejected",
  },
  cancelled: {
    label: "Cancelled",
    icon: <FaTimesCircle />,
    cls: "st-rejected",
  },
};


// Formats API dates for display.
const formatDate = (dateValue) => {
  if (!dateValue) {
    return "—";
  }

  return new Date(dateValue).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};


// Formats API time values for display.
const formatTime = (timeValue) =>
  timeValue ? String(timeValue).slice(0, 5) : "—";


// Formats monetary values consistently.
const formatMoney = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });


const ImageViewer = ({ images }) => {
  // Tracks the currently displayed property image.
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="tb-no-image">
        <FaHome />
        No images available
      </div>
    );
  }

  return (
    <div className="tb-image-viewer">
      <img
        src={images[index]}
        alt={`Property ${index + 1}`}
        className="tb-viewer-img"
      />

      {images.length > 1 && (
        <>
          <button
            type="button"
            className="tb-img-nav tb-img-prev"
            onClick={() =>
              setIndex((previous) =>
                previous === 0
                  ? images.length - 1
                  : previous - 1
              )
            }
          >
            <FaChevronLeft />
          </button>

          <button
            type="button"
            className="tb-img-nav tb-img-next"
            onClick={() =>
              setIndex((previous) =>
                previous === images.length - 1
                  ? 0
                  : previous + 1
              )
            }
          >
            <FaChevronRight />
          </button>

          <div className="tb-img-dots">
            {images.map((_, imageIndex) => (
              <span
                key={imageIndex}
                className={`tb-img-dot ${
                  imageIndex === index ? "active" : ""
                }`}
                onClick={() => setIndex(imageIndex)}
              />
            ))}
          </div>

          <div className="tb-img-counter">
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
};


const TenantBooking = () => {
  // Stores booking records and page request states.
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Stores booking table filters.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Stores the booking shown in the details modal.
  const [selected, setSelected] = useState(null);

  // Stores the booking currently going through payment.
  const [rentalBooking, setRentalBooking] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("paystack");
  const [rentalError, setRentalError] = useState("");
  const [submittingRental, setSubmittingRental] = useState(false);

  // Tracks which converted booking is being cleared.
  const [clearingId, setClearingId] = useState(null);


  // Loads the authenticated tenant's bookings.
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/bookings/my_tenant_bookings/"
      );

      const data = response.data;

      setBookings(
        Array.isArray(data)
          ? data
          : data.results ?? []
      );
    } catch (fetchError) {
      console.error(
        "Fetch tenant bookings error:",
        fetchError
      );

      setError(
        fetchError.response?.data?.detail ||
          "Failed to load bookings."
      );
    } finally {
      setLoading(false);
    }
  }, []);


  // Loads bookings when the page opens.
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);


  // Filters bookings by search text and status.
  const filtered = useMemo(() => {
    return bookings.filter((booking) => {
      const query = search.toLowerCase();

      const matchesSearch =
        (booking.property_name || "")
          .toLowerCase()
          .includes(query) ||
        (booking.property_city || "")
          .toLowerCase()
          .includes(query) ||
        (booking.owner_name || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : booking.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, search, statusFilter]);


  // Returns all available image fields from a booking.
  const getImages = (booking) => {
    if (
      Array.isArray(booking.property_images) &&
      booking.property_images.length > 0
    ) {
      return booking.property_images;
    }

    if (
      Array.isArray(booking.images) &&
      booking.images.length > 0
    ) {
      return booking.images;
    }

    return [];
  };


  // Returns status presentation details.
  const getStatusMeta = (status) =>
    STATUS_META[status] || STATUS_META.pending;


  // Detects whether the selected property is a hostel.
  const isHostelBooking = (booking) => {
    const category =
      booking?.property_category ||
      booking?.category ||
      "";

    return category === "hostel";
  };


  // Returns rooms from any supported booking response field.
  const getBookingRooms = (booking) => {
    if (Array.isArray(booking?.rooms)) {
      return booking.rooms;
    }

    if (Array.isArray(booking?.property_rooms)) {
      return booking.property_rooms;
    }

    return [];
  };


  // Returns only rooms that still have bookable space.
  const availableRooms = useMemo(() => {
    return getBookingRooms(rentalBooking).filter((room) => {
      const availableSpaces = Number(
        room.available_spaces ?? 0
      );

      return (
        room.is_available !== false &&
        availableSpaces > 0
      );
    });
  }, [rentalBooking]);


  // Resolves the currently selected hostel room.
  const selectedRoom = useMemo(() => {
    return availableRooms.find(
      (room) =>
        String(room.id) === String(selectedRoomId)
    );
  }, [availableRooms, selectedRoomId]);


  // Opens the payment modal with safe defaults.
  const openRentalModal = (booking) => {
    const durations = Array.isArray(
      booking.property_allowed_rental_months
    )
      ? booking.property_allowed_rental_months
      : [];

    setRentalBooking(booking);
    setSelectedDuration(
      durations.length ? String(durations[0]) : ""
    );
    setSelectedRoomId("");
    setPaymentMethod("paystack");
    setRentalError("");
  };


  // Closes and resets the payment modal.
  const closeRentalModal = () => {
    setRentalBooking(null);
    setSelectedDuration("");
    setSelectedRoomId("");
    setPaymentMethod("paystack");
    setRentalError("");
  };


  // Uses room pricing for hostels and property pricing for houses.
  const monthlyRent = rentalBooking
    ? Number(
        isHostelBooking(rentalBooking) &&
          selectedRoom
          ? selectedRoom.effective_price ??
              selectedRoom.price_override ??
              rentalBooking.property_price ??
              0
          : rentalBooking.property_price ?? 0
      )
    : 0;


  // Calculates the total advance amount.
  const durationMonths = Number(selectedDuration || 0);
  const totalPayable = monthlyRent * durationMonths;


  // Clears a converted booking from the tenant's list.
  const handleClearBooking = async (bookingId) => {
    try {
      setClearingId(bookingId);

      await clearTenantBooking(bookingId);

      if (selected?.id === bookingId) {
        setSelected(null);
      }

      await fetchBookings();
    } catch (clearError) {
      console.error(
        "Clear tenant booking error:",
        clearError
      );

      alert(
        clearError?.response?.data?.detail ||
          clearError?.detail ||
          "Failed to clear booking."
      );
    } finally {
      setClearingId(null);
    }
  };


  // Displays the clear action only for converted bookings.
  const renderClearButton = (booking) => {
    if (booking.status !== "converted") {
      return null;
    }

    return (
      <button
        type="button"
        className="tb-clear-btn"
        onClick={() => handleClearBooking(booking.id)}
        disabled={clearingId === booking.id}
      >
        <FaTrashAlt />

        {clearingId === booking.id
          ? "Clearing..."
          : "Clear"}
      </button>
    );
  };


  // Displays the rent action after inspection completion.
  const renderRentButton = (booking) => {
    if (booking.status !== "inspection_completed") {
      return null;
    }

    return (
      <button
        type="button"
        className="tb-rent-btn"
        onClick={() => openRentalModal(booking)}
      >
        Rent This Property
      </button>
    );
  };


  // Initializes Paystack or direct payment securely.
  const handleRentalContinue = async () => {
    if (!rentalBooking || submittingRental) {
      return;
    }

    const allowedDurations = Array.isArray(
      rentalBooking.property_allowed_rental_months
    )
      ? rentalBooking.property_allowed_rental_months.map(
          Number
        )
      : [];

    if (!durationMonths) {
      setRentalError("Select a rental duration.");
      return;
    }

    if (!allowedDurations.includes(durationMonths)) {
      setRentalError(
        "The selected duration is not approved for this property."
      );
      return;
    }

    if (!["paystack", "direct"].includes(paymentMethod)) {
      setRentalError("Select a valid payment method.");
      return;
    }

    if (
      isHostelBooking(rentalBooking) &&
      !selectedRoomId
    ) {
      setRentalError(
        "Select a room before continuing with hostel payment."
      );
      return;
    }

    if (
      isHostelBooking(rentalBooking) &&
      !selectedRoom
    ) {
      setRentalError(
        "The selected room is no longer available."
      );
      return;
    }

    try {
      setSubmittingRental(true);
      setRentalError("");

      // Sends room_id only for hostel payments.
      const paymentPayload = {
        booking_id: rentalBooking.id,
        duration_months: durationMonths,
        payment_method: paymentMethod,
      };

      if (isHostelBooking(rentalBooking)) {
        paymentPayload.room_id = Number(selectedRoomId);
      }

      const response = await api.post(
        "/payments/initialize/",
        paymentPayload
      );

      const data = response.data;

      if (paymentMethod === "paystack") {
        if (!data?.authorization_url) {
          throw new Error(
            "Paystack authorization URL was not returned."
          );
        }

        window.location.href = data.authorization_url;
        return;
      }

      closeRentalModal();
      await fetchBookings();

      alert(
        data?.detail ||
          "Direct payment selected. Pay the owner and wait for confirmation."
      );
    } catch (requestError) {
      console.error(
        "Rental payment initialization failed:",
        requestError?.response?.data ||
          requestError?.message ||
          requestError
      );

      const backendData = requestError?.response?.data;

      let message =
        backendData?.detail ||
        requestError?.message ||
        "Failed to continue with the rental payment.";

      if (!backendData?.detail && backendData) {
        const fieldMessages = Object.values(backendData)
          .flat()
          .filter(
            (value) => typeof value === "string"
          );

        if (fieldMessages.length > 0) {
          message = fieldMessages.join(" ");
        }
      }

      setRentalError(message);
    } finally {
      setSubmittingRental(false);
    }
  };


  return (
    <div className="tb-page">
      <div className="tb-header">
        <div>
          <h2>My Bookings</h2>

          <p>
            Track your property booking requests
            and owner contact details.
          </p>
        </div>

        <div className="tb-stat-pill">
          <span>{bookings.length}</span>
          Total Bookings
        </div>
      </div>

      <div className="tb-toolbar">
        <div className="tb-search">
          <FaSearch />

          <input
            type="text"
            placeholder="Search by property, city or owner..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="tb-filters">
          {[
            "all",
            "pending",
            "approved",
            "inspection_completed",
            "payment_pending",
            "payment_completed",
            "converted",
            "rejected",
            "cancelled",
          ].map((status) => (
            <button
              type="button"
              key={status}
              className={
                statusFilter === status
                  ? "active"
                  : ""
              }
              onClick={() =>
                setStatusFilter(status)
              }
            >
              {status === "all"
                ? "All"
                : STATUS_META[status]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="tb-info">
          Loading bookings...
        </p>
      )}

      {error && (
        <p className="tb-error">{error}</p>
      )}

      {!loading && !error && (
        <div className="tb-table-wrapper">
          <table className="tb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Image</th>
                <th>Property</th>
                <th>Owner Contact</th>
                <th>Requested Schedule</th>
                <th>Status</th>
                <th>Date</th>
                <th>Details</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length > 0 ? (
                filtered.map((booking) => {
                  const meta =
                    getStatusMeta(booking.status);

                  const thumbnail =
                    getImages(booking)[0];

                  return (
                    <tr key={booking.id}>
                      <td className="tb-id">
                        #{booking.id}
                      </td>

                      <td className="tb-thumb-cell">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={booking.property_name}
                            className="tb-thumb"
                          />
                        ) : (
                          <div className="tb-thumb-placeholder">
                            <FaHome />
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="tb-prop-cell">
                          <strong>
                            {booking.property_name}
                          </strong>

                          <span>
                            <FaMapMarkerAlt />

                            {[
                              booking.property_city,
                              booking.property_region,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>

                          <span className="tb-type-tag">
                            {booking.property_type ||
                              booking.property_category ||
                              booking.category ||
                              "—"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="tb-owner-cell">
                          <strong>
                            {booking.owner_name}
                          </strong>

                          <a
                            href={`tel:${booking.owner_phone}`}
                            className="tb-inline-contact tb-phone"
                          >
                            <FaPhone />
                            {booking.owner_phone || "—"}
                          </a>

                          <a
                            href={`mailto:${booking.owner_email}`}
                            className="tb-inline-contact tb-email"
                          >
                            <FaEnvelope />
                            {booking.owner_email || "—"}
                          </a>
                        </div>
                      </td>

                      <td>
                        <div className="tb-prop-cell">
                          <span>
                            <FaCalendarAlt />

                            {formatDate(
                              booking.preferred_date
                            )}
                          </span>

                          <span>
                            {formatTime(
                              booking.preferred_time
                            )}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`tb-badge ${meta.cls}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>

                      <td className="tb-date-cell">
                        <FaCalendarAlt />

                        {formatDate(
                          booking.created_at
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="tb-view-btn"
                          onClick={() =>
                            setSelected(booking)
                          }
                        >
                          View
                        </button>
                      </td>

                      <td>
                        <div className="tb-action-stack">
                          {renderRentButton(booking)}
                          {renderClearButton(booking)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="9"
                    className="tb-empty-row"
                  >
                    <FaHome />
                    No bookings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          className="tb-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <div
            className="tb-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tb-modal-header">
              <h3>
                Booking #{selected.id}
              </h3>

              <button
                type="button"
                className="tb-close-btn"
                onClick={() =>
                  setSelected(null)
                }
              >
                <FaTimes />
              </button>
            </div>

            <div className="tb-modal-body">
              <ImageViewer
                images={getImages(selected)}
              />

              <div className="tb-modal-status-row">
                <span
                  className={`tb-badge ${
                    getStatusMeta(
                      selected.status
                    ).cls
                  }`}
                >
                  {
                    getStatusMeta(
                      selected.status
                    ).icon
                  }

                  {
                    getStatusMeta(
                      selected.status
                    ).label
                  }
                </span>

                <span className="tb-modal-date">
                  <FaCalendarAlt />

                  {formatDate(
                    selected.created_at
                  )}
                </span>
              </div>

              <div className="tb-modal-section">
                <h4>
                  <FaHome />
                  Property Details
                </h4>

                <div className="tb-modal-grid">
                  <div>
                    <span>Name</span>

                    <strong>
                      {selected.property_name}
                    </strong>
                  </div>

                  <div>
                    <span>Type</span>

                    <strong>
                      {selected.property_type ||
                        selected.property_category ||
                        selected.category ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Location</span>

                    <strong>
                      {[
                        selected.property_city,
                        selected.property_region,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Price</span>

                    <strong>
                      GHS{" "}
                      {selected.property_price
                        ? formatMoney(
                            selected.property_price
                          )
                        : "—"}
                      /mo
                    </strong>
                  </div>
                </div>
              </div>

              <div className="tb-modal-section">
                <h4>
                  <FaUser />
                  Owner Contact
                </h4>

                <div className="tb-modal-grid">
                  <div>
                    <span>Name</span>

                    <strong>
                      {selected.owner_name}
                    </strong>
                  </div>

                  <div>
                    <span>Phone</span>

                    <strong>
                      {selected.owner_phone || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>

                    <strong>
                      {selected.owner_email || "—"}
                    </strong>
                  </div>
                </div>

                <div className="tb-modal-contact-btns">
                  <a
                    href={`tel:${selected.owner_phone}`}
                    className="tb-contact-btn tb-phone"
                  >
                    <FaPhone />
                    Call Owner
                  </a>

                  <a
                    href={`mailto:${selected.owner_email}`}
                    className="tb-contact-btn tb-email"
                  >
                    <FaEnvelope />
                    Email Owner
                  </a>
                </div>
              </div>

              <div className="tb-modal-section">
                <h4>
                  <FaUser />
                  Your Booking Request
                </h4>

                <div className="tb-modal-grid">
                  <div>
                    <span>
                      Preferred Date
                    </span>

                    <strong>
                      {formatDate(
                        selected.preferred_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Preferred Time
                    </span>

                    <strong>
                      {formatTime(
                        selected.preferred_time
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Phone</span>

                    <strong>
                      {selected.phone || "—"}
                    </strong>
                  </div>
                </div>

                {selected.message && (
                  <div className="tb-modal-message">
                    <span>Message</span>

                    <p>
                      "{selected.message}"
                    </p>
                  </div>
                )}
              </div>

              {selected.status ===
                "inspection_completed" && (
                <div className="tb-modal-section">
                  <div className="tb-rental-ready">
                    <h4>
                      Ready to rent this property?
                    </h4>

                    <p>
                      The inspection has been
                      completed. You can now
                      select one of the
                      landlord-approved rental
                      durations and choose your
                      payment method.
                    </p>

                    <button
                      type="button"
                      className="tb-rent-btn tb-rent-btn-modal"
                      onClick={() => {
                        openRentalModal(selected);
                        setSelected(null);
                      }}
                    >
                      Rent This Property
                    </button>
                  </div>
                </div>
              )}

              {selected.status ===
                "payment_pending" && (
                <div className="tb-modal-section">
                  <div className="tb-rental-ready">
                    <h4>
                      Payment Pending
                    </h4>

                    <p>
                      Your rental decision has
                      been recorded. Complete
                      the selected payment
                      process to continue.
                    </p>
                  </div>
                </div>
              )}

              {selected.status ===
                "payment_completed" && (
                <div className="tb-modal-section">
                  <div className="tb-rental-ready">
                    <h4>
                      Payment Completed
                    </h4>

                    <p>
                      Your payment has been confirmed.
                      The property or room is reserved
                      while the owner prepares your lease.
                    </p>
                  </div>
                </div>
              )}

              {selected.status ===
                "converted" && (
                <div className="tb-modal-section">
                  <button
                    type="button"
                    className="tb-clear-btn tb-clear-btn-modal"
                    onClick={() =>
                      handleClearBooking(
                        selected.id
                      )
                    }
                    disabled={
                      clearingId ===
                      selected.id
                    }
                  >
                    <FaTrashAlt />

                    {clearingId ===
                    selected.id
                      ? "Clearing..."
                      : "Clear Booking"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {rentalBooking && (
        <div
          className="tb-modal-backdrop"
          onClick={closeRentalModal}
        >
          <div
            className="tb-modal tb-rental-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="tb-modal-header">
              <h3>
                Rent {rentalBooking.property_name}
              </h3>

              <button
                type="button"
                className="tb-close-btn"
                onClick={closeRentalModal}
              >
                <FaTimes />
              </button>
            </div>

            <div className="tb-modal-body">
              <div className="tb-modal-section">
                <h4>Rental Information</h4>

                <div className="tb-modal-grid">
                  <div>
                    <span>Monthly Rent</span>

                    <strong>
                      GHS {formatMoney(monthlyRent)}
                    </strong>
                  </div>

                  <div>
                    <span>Rental Duration</span>

                    <select
                      className="tb-rental-select"
                      value={selectedDuration}
                      onChange={(event) => {
                        setSelectedDuration(
                          event.target.value
                        );
                        setRentalError("");
                      }}
                    >
                      <option value="">
                        Select duration
                      </option>

                      {Array.isArray(
                        rentalBooking.property_allowed_rental_months
                      ) &&
                        rentalBooking.property_allowed_rental_months.map(
                          (months) => (
                            <option
                              key={months}
                              value={months}
                            >
                              {months} months
                            </option>
                          )
                        )}
                    </select>
                  </div>

                  {isHostelBooking(rentalBooking) && (
                    <div>
                      <span>Select Room</span>

                      <select
                        className="tb-rental-select"
                        value={selectedRoomId}
                        onChange={(event) => {
                          setSelectedRoomId(
                            event.target.value
                          );
                          setRentalError("");
                        }}
                      >
                        <option value="">
                          Select an available room
                        </option>

                        {availableRooms.map((room) => (
                          <option
                            key={room.id}
                            value={room.id}
                          >
                            Room {room.room_number} —{" "}
                            {room.room_type} —{" "}
                            {room.available_spaces} space(s) — GHS{" "}
                            {formatMoney(
                              room.effective_price ??
                                room.price_override ??
                                rentalBooking.property_price
                            )}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <span>Advance Period</span>

                    <strong>
                      {durationMonths
                        ? `${durationMonths} months`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Total Payable</span>

                    <strong>
                      GHS {formatMoney(totalPayable)}
                    </strong>
                  </div>
                </div>

                {isHostelBooking(rentalBooking) &&
                  availableRooms.length === 0 && (
                    <p className="tb-error">
                      No hostel room currently has available space.
                    </p>
                  )}
              </div>

              <div className="tb-modal-section">
                <h4>Payment Method</h4>

                <div className="tb-payment-options">
                  <label
                    className={`tb-payment-option ${
                      paymentMethod === "paystack"
                        ? "selected"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="paystack"
                      checked={
                        paymentMethod === "paystack"
                      }
                      onChange={(event) => {
                        setPaymentMethod(
                          event.target.value
                        );
                        setRentalError("");
                      }}
                    />

                    <span>
                      <strong>
                        Pay through UrbanHavens
                      </strong>

                      <small>
                        Continue securely with Paystack.
                      </small>
                    </span>
                  </label>

                  <label
                    className={`tb-payment-option ${
                      paymentMethod === "direct"
                        ? "selected"
                        : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="direct"
                      checked={
                        paymentMethod === "direct"
                      }
                      onChange={(event) => {
                        setPaymentMethod(
                          event.target.value
                        );
                        setRentalError("");
                      }}
                    />

                    <span>
                      <strong>
                        Pay Owner Directly
                      </strong>

                      <small>
                        Pay by cash, MoMo or bank transfer.
                        The owner must confirm receipt.
                      </small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="tb-rental-summary">
                {isHostelBooking(rentalBooking) && (
                  <div>
                    <span>Selected room</span>

                    <strong>
                      {selectedRoom
                        ? `Room ${selectedRoom.room_number}`
                        : "—"}
                    </strong>
                  </div>
                )}

                <div>
                  <span>Monthly rent</span>

                  <strong>
                    GHS {formatMoney(monthlyRent)}
                  </strong>
                </div>

                <div>
                  <span>Selected period</span>

                  <strong>
                    {durationMonths
                      ? `${durationMonths} months`
                      : "—"}
                  </strong>
                </div>

                <div className="tb-rental-summary-total">
                  <span>Total advance</span>

                  <strong>
                    GHS {formatMoney(totalPayable)}
                  </strong>
                </div>
              </div>

              {rentalError && (
                <p className="tb-error">
                  {rentalError}
                </p>
              )}

              <button
                type="button"
                className="tb-rent-btn tb-rent-btn-modal"
                onClick={handleRentalContinue}
                disabled={
                  submittingRental ||
                  !selectedDuration ||
                  totalPayable <= 0 ||
                  (
                    isHostelBooking(rentalBooking) &&
                    !selectedRoomId
                  )
                }
              >
                {submittingRental
                  ? paymentMethod === "paystack"
                    ? "Connecting to Paystack..."
                    : "Submitting..."
                  : paymentMethod === "paystack"
                  ? "Continue to Paystack"
                  : "Confirm Direct Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default TenantBooking;