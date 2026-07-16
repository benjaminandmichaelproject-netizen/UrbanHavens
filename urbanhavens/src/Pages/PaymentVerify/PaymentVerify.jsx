import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../Dashboard/Owner/UploadDetails/api/api";
import "./PaymentVerify.css";

function PaymentVerify() {
  const { reference } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    verifyPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyPayment = async () => {
    try {
      const response = await api.get(
        `/payments/verify/${reference}/`
      );

      console.log("Payment verification:", response.data);

      setSuccess(true);

      setMessage(
        response.data.detail ||
          "Payment verified successfully."
      );

      setTimeout(() => {
        navigate("/dashboard/tenant/TenantBooking/TenantBooking");
      }, 3000);
    } catch (error) {
      console.error(error);

      setSuccess(false);

      setMessage(
        error?.response?.data?.detail ||
          "Payment verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-verify-page">
      <div className="payment-card">

        {loading ? (
          <>
            <div className="loader"></div>

            <h2>Verifying Payment</h2>

            <p>Please wait while we confirm your payment.</p>
          </>
        ) : success ? (
          <>
            <div className="success-icon">
              ✓
            </div>

            <h2>Payment Successful</h2>

            <p>{message}</p>

            <small>
              Redirecting you back to your dashboard...
            </small>
          </>
        ) : (
          <>
            <div className="failed-icon">
              ✕
            </div>

            <h2>Payment Failed</h2>

            <p>{message}</p>

            <button
              onClick={() => navigate(-1)}
            >
              Go Back
            </button>
          </>
        )}

      </div>
    </div>
  );
}

export default PaymentVerify;