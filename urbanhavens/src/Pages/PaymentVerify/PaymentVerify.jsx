import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../Dashboard/Owner/UploadDetails/api/api";
import "./PaymentVerify.css";

function PaymentVerify() {
  const { reference } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState(
    "Verifying your payment..."
  );

  useEffect(() => {
    if (!reference) {
      setLoading(false);
      setSuccess(false);
      setMessage(
        "Invalid payment reference. Please contact support."
      );
      return;
    }

    const verifyPayment = async () => {
      try {
        const response = await api.get(
          `/payments/verify/${reference}/`
        );

        console.log(
          "Payment verification successful:",
          response.data
        );

        setSuccess(true);

        setMessage(
          response.data?.detail ||
            "Payment verified successfully."
        );

        setTimeout(() => {
          navigate(
            "/dashboard/tenant/TenantBooking/TenantBooking",
            {
              replace: true,
            }
          );
        }, 3000);
      } catch (error) {
        console.error(
          "Payment verification failed:",
          error?.response?.status,
          error?.response?.data,
          error
        );

        setSuccess(false);

        if (error?.response?.status === 401) {
          setMessage(
            "Your session has expired. Please log in again. If your account has already been charged, do not make another payment."
          );
        } else if (error?.response?.status === 404) {
          setMessage(
            "Payment record not found. Please contact support before making another payment."
          );
        } else if (error?.response?.status >= 500) {
          setMessage(
            "Your payment may have been received, but we could not complete verification. Please do not pay again. Contact support with your payment reference."
          );
        } else {
          setMessage(
            error?.response?.data?.detail ||
              "We could not verify your payment. Please do not pay again until support confirms your transaction."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [reference, navigate]);

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
            <div className="success-icon">✓</div>

            <h2>Payment Successful</h2>

            <p>{message}</p>

            <small>
              Redirecting you back to your dashboard...
            </small>
          </>
        ) : (
          <>
            <div className="failed-icon">✕</div>

            <h2>Verification Pending</h2>

            <p>{message}</p>

            <button onClick={() => navigate(-1)}>
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentVerify;