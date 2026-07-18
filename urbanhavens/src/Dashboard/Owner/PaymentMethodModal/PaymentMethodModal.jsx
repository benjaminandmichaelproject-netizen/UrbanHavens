import React, { useState } from "react";
import Modal from "../Modal/Modal";
import "./pay.css";
import {
  saveOwnerPaymentAccount,
} from "../UploadDetails/api/api";

const PaymentMethodModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    account_name: "",
    phone_number: "",
    provider: "mtn",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const response =
        await saveOwnerPaymentAccount(formData);

      console.log(
        "Payment account saved:",
        response
      );

      alert("Payment method saved successfully");

      setFormData({
        account_name: "",
        phone_number: "",
        provider: "mtn",
      });

      onClose();
    } catch (error) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Failed to save payment method"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3>Add Payment Method</h3>

      <form
        className="payment-form"
        onSubmit={handleSubmit}
      >
        <label>Account Name</label>
        <input
          type="text"
          name="account_name"
          value={formData.account_name}
          onChange={handleChange}
          required
        />

        <label>MoMo Number</label>
        <input
          type="tel"
          name="phone_number"
          value={formData.phone_number}
          onChange={handleChange}
          required
        />

        <label>Provider</label>
        <select
          name="provider"
          value={formData.provider}
          onChange={handleChange}
        >
          <option value="mtn">
            MTN Mobile Money
          </option>

          <option value="telecel">
            Telecel Cash
          </option>

          <option value="airteltigo">
            AirtelTigo Money
          </option>
        </select>

        <button
          type="submit"
          className="save-payment-btn"
          disabled={loading}
        >
          {loading
            ? "Saving..."
            : "Save Payment Method"}
        </button>
      </form>
    </Modal>
  );
};

export default PaymentMethodModal;