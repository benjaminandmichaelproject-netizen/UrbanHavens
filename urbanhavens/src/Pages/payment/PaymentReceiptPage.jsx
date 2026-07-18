import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// Imports the shared authenticated Axios instance.
// Imports the shared authenticated Axios instance.
import { api } from "../../Dashboard/Owner/UploadDetails/api/api";
import "./PaymentReceiptPage.css";


const PaymentReceiptPage = () => {
  // Reads the payment ID from the route.
  const { paymentId } = useParams();

  // Stores the receipt and page request state.
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  // Loads the protected receipt from the backend.
  useEffect(() => {
    const loadReceipt = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/payments/${paymentId}/receipt/`
        );

        setReceipt(response.data);
      } catch (requestError) {
        console.error(
          "Failed to load receipt:",
          requestError?.response?.data ||
            requestError?.message ||
            requestError
        );

        setError(
          requestError?.response?.data?.detail ||
            "Failed to load the payment receipt."
        );
      } finally {
        setLoading(false);
      }
    };

    loadReceipt();
  }, [paymentId]);


  // Formats currency values consistently.
  const formatMoney = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });


  // Formats API dates for document display.
  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-GH", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };


  // Opens the browser print dialog for saving or printing.
  const handlePrint = () => {
    window.print();
  };


  if (loading) {
    return (
      <main className="payment-receipt-page">
        <div className="payment-receipt-state">
          Loading receipt...
        </div>
      </main>
    );
  }


  if (error) {
    return (
      <main className="payment-receipt-page">
        <div className="payment-receipt-state error">
          {error}
        </div>
      </main>
    );
  }


  if (!receipt) {
    return null;
  }


  return (
    <main className="payment-receipt-page">
      {/* Keeps document actions outside the printed receipt. */}
      <div className="payment-receipt-actions no-print">
        <button
          type="button"
          onClick={handlePrint}
        >
          Print / Save as PDF
        </button>
      </div>

      <article className="payment-receipt-document">
        {/* Displays the large low-opacity UrbanHavens watermark. */}
        <div
          className="payment-receipt-watermark"
          aria-hidden="true"
        >
          URBANHAVENS
        </div>

        {/* Displays the receipt heading and reference information. */}
        <header className="payment-receipt-header">
          <div>
            <h1>URBANHAVENS</h1>
            <p>Official Property Payment Receipt</p>
          </div>

          <div className="payment-receipt-reference">
            <span>Receipt Number</span>
            <strong>{receipt.receipt_number}</strong>

            <span>Payment Reference</span>
            <strong>{receipt.payment_reference}</strong>
          </div>
        </header>

        {/* Displays the document title and payment date. */}
        <section className="payment-receipt-title">
          <h2>Official Payment Receipt</h2>

          <p>
            Issued on {formatDate(receipt.payment_date)}
          </p>
        </section>

        {/* Displays tenant and landlord details. */}
        <section className="payment-receipt-section">
          <h3>Parties</h3>

          <div className="payment-receipt-two-column">
            <div>
              <span>Tenant</span>
              <strong>{receipt.tenant.name}</strong>
              <p>{receipt.tenant.email || "—"}</p>
              <p>{receipt.tenant.phone || "—"}</p>
            </div>

            <div>
              <span>Landlord</span>
              <strong>{receipt.landlord.name}</strong>
              <p>{receipt.landlord.email || "—"}</p>
              <p>{receipt.landlord.phone || "—"}</p>
            </div>
          </div>
        </section>

        {/* Displays property and hostel room information. */}
        <section className="payment-receipt-section">
          <h3>Property Details</h3>

          <div className="payment-receipt-grid">
            <div>
              <span>Property</span>
              <strong>{receipt.property.name}</strong>
            </div>

            <div>
              <span>Category</span>
              <strong>
                {receipt.property.category === "hostel"
                  ? "Hostel"
                  : "House Rental"}
              </strong>
            </div>

            <div>
              <span>Location</span>
              <strong>
                {[
                  receipt.property.city,
                  receipt.property.region,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </strong>
            </div>

            <div>
              <span>Property Type</span>
              <strong>
                {receipt.property.type || "—"}
              </strong>
            </div>

            {receipt.room && (
              <>
                <div>
                  <span>Room Number</span>
                  <strong>
                    {receipt.room.room_number}
                  </strong>
                </div>

                <div>
                  <span>Room Type</span>
                  <strong>
                    {receipt.room.room_type}
                  </strong>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Displays the financial receipt breakdown. */}
        <section className="payment-receipt-section">
          <h3>Payment Details</h3>

          <div className="payment-receipt-table">
            <div>
              <span>Payment Method</span>
              <strong>
                {receipt.payment.method_display}
              </strong>
            </div>

            <div>
              <span>Payment Type</span>
              <strong>
                {receipt.payment.type_display}
              </strong>
            </div>

            <div>
              <span>Rental Duration</span>
              <strong>
                {receipt.payment.duration_months} months
              </strong>
            </div>

            <div>
              <span>Monthly Rent</span>
              <strong>
                GHS{" "}
                {formatMoney(
                  receipt.payment.monthly_rent
                )}
              </strong>
            </div>

            <div>
              <span>Expected Amount</span>
              <strong>
                GHS{" "}
                {formatMoney(
                  receipt.payment.expected_amount
                )}
              </strong>
            </div>

            <div>
              <span>Amount Received</span>
              <strong>
                GHS{" "}
                {formatMoney(
                  receipt.payment.amount_received
                )}
              </strong>
            </div>

            <div>
              <span>Payment Status</span>
              <strong
                className={`payment-receipt-status ${
                  receipt.payment.completion_status
                }`}
              >
                {
                  receipt.payment
                    .completion_status_display
                }
              </strong>
            </div>

            <div>
              <span>Outstanding Balance</span>
              <strong>
                GHS{" "}
                {formatMoney(
                  receipt.payment.outstanding_balance
                )}
              </strong>
            </div>
          </div>
        </section>

        {/* Displays the formal receipt statement. */}
        <section className="payment-receipt-statement">
          <p>
            This document confirms that UrbanHavens recorded
            a payment of{" "}
            <strong>
              GHS{" "}
              {formatMoney(
                receipt.payment.amount_received
              )}
            </strong>{" "}
            from <strong>{receipt.tenant.name}</strong> for{" "}
            <strong>{receipt.property.name}</strong>.
          </p>

          <p>
            The payment has been classified as{" "}
            <strong>
              {
                receipt.payment
                  .completion_status_display
              }
            </strong>
            .
          </p>
        </section>

        {/* Displays the official document footer. */}
        <footer className="payment-receipt-footer">
          <div>
            <strong>UrbanHavens</strong>
            <p>
              Secure property rental and payment management.
            </p>
          </div>

          <div>
            <span>Generated</span>
            <strong>
              {formatDate(
                receipt.receipt_generated_at
              )}
            </strong>
          </div>
        </footer>
      </article>
    </main>
  );
};


export default PaymentReceiptPage;