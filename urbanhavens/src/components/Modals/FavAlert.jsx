import React, { useEffect } from "react";
import { FaHeart, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import "./FavAlert.css";

const FavAlert = ({ message, type = "success", show, onClose }) => {
  useEffect(() => {
    if (!show) return;

    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 2500);

    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className={`fav-alert fav-alert--${type}`}>
      <div className="fav-alert__icon">
        {type === "success" ? <FaCheckCircle /> : <FaTimesCircle />}
      </div>

      <div className="fav-alert__content">
        <h4>
          <FaHeart className="fav-alert__heart" /> Favorites
        </h4>
        <p>{message}</p>
      </div>

      <button className="fav-alert__close" onClick={onClose} aria-label="Close alert">
        ×
      </button>
    </div>
  );
};

export default FavAlert;