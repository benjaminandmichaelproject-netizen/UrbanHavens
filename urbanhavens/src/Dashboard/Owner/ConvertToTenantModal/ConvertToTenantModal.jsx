import React, { useEffect, useMemo, useState } from "react";
import "./ConvertToTenantModal.css";
import { api } from "../UploadDetails/api/api";

const formatMoney = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : value;
};

const ConvertToTenantModal = ({ booking, onClose, onSubmit, submitting }) => {
  const isHostel = booking?.property_category === "hostel";

  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState("");

  const [formData, setFormData] = useState({
    room: "",
    lease_start_date: "",
    lease_end_date: "",
    move_in_date: "",
    monthly_rent: booking?.property_price || booking?.price || "",
    deposit_amount: "",
    first_payment_status: "pending",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    let ignore = false;

    const fetchPropertyRooms = async () => {
      if (!isHostel || !booking?.property) return;

      try {
        setRoomsLoading(true);
        setRoomsError("");

        const res = await api.get(`/properties/${booking.property}/`);
        const propertyData = res.data;
        const propertyRooms = Array.isArray(propertyData?.rooms)
          ? propertyData.rooms
          : [];

        if (!ignore) {
          const availableRooms = propertyRooms.filter(
            (room) => room.is_available && Number(room.available_spaces) > 0
          );
          setRooms(availableRooms);
        }
      } catch (err) {
        if (!ignore) {
          setRooms([]);
          setRoomsError(
            err.response?.data?.detail || "Failed to load available rooms."
          );
        }
      } finally {
        if (!ignore) {
          setRoomsLoading(false);
        }
      }
    };

    fetchPropertyRooms();

    return () => {
      ignore = true;
    };
  }, [booking?.property, isHostel]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => String(room.id) === String(formData.room)),
    [rooms, formData.room]
  );

  useEffect(() => {
    if (isHostel && selectedRoom?.effective_price) {
      setFormData((prev) => ({
        ...prev,
        monthly_rent: selectedRoom.effective_price,
      }));
    }
  }, [isHostel, selectedRoom]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (isHostel && !formData.room) {
      newErrors.room = "Please select a room";
    }

    if (!formData.lease_start_date) {
      newErrors.lease_start_date = "Lease start date is required";
    }

    if (!formData.lease_end_date) {
      newErrors.lease_end_date = "Lease end date is required";
    }

    if (!formData.move_in_date) {
      newErrors.move_in_date = "Move-in date is required";
    }

    if (!formData.monthly_rent && formData.monthly_rent !== 0 && formData.monthly_rent !== "0") {
      newErrors.monthly_rent = "Monthly rent is required";
    } else if (Number(formData.monthly_rent) <= 0) {
      newErrors.monthly_rent = "Monthly rent must be greater than 0";
    }

    if (!formData.deposit_amount && formData.deposit_amount !== 0 && formData.deposit_amount !== "0") {
      newErrors.deposit_amount = "Deposit amount is required";
    } else if (Number(formData.deposit_amount) < 0) {
      newErrors.deposit_amount = "Deposit amount cannot be negative";
    }

    if (
      formData.lease_start_date &&
      formData.lease_end_date &&
      formData.lease_end_date <= formData.lease_start_date
    ) {
      newErrors.lease_end_date =
        "Lease end date cannot be before or equal to lease start date";
    }

    if (
      formData.lease_start_date &&
      formData.move_in_date &&
      formData.move_in_date < formData.lease_start_date
    ) {
      newErrors.move_in_date = "Move-in date cannot be earlier than lease start date";
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSubmit({
      booking: booking.id,
      property: booking.property,
      room: isHostel ? Number(formData.room) : null,
      lease_start_date: formData.lease_start_date,
      lease_end_date: formData.lease_end_date,
      move_in_date: formData.move_in_date,
      monthly_rent: formData.monthly_rent,
      deposit_amount: formData.deposit_amount,
      first_payment_status: formData.first_payment_status,
      notes: formData.notes,
    });
  };

  return (
    <div className="convert-tenant-overlay" onClick={onClose}>
      <div
        className="convert-tenant-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="convert-tenant-header">
          <h2>Convert to Tenant</h2>
          <button
            className="convert-tenant-close-btn"
            onClick={onClose}
            disabled={submitting}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="convert-tenant-summary">
          <p>
            <strong>Tenant:</strong> {booking?.tenant_name}
          </p>
          <p>
            <strong>Property:</strong> {booking?.property_name}
          </p>
          <p>
            <strong>Category:</strong>{" "}
            {isHostel ? "Hostel" : "House Rent"}
          </p>

          {isHostel && (
            <p className="convert-hostel-hint">
              Select the exact room to assign this tenant.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="convert-tenant-form">
          <div className="convert-tenant-grid">
            {isHostel && (
              <div className="convert-field convert-room-field">
                <label>Select Room</label>
                <select
                  name="room"
                  value={formData.room}
                  onChange={handleChange}
                  disabled={submitting || roomsLoading}
                >
                  <option value="">
                    {roomsLoading ? "Loading rooms..." : "Choose a room"}
                  </option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number}
                      {room.room_type ? ` • ${room.room_type}` : ""}
                      {room.available_spaces !== undefined && room.available_spaces !== null
                        ? ` • ${room.available_spaces} space${
                            Number(room.available_spaces) === 1 ? "" : "s"
                          } left`
                        : ""}
                    </option>
                  ))}
                </select>
                {errors.room && <small>{errors.room}</small>}
                {!errors.room && roomsError && <small>{roomsError}</small>}
                {!errors.room &&
                  !roomsError &&
                  selectedRoom && (
                    <small className="convert-room-preview">
                      Room {selectedRoom.room_number}
                      {selectedRoom.room_type ? ` • ${selectedRoom.room_type}` : ""}
                      {selectedRoom.gender_restriction
                        ? ` • ${selectedRoom.gender_restriction}`
                        : ""}
                      {selectedRoom.available_spaces !== undefined &&
                      selectedRoom.available_spaces !== null
                        ? ` • ${selectedRoom.available_spaces} space${
                            Number(selectedRoom.available_spaces) === 1 ? "" : "s"
                          } left`
                        : ""}
                    </small>
                  )}
              </div>
            )}

            <div className="convert-field">
              <label>Lease Start Date</label>
              <input
                type="date"
                name="lease_start_date"
                value={formData.lease_start_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.lease_start_date && <small>{errors.lease_start_date}</small>}
            </div>

            <div className="convert-field">
              <label>Lease End Date</label>
              <input
                type="date"
                name="lease_end_date"
                value={formData.lease_end_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.lease_end_date && <small>{errors.lease_end_date}</small>}
            </div>

            <div className="convert-field">
              <label>Move-in Date</label>
              <input
                type="date"
                name="move_in_date"
                value={formData.move_in_date}
                onChange={handleChange}
                disabled={submitting}
              />
              {errors.move_in_date && <small>{errors.move_in_date}</small>}
            </div>

            <div className="convert-field">
              <label>Monthly Rent</label>
              <input
                type="number"
                name="monthly_rent"
                value={formData.monthly_rent}
                onChange={handleChange}
                placeholder="Enter monthly rent"
                min="0"
                step="0.01"
                disabled={submitting}
              />
              {errors.monthly_rent && <small>{errors.monthly_rent}</small>}
              {!errors.monthly_rent && selectedRoom?.effective_price && (
                <small className="convert-price-preview">
                  Suggested room rent: GHS {formatMoney(selectedRoom.effective_price)}
                </small>
              )}
            </div>

            <div className="convert-field">
              <label>Deposit Amount</label>
              <input
                type="number"
                name="deposit_amount"
                value={formData.deposit_amount}
                onChange={handleChange}
                placeholder="Enter deposit amount"
                min="0"
                step="0.01"
                disabled={submitting}
              />
              {errors.deposit_amount && <small>{errors.deposit_amount}</small>}
            </div>

            <div className="convert-field">
              <label>First Payment Status</label>
              <select
                name="first_payment_status"
                value={formData.first_payment_status}
                onChange={handleChange}
                disabled={submitting}
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="convert-field">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add extra notes"
              disabled={submitting}
            />
          </div>

          <div className="convert-tenant-actions">
            <button
              type="button"
              className="convert-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="convert-submit-btn"
              disabled={
                submitting || (isHostel && (roomsLoading || rooms.length === 0))
              }
            >
              {submitting ? "Creating..." : "Create Lease"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConvertToTenantModal;