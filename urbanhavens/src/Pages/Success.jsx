import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import "./Success.css";

const Success = () => {
  const location = useLocation();
  const accountType = location.state?.accountType || "tenant";
  const [loading, setLoading] = useState(0);

  // Simulate loading progress
  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setLoading(progress);
    }, 50);
  }, []);

  return (
    <div className="success-page">
      <div className="success-card">
        <div className="loader-container">
          <svg className="progress-circle" viewBox="0 0 36 36">
            <path
              className="circle-bg"
              d="M18 2.0845
                 a 15.9155 15.9155 0 0 1 0 31.831
                 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="circle"
              strokeDasharray={`${loading}, 100`}
              d="M18 2.0845
                 a 15.9155 15.9155 0 0 1 0 31.831
                 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <text x="18" y="20.35" className="percentage" textAnchor="middle">{loading}%</text>
          </svg>
        </div>

        <h2>Account Created Successfully!</h2>
        <p>Your {accountType} account has been successfully registered.</p>

        {accountType === "tenant" && (
          <Link to="/properties" className="success-btn">
            Browse Properties
          </Link>
        )}

        <Link to={`/dashboard/${accountType}`} className="success-btn">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default Success;