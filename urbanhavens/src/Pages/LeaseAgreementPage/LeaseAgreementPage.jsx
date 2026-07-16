import React, {
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { api } from "../../Dashboard/Owner/UploadDetails/api/api";
import "./LeaseAgreementPage.css";


const LeaseAgreementPage = () => {
  // Reads the lease ID from the route.
  const { leaseId } = useParams();

  // Handles navigation back to the previous page.
  const navigate = useNavigate();

  // Stores agreement data and request state.
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  // Loads the protected tenancy agreement.
  useEffect(() => {
    const loadAgreement = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/leases/${leaseId}/agreement/`
        );

        setAgreement(response.data);
      } catch (requestError) {
        console.error(
          "Failed to load tenancy agreement:",
          requestError?.response?.data ||
            requestError?.message ||
            requestError
        );

        setError(
          requestError?.response?.data?.detail ||
            "Failed to load the tenancy agreement."
        );
      } finally {
        setLoading(false);
      }
    };

    loadAgreement();
  }, [leaseId]);


  // Formats money values consistently.
  const formatMoney = (value) =>
    Number(value || 0).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });


  // Formats dates for official document display.
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


  // Opens the browser print or PDF dialog.
  const handlePrint = () => {
    window.print();
  };


  if (loading) {
    return (
      <main className="lease-agreement-page">
        <div className="lease-agreement-state">
          Loading tenancy agreement...
        </div>
      </main>
    );
  }


  if (error) {
    return (
      <main className="lease-agreement-page">
        <div className="lease-agreement-state error">
          {error}
        </div>
      </main>
    );
  }


  if (!agreement) {
    return null;
  }


  return (
    <main className="lease-agreement-page">
      {/* Keeps actions outside the printed agreement. */}
      <div className="lease-agreement-actions no-print">
        <button
          type="button"
          className="lease-agreement-back-btn"
          onClick={() => navigate(-1)}
        >
          Back
        </button>

        <button
          type="button"
          className="lease-agreement-print-btn"
          onClick={handlePrint}
        >
          Print / Save as PDF
        </button>
      </div>

      <article className="lease-agreement-document">
        {/* Displays the large UrbanHavens background watermark. */}
        <div
          className="lease-agreement-watermark"
          aria-hidden="true"
        >
          URBANHAVENS
        </div>

        {/* Displays the document identity and references. */}
        <header className="lease-agreement-header">
          <div>
            <h1>URBANHAVENS</h1>

            <p>
              Secure Property Rental and Lease Management
            </p>
          </div>

          <div className="lease-agreement-reference">
            <span>Agreement Number</span>

            <strong>
              {agreement.agreement_number}
            </strong>

            <span>Generated</span>

            <strong>
              {formatDate(
                agreement.agreement_generated_at
              )}
            </strong>
          </div>
        </header>

        {/* Displays the official document title. */}
        <section className="lease-agreement-title">
          <h2>Official Tenancy Agreement</h2>

          <p>
            This agreement records the tenancy terms
            accepted between the landlord and tenant.
          </p>
        </section>

        {/* Displays landlord and tenant information. */}
        <section className="lease-agreement-section">
          <h3>Parties to the Agreement</h3>

          <div className="lease-agreement-two-column">
            <div>
              <span>Landlord</span>

              <strong>
                {agreement.landlord.name}
              </strong>

              <p>
                {agreement.landlord.email || "—"}
              </p>

              <p>
                {agreement.landlord.phone || "—"}
              </p>
            </div>

            <div>
              <span>Tenant</span>

              <strong>
                {agreement.tenant.name}
              </strong>

              <p>
                {agreement.tenant.email || "—"}
              </p>

              <p>
                {agreement.tenant.phone || "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Displays property and hostel room details. */}
        <section className="lease-agreement-section">
          <h3>Property Details</h3>

          <div className="lease-agreement-grid">
            <div>
              <span>Property</span>

              <strong>
                {agreement.property.name}
              </strong>
            </div>

            <div>
              <span>Category</span>

              <strong>
                {agreement.property.category === "hostel"
                  ? "Hostel"
                  : "House Rental"}
              </strong>
            </div>

            <div>
              <span>Property Type</span>

              <strong>
                {agreement.property.type || "—"}
              </strong>
            </div>

            <div>
              <span>Location</span>

              <strong>
                {[
                  agreement.property.city,
                  agreement.property.region,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </strong>
            </div>

            {agreement.room && (
              <>
                <div>
                  <span>Room Number</span>

                  <strong>
                    {agreement.room.room_number}
                  </strong>
                </div>

                <div>
                  <span>Room Type</span>

                  <strong>
                    {agreement.room.room_type}
                  </strong>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Displays the complete lease terms. */}
        <section className="lease-agreement-section">
          <h3>Lease Details</h3>

          <div className="lease-agreement-table">
            <div>
              <span>Lease Start Date</span>

              <strong>
                {formatDate(
                  agreement.lease.start_date
                )}
              </strong>
            </div>

            <div>
              <span>Lease End Date</span>

              <strong>
                {formatDate(
                  agreement.lease.end_date
                )}
              </strong>
            </div>

            <div>
              <span>Move-in Date</span>

              <strong>
                {formatDate(
                  agreement.lease.move_in_date
                )}
              </strong>
            </div>

            <div>
              <span>Rental Duration</span>

              <strong>
                {agreement.lease.duration_months
                  ? `${agreement.lease.duration_months} months`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>Monthly Rent</span>

              <strong>
                GHS{" "}
                {formatMoney(
                  agreement.lease.monthly_rent
                )}
              </strong>
            </div>

            <div>
              <span>Total Rent</span>

              <strong>
                {agreement.lease.total_rent
                  ? `GHS ${formatMoney(
                      agreement.lease.total_rent
                    )}`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>Deposit Amount</span>

              <strong>
                GHS{" "}
                {formatMoney(
                  agreement.lease.deposit_amount
                )}
              </strong>
            </div>

            <div>
              <span>Lease Status</span>

              <strong className="lease-agreement-active-status">
                {agreement.lease_status_display}
              </strong>
            </div>
          </div>
        </section>

        {/* Displays the linked payment summary when available. */}
        {agreement.payment && (
          <section className="lease-agreement-section">
            <h3>Payment Summary</h3>

            <div className="lease-agreement-table">
              <div>
                <span>Payment Method</span>

                <strong>
                  {agreement.payment.method_display}
                </strong>
              </div>

              <div>
                <span>Payment Reference</span>

                <strong>
                  {agreement.payment.reference}
                </strong>
              </div>

              <div>
                <span>Expected Amount</span>

                <strong>
                  GHS{" "}
                  {formatMoney(
                    agreement.payment.expected_amount
                  )}
                </strong>
              </div>

              <div>
                <span>Amount Received</span>

                <strong>
                  GHS{" "}
                  {formatMoney(
                    agreement.payment.amount_received
                  )}
                </strong>
              </div>

              <div>
                <span>Payment Status</span>

                <strong>
                  {
                    agreement.payment
                      .completion_status_display
                  }
                </strong>
              </div>

              <div>
                <span>Outstanding Balance</span>

                <strong>
                  GHS{" "}
                  {formatMoney(
                    agreement.payment.outstanding_balance
                  )}
                </strong>
              </div>

              <div>
                <span>Receipt Number</span>

                <strong>
                  {agreement.payment.receipt_number ||
                    "—"}
                </strong>
              </div>
            </div>
          </section>
        )}

        {/* Displays the official tenancy terms. */}
        <section className="lease-agreement-section">
          <h3>Terms and Conditions</h3>

          <ol className="lease-agreement-terms">
            <li>{agreement.terms.rent_due}</li>

            <li>{agreement.terms.property_use}</li>

            <li>{agreement.terms.maintenance}</li>

            <li>{agreement.terms.alterations}</li>

            <li>{agreement.terms.termination}</li>
          </ol>
        </section>

        {/* Displays optional landlord notes. */}
        {agreement.lease.notes && (
          <section className="lease-agreement-section">
            <h3>Additional Notes</h3>

            <div className="lease-agreement-notes">
              {agreement.lease.notes}
            </div>
          </section>
        )}

        {/* Displays signature spaces for printed agreements. */}
        <section className="lease-agreement-signatures">
          <div>
            <div className="lease-agreement-signature-line" />

            <strong>
              {agreement.landlord.name}
            </strong>

            <span>Landlord Signature</span>

            <span>Date: __________________</span>
          </div>

          <div>
            <div className="lease-agreement-signature-line" />

            <strong>
              {agreement.tenant.name}
            </strong>

            <span>Tenant Signature</span>

            <span>Date: __________________</span>
          </div>
        </section>

        {/* Displays the official agreement footer. */}
        <footer className="lease-agreement-footer">
          <div>
            <strong>UrbanHavens</strong>

            <p>
              Official tenancy agreement generated from
              verified lease records.
            </p>
          </div>

          <div>
            <span>Agreement Number</span>

            <strong>
              {agreement.agreement_number}
            </strong>
          </div>
        </footer>
      </article>
    </main>
  );
};


export default LeaseAgreementPage;